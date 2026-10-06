import { NextFunction, Request, Response } from 'express';
import { Container } from 'typedi';
import { ChatService } from './chat.service';
import { SSEService } from './sse.service';
import { RequestWithUser } from '@interfaces/auth.interface';

export class ChatController {
  public chatService = Container.get(ChatService);
  public sseService = Container.get(SSEService);

  private extractDeviceMeta(req: Request) {
    let deviceId = ((req.headers['x-device-id'] as string) || (req.query.deviceId as string) || req.body?.deviceId || '').trim();
    try {
      deviceId = decodeURIComponent(deviceId);
    } catch {
      // keep
    }

    const headerLabel = (req.headers['x-device-label'] as string) || '';
    let decodedHeaderLabel = '';
    try {
      decodedHeaderLabel = headerLabel ? decodeURIComponent(headerLabel) : '';
    } catch {
      decodedHeaderLabel = headerLabel;
    }

    const deviceLabel = (req.body?.deviceLabel || decodedHeaderLabel || (req as RequestWithUser).user?.deviceLabel || '').trim();
    return { deviceId, deviceLabel };
  }

  public stream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = (req.query.conversationId as string) || 'live';
      const { deviceId } = this.extractDeviceMeta(req);
      this.sseService.registerClient(res, conversationId, deviceId);
    } catch (error) {
      next(error);
    }
  };

  public getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = req.query.conversationId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = req.query.before as string;
      const { deviceId } = this.extractDeviceMeta(req);

      const data = await this.chatService.getMessages(conversationId, limit, before, deviceId);
      res.status(200).json({ data, message: 'Messages fetched successfully' });
    } catch (error) {
      next(error);
    }
  };

  public createMessage = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text, url, imageUrl, kind, conversationId } = req.body;
      const user = req.user;

      const senderName = user ? (user.username || user.fullName || user.email.split('@')[0]) : 'User';
      const senderId = user ? user._id : null;
      const { deviceId, deviceLabel } = this.extractDeviceMeta(req);

      const message = await this.chatService.createMessage({
        conversationId,
        text,
        url,
        imageUrl,
        kind,
        senderId,
        senderName,
        deviceId,
        deviceLabel,
      });

      res.status(201).json({ data: message, message: 'Message sent' });
    } catch (error) {
      next(error);
    }
  };

  public sendAIMessage = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    // SSE response — open the stream immediately so proxies/clients never wait
    // on a blocking JSON body (which previously caused intermittent HTTP 500s).
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Disable request/response idle timeouts for the life of this stream.
    req.setTimeout(0);
    res.setTimeout(0);

    const writeEvent = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const pingInterval = setInterval(() => {
      if (res.writableEnded) return;
      try {
        res.write(': ping\n\n');
      } catch {
        // ignore write failures on closed sockets
      }
    }, 15000);

    const abortController = new AbortController();
    // IMPORTANT: do NOT listen to req.on('close') — Express emits that as soon as
    // the POST body is fully read, which would abort the AI stream before `done`.
    // Only abort when the *response* socket closes unexpectedly (client navigated away).
    let streamFinished = false;
    const onResponseClose = () => {
      if (!streamFinished && !abortController.signal.aborted) {
        abortController.abort();
      }
    };
    res.on('close', onResponseClose);

    try {
      const { text, conversationId, systemPrompt } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        writeEvent('error', { error: 'Message text is required' });
        return;
      }

      const user = req.user;
      const senderName = user ? (user.username || user.fullName || user.email.split('@')[0]) : 'User';
      const senderId = user ? user._id : null;
      const { deviceId, deviceLabel } = this.extractDeviceMeta(req);

      writeEvent('connected', { status: 'connected', timestamp: Date.now() });

      await this.chatService.streamAIMessage(
        {
          conversationId,
          text: text.trim(),
          senderId,
          senderName,
          deviceId,
          deviceLabel,
          systemPrompt,
        },
        {
          onUserMessage: (userMessage) => writeEvent('user_message', userMessage),
          onChunk: (content) => writeEvent('chunk', { content }),
          onDone: (result) => writeEvent('done', result),
          onError: (error) => writeEvent('error', { error }),
        },
        abortController.signal
      );
    } catch (error: any) {
      // Never fall through to Express JSON error middleware once SSE headers are sent —
      // that would corrupt the stream into an HTTP 500 page.
      const message = error?.message || 'AI stream failed';
      writeEvent('error', { error: message });
    } finally {
      streamFinished = true;
      clearInterval(pingInterval);
      res.off('close', onResponseClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  };

  public deleteMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const result = await this.chatService.deleteMessage(id);
      res.status(200).json({ data: result, message: 'Message deleted' });
    } catch (error) {
      next(error);
    }
  };

  public uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
      }

      // Generate public URL for uploaded file
      const relativePath = req.file.path.replace(/\\/g, '/');
      const publicUrl = `/${relativePath}`;

      res.status(201).json({
        data: {
          url: publicUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        message: 'File uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  public clear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const convId = req.body?.conversationId || (req.query?.conversationId as string);
      const { deviceId } = this.extractDeviceMeta(req);
      if (convId === 'translator') {
        const result = await this.chatService.clearTranslator(deviceId);
        res.status(200).json({ data: result, message: 'Translator chat cleared' });
        return;
      }
      if (convId && (convId.startsWith('tool:') || convId.length === 24)) {
        const result = await this.chatService.clearToolConversation(convId, deviceId);
        res.status(200).json({ data: result, message: 'Tool chat cleared' });
        return;
      }
      const result = await this.chatService.clearAndArchive();
      res.status(200).json({ data: result, message: 'Chat cleared and archived' });
    } catch (error) {
      next(error);
    }
  };

  // --- Admin endpoints ---

  public listArchives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = (req.query.search as string) || '';

      const result = await this.chatService.listArchives(page, limit, search);
      res.status(200).json({ data: result.data, total: result.total, page: result.page, totalPages: result.totalPages });
    } catch (error) {
      next(error);
    }
  };

  public getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const result = await this.chatService.getConversationDetails(id);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  public renameConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const { title } = req.body;
      const result = await this.chatService.renameConversation(id, title);
      res.status(200).json({ data: result, message: 'Conversation renamed' });
    } catch (error) {
      next(error);
    }
  };

  public togglePinConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const { isPinned } = req.body || {};
      const result = await this.chatService.togglePinConversation(id, isPinned);
      res.status(200).json({ data: result, message: result.isPinned ? 'Conversation pinned' : 'Conversation unpinned' });
    } catch (error) {
      next(error);
    }
  };

  public deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const result = await this.chatService.deleteConversation(id);
      res.status(200).json({ data: result, message: 'Conversation deleted' });
    } catch (error) {
      next(error);
    }
  };

  public getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.chatService.getStats();
      res.status(200).json({ data: stats });
    } catch (error) {
      next(error);
    }
  };

  public exportConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const format = (req.query.format as string) === 'md' ? 'md' : 'json';
      const fileData = await this.chatService.exportConversation(id, format);

      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
      res.send(fileData.content);
    } catch (error) {
      next(error);
    }
  };
}
