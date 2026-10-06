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
    try {
      const { text, conversationId, systemPrompt } = req.body;
      const user = req.user;

      const senderName = user ? (user.username || user.fullName || user.email.split('@')[0]) : 'User';
      const senderId = user ? user._id : null;
      const { deviceId, deviceLabel } = this.extractDeviceMeta(req);

      const result = await this.chatService.sendAIMessage({
        conversationId,
        text,
        senderId,
        senderName,
        deviceId,
        deviceLabel,
        systemPrompt,
      });

      res.status(201).json({ data: result, message: 'AI response generated' });
    } catch (error) {
      next(error);
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
