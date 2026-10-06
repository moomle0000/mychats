import { Service } from 'typedi';
import { Types } from 'mongoose';
import axios from 'axios';
import { Readable } from 'stream';
import { ConversationModel, IConversation } from './conversation.model';
import { MessageModel, IMessage } from './message.model';
import { SSEService } from './sse.service';
import { ToolModel } from '../tools/tool.model';
import { HttpException } from '@exceptions/httpException';
import { AI_API_URL } from '@config';
import { logger } from '@utils/logger';

export interface SendAIMessagePayload {
  conversationId?: string;
  text: string;
  senderName?: string;
  senderId?: string | Types.ObjectId | null;
  deviceId?: string;
  deviceLabel?: string;
  systemPrompt?: string;
}

export interface StreamAIMessageHandlers {
  onUserMessage: (userMessage: IMessage) => void;
  onChunk: (content: string) => void;
  onDone: (result: { userMessage: IMessage; aiMessage: IMessage }) => void;
  onError: (error: string) => void;
}

export interface CreateMessageDto {
  conversationId?: string;
  deviceId?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
  kind?: 'text' | 'link' | 'image';
  senderId?: string | Types.ObjectId | null;
  senderName?: string;
  deviceLabel?: string;
  mime?: string;
  size?: number;
}

@Service()
export class ChatService {
  constructor(private sseService: SSEService) {}

  public async getOrCreateLiveConversation(): Promise<IConversation> {
    let live = await ConversationModel.findOne({ status: 'live' }).sort({ createdAt: -1 });
    if (!live) {
      live = await ConversationModel.create({
        status: 'live',
        title: 'Live Chat',
        startedAt: new Date(),
        messageCount: 0,
        previewText: '',
      });
    }
    return live;
  }

  public async getOrCreateTranslatorConversation(deviceId: string = ''): Promise<IConversation> {
    const filter: any = { status: 'translator' };
    if (deviceId) {
      filter.deviceId = deviceId;
    }
    let translator = await ConversationModel.findOne(filter).sort({ createdAt: -1 });
    if (!translator) {
      translator = await ConversationModel.create({
        status: 'translator',
        deviceId: deviceId || null,
        title: 'Technical Translator',
        startedAt: new Date(),
        messageCount: 0,
        previewText: 'Technical Translator (Arabic ➔ AI Prompt)',
      });
    }
    return translator;
  }

  public async getOrCreateToolConversation(toolId: string, deviceId: string = ''): Promise<IConversation> {
    const cleanId = toolId.replace('tool:', '');
    if (!Types.ObjectId.isValid(cleanId)) {
      throw new HttpException(400, 'Invalid tool ID');
    }
    const tool = await ToolModel.findById(cleanId);
    if (!tool) {
      throw new HttpException(404, 'Tool not found');
    }
    const filter: any = { status: 'tool', toolId: tool._id };
    if (deviceId) {
      filter.deviceId = deviceId;
    }
    let conv = await ConversationModel.findOne(filter);
    if (!conv) {
      conv = await ConversationModel.create({
        status: 'tool',
        toolId: tool._id,
        deviceId: deviceId || null,
        title: tool.name,
        startedAt: new Date(),
        messageCount: 0,
        previewText: tool.description || `AI Tool: ${tool.name}`,
      });
    }
    return conv;
  }

  public async getMessages(
    conversationId?: string,
    limit: number = 50,
    before?: string,
    deviceId: string = ''
  ): Promise<{ conversation: IConversation; messages: IMessage[] }> {
    let conv: IConversation | null = null;
    if (!conversationId || conversationId === 'live') {
      conv = await this.getOrCreateLiveConversation();
    } else if (conversationId === 'translator') {
      conv = await this.getOrCreateTranslatorConversation(deviceId);
    } else if (conversationId.startsWith('tool:') || (Types.ObjectId.isValid(conversationId) && (await ToolModel.exists({ _id: conversationId })))) {
      conv = await this.getOrCreateToolConversation(conversationId, deviceId);
    } else {
      conv = await ConversationModel.findById(conversationId);
      if (!conv) {
        throw new HttpException(404, 'Conversation not found');
      }
    }

    const query: any = { conversationId: conv._id };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await MessageModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100))
      .lean();

    // Reverse to chronological order (oldest -> newest)
    return {
      conversation: conv,
      messages: (messages.reverse() as unknown) as IMessage[],
    };
  }

  public async createMessage(payload: CreateMessageDto): Promise<IMessage> {
    let targetConv: IConversation;
    if (!payload.conversationId || payload.conversationId === 'live') {
      targetConv = await this.getOrCreateLiveConversation();
    } else if (payload.conversationId === 'translator') {
      targetConv = await this.getOrCreateTranslatorConversation(payload.deviceId || '');
    } else if (payload.conversationId.startsWith('tool:') || (Types.ObjectId.isValid(payload.conversationId) && (await ToolModel.exists({ _id: payload.conversationId })))) {
      targetConv = await this.getOrCreateToolConversation(payload.conversationId, payload.deviceId || '');
    } else {
      const conv = await ConversationModel.findById(payload.conversationId);
      if (!conv) {
        throw new HttpException(404, 'Conversation not found');
      }
      targetConv = conv;
    }
    const targetConvId = targetConv._id;

    let kind: 'text' | 'link' | 'image' = payload.kind || 'text';
    let url = payload.url || payload.imageUrl || '';

    const text = (payload.text || '').trim();

    if (url && (url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || payload.imageUrl)) {
      kind = 'image';
    } else if (text && text.match(/^https?:\/\/[^\s]+$/i)) {
      kind = 'link';
      url = text;
    }

    if (!text && !url) {
      throw new HttpException(400, 'Message text or attachment is required');
    }

    const message = await MessageModel.create({
      conversationId: targetConvId,
      senderId: payload.senderId ? new Types.ObjectId(String(payload.senderId)) : null,
      senderName: payload.senderName || 'Anonymous',
      deviceId: payload.deviceId || '',
      deviceLabel: payload.deviceLabel || '',
      kind,
      text,
      url,
      mime: payload.mime || '',
      size: payload.size || 0,
    });

    // Update conversation stats
    const preview = kind === 'image' ? '[Image]' : text.length > 80 ? `${text.slice(0, 80)}...` : text;
    await ConversationModel.findByIdAndUpdate(targetConvId, {
      $inc: { messageCount: 1 },
      $set: { previewText: preview },
    });

    // Instant SSE broadcast (Target only the originating device if scoped to a tool/device)
    const isScopedTool = targetConv.status === 'translator' || targetConv.status === 'tool';
    const targetDeviceId = isScopedTool ? (targetConv.deviceId || payload.deviceId) : undefined;
    await this.sseService.broadcast('message:new', message, targetDeviceId || undefined);

    return message;
  }

  /**
   * Stream an AI completion over SSE-style callbacks.
   * Saves the user message first, then streams provider tokens via onChunk,
   * and finally persists + broadcasts the completed AI message.
   * Provider failures are reported via onError (never thrown as HTTP 500).
   */
  public async streamAIMessage(
    payload: SendAIMessagePayload,
    handlers: StreamAIMessageHandlers,
    signal?: AbortSignal
  ): Promise<void> {
    const startedAt = Date.now();
    logger.info(`[AI Stream] start conversationId=${payload.conversationId || 'live'} deviceId=${payload.deviceId || '-'}`);

    // 1. Save user prompt message
    const userMessage = await this.createMessage({
      conversationId: payload.conversationId,
      text: payload.text,
      senderName: payload.senderName || 'User',
      senderId: payload.senderId,
      deviceId: payload.deviceId,
      deviceLabel: payload.deviceLabel || '',
      kind: 'text',
    });
    handlers.onUserMessage(userMessage);

    const targetConvId = userMessage.conversationId;

    // 2. Load recent conversation history (last 10 messages) for context
    const recentMsgs = await MessageModel.find({ conversationId: targetConvId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedMessages: Array<{ role: string; content: string }> = [];

    let effectiveSystemPrompt = payload.systemPrompt;
    if (!effectiveSystemPrompt && payload.conversationId) {
      const cleanToolId = payload.conversationId.replace('tool:', '');
      if (Types.ObjectId.isValid(cleanToolId)) {
        const tool = await ToolModel.findById(cleanToolId);
        if (tool) {
          effectiveSystemPrompt = tool.systemPrompt;
        }
      }
    }

    if (effectiveSystemPrompt && effectiveSystemPrompt.trim()) {
      formattedMessages.push({ role: 'system', content: effectiveSystemPrompt.trim() });
    }

    const history = recentMsgs.reverse().map((m) => ({
      role: m.senderName === 'AI' ? 'assistant' : 'user',
      content: m.text || (m.kind === 'image' ? '[Image attachment]' : ''),
    }));

    formattedMessages.push(...history);

    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: 'user', content: payload.text });
    }

    // 3. Stream from llama.cpp OpenAI-compatible API
    let aiResponseText = '';
    let chunkCount = 0;
    let providerFailed = false;
    let providerError = '';

    try {
      const response = await axios.post(
        `${AI_API_URL}/chat/completions`,
        {
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 1500,
          stream: true,
        },
        {
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          responseType: 'stream',
          // No hard axios timeout — keep the SSE channel open while the model generates.
          timeout: 0,
          signal,
        }
      );

      const providerStream = response.data as Readable;
      let buffer = '';

      for await (const raw of providerStream) {
        if (signal?.aborted) {
          providerStream.destroy();
          break;
        }

        buffer += typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta;
            const piece =
              (typeof delta?.content === 'string' && delta.content) ||
              (typeof delta?.reasoning_content === 'string' && delta.reasoning_content) ||
              '';

            if (piece) {
              aiResponseText += piece;
              chunkCount += 1;
              handlers.onChunk(piece);
            }
          } catch (parseErr: any) {
            logger.warn(`[AI Stream] skipped malformed provider chunk: ${parseErr?.message || parseErr}`);
          }
        }
      }

      logger.info(
        `[AI Stream] provider complete chunks=${chunkCount} chars=${aiResponseText.length} ms=${Date.now() - startedAt}`
      );
    } catch (err: any) {
      if (signal?.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        logger.info(`[AI Stream] aborted by client after ${Date.now() - startedAt}ms`);
        return;
      }

      providerFailed = true;
      providerError = err?.message || 'timeout/offline';
      logger.error(`[AI Stream] provider error: ${providerError}`);
      aiResponseText = `⚠️ AI Error: Could not connect to AI engine (${providerError}). Please ensure llama.cpp is running at ${AI_API_URL}.`;
      handlers.onError(aiResponseText);
    }

    if (signal?.aborted) {
      return;
    }

    if (!aiResponseText) {
      aiResponseText = 'No response received from AI model.';
      if (!providerFailed) {
        providerFailed = true;
        providerError = aiResponseText;
        handlers.onError(aiResponseText);
      }
    }

    // 4. Save and broadcast final AI response (scoped via createMessage / SSE rules)
    const aiMessage = await this.createMessage({
      conversationId: String(targetConvId),
      text: aiResponseText,
      senderName: 'AI',
      deviceId: payload.deviceId,
      kind: 'text',
    });

    logger.info(
      `[AI Stream] done chunks=${chunkCount} failed=${providerFailed} ms=${Date.now() - startedAt} aiMessageId=${aiMessage._id}`
    );
    handlers.onDone({ userMessage, aiMessage });
  }

  public async clearAndArchive(): Promise<{ archived: IConversation; newLive: IConversation }> {
    const live = await this.getOrCreateLiveConversation();
    const count = await MessageModel.countDocuments({ conversationId: live._id });
    if (count === 0) {
      throw new HttpException(400, 'Cannot archive an empty conversation. No messages in this chat yet.');
    }

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);
    // Use the first line of the first (non-AI) text message as the conversation name
    const firstMsg = await MessageModel.findOne({
      conversationId: live._id,
      senderName: { $ne: 'AI' },
      text: { $nin: ['', null] },
    })
      .sort({ createdAt: 1 })
      .lean();
    const firstLine = (firstMsg?.text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) || '';
    const archiveTitle = firstLine
      ? firstLine.length > 60
        ? `${firstLine.slice(0, 60)}…`
        : firstLine
      : `Chat ${dateStr} (${count} msgs)`;

    live.status = 'archived';
    live.title = archiveTitle;
    live.archivedAt = now;
    live.messageCount = count;
    await live.save();

    // Create fresh new live conversation
    const newLive = await ConversationModel.create({
      status: 'live',
      title: 'Live Chat',
      startedAt: now,
      messageCount: 0,
      previewText: '',
    });

    // Broadcast reset event to all connected SSE clients
    await this.sseService.broadcast('chat:live-reset', {
      previousArchivedId: live._id,
      newLiveId: newLive._id,
      timestamp: now,
    });

    return { archived: live, newLive };
  }

  public async clearTranslator(deviceId: string = ''): Promise<{ cleared: boolean }> {
    const translator = await this.getOrCreateTranslatorConversation(deviceId);
    await MessageModel.deleteMany({ conversationId: translator._id });
    translator.messageCount = 0;
    translator.previewText = 'Technical Translator (Arabic ➔ AI Prompt)';
    await translator.save();
    await this.sseService.broadcast('chat:translator-reset', { timestamp: Date.now() }, deviceId || undefined);
    return { cleared: true };
  }

  public async clearToolConversation(toolId: string, deviceId: string = ''): Promise<{ cleared: boolean }> {
    const conv = await this.getOrCreateToolConversation(toolId, deviceId);
    await MessageModel.deleteMany({ conversationId: conv._id });
    conv.messageCount = 0;
    conv.previewText = '';
    await conv.save();
    await this.sseService.broadcast('chat:tool-reset', { toolId, timestamp: Date.now() }, deviceId || undefined);
    return { cleared: true };
  }

  public async listArchives(page: number = 1, limit: number = 20, search: string = ''): Promise<{ data: IConversation[]; total: number; page: number; totalPages: number }> {
    const query: any = { status: 'archived' };
    if (search && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      ConversationModel.find(query).sort({ isPinned: -1, archivedAt: -1, createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      ConversationModel.countDocuments(query),
    ]);

    return {
      data: (data as unknown) as IConversation[],
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  public async togglePinConversation(id: string, isPinned?: boolean): Promise<IConversation> {
    const conv = await ConversationModel.findById(id);
    if (!conv) {
      throw new HttpException(404, 'Conversation not found');
    }

    conv.isPinned = typeof isPinned === 'boolean' ? isPinned : !conv.isPinned;
    await conv.save();

    await this.sseService.broadcast('conversation:pinned', {
      conversationId: String(conv._id),
      isPinned: conv.isPinned,
    });

    return conv;
  }

  public async getConversationDetails(id: string): Promise<{ conversation: IConversation; messages: IMessage[] }> {
    const conversation = await ConversationModel.findById(id);
    if (!conversation) {
      throw new HttpException(404, 'Conversation not found');
    }
    const messages = await MessageModel.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).lean();

    return {
      conversation,
      messages: (messages as unknown) as IMessage[],
    };
  }

  public async renameConversation(id: string, title: string): Promise<IConversation> {
    if (!title || !title.trim()) {
      throw new HttpException(400, 'Title cannot be empty');
    }
    const conv = await ConversationModel.findByIdAndUpdate(id, { title: title.trim() }, { new: true });
    if (!conv) {
      throw new HttpException(404, 'Conversation not found');
    }
    return conv;
  }

  public async deleteMessage(id: string): Promise<{ deleted: boolean; messageId: string; conversationId: string }> {
    const msg = await MessageModel.findById(id);
    if (!msg) {
      throw new HttpException(404, 'Message not found');
    }

    const conversationId = msg.conversationId;
    await MessageModel.findByIdAndDelete(id);

    await ConversationModel.findByIdAndUpdate(conversationId, {
      $inc: { messageCount: -1 },
    });

    await this.sseService.broadcast('message:deleted', {
      messageId: id,
      conversationId: String(conversationId),
    });

    return { deleted: true, messageId: id, conversationId: String(conversationId) };
  }

  public async deleteConversation(id: string): Promise<{ deleted: boolean }> {
    const conv = await ConversationModel.findById(id);
    if (!conv) {
      throw new HttpException(404, 'Conversation not found');
    }
    if (conv.status === 'live') {
      throw new HttpException(400, 'Cannot delete current live conversation. Use Clear & Archive first.');
    }

    await Promise.all([
      ConversationModel.findByIdAndDelete(id),
      MessageModel.deleteMany({ conversationId: id }),
    ]);

    return { deleted: true };
  }

  public async getStats(): Promise<{ totalArchives: number; totalMessages: number; liveMessages: number }> {
    const live = await this.getOrCreateLiveConversation();
    const [totalArchives, totalMessages, liveMessages] = await Promise.all([
      ConversationModel.countDocuments({ status: 'archived' }),
      MessageModel.countDocuments(),
      MessageModel.countDocuments({ conversationId: live._id }),
    ]);

    return {
      totalArchives,
      totalMessages,
      liveMessages,
    };
  }

  public async exportConversation(id: string, format: 'json' | 'md' = 'json'): Promise<{ filename: string; contentType: string; content: string }> {
    const { conversation, messages } = await this.getConversationDetails(id);
    const safeTitle = conversation.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'md') {
      let md = `# ${conversation.title}\n\n`;
      md += `Status: ${conversation.status}\n`;
      md += `Started: ${conversation.startedAt ? new Date(conversation.startedAt).toLocaleString() : ''}\n`;
      md += `Archived: ${conversation.archivedAt ? new Date(conversation.archivedAt).toLocaleString() : ''}\n`;
      md += `Total Messages: ${messages.length}\n\n---\n\n`;

      for (const m of messages) {
        const time = new Date(m.createdAt).toLocaleString();
        md += `### [${time}] ${m.senderName}\n`;
        if (m.text) md += `${m.text}\n\n`;
        if (m.url && m.kind === 'image') md += `![image](${m.url})\n\n`;
        else if (m.url) md += `Link: ${m.url}\n\n`;
      }

      return {
        filename: `${safeTitle}.md`,
        contentType: 'text/markdown',
        content: md,
      };
    }

    return {
      filename: `${safeTitle}.json`,
      contentType: 'application/json',
      content: JSON.stringify({ conversation, messages }, null, 2),
    };
  }
}
