import { Service } from 'typedi';
import { Types } from 'mongoose';
import axios from 'axios';
import { ConversationModel, IConversation } from './conversation.model';
import { MessageModel, IMessage } from './message.model';
import { SSEService } from './sse.service';
import { ToolModel } from '../tools/tool.model';
import { HttpException } from '@exceptions/httpException';
import { AI_API_URL } from '@config';

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

  public async sendAIMessage(payload: {
    conversationId?: string;
    text: string;
    senderName?: string;
    senderId?: string | Types.ObjectId | null;
    deviceId?: string;
    deviceLabel?: string;
    systemPrompt?: string;
  }): Promise<{ userMessage: IMessage; aiMessage: IMessage }> {
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

    // 3. Call llama.cpp API
    let aiResponseText = '';
    try {
      const response = await axios.post(
        `${AI_API_URL}/chat/completions`,
        {
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 1500,
          stream: false,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120000,
        }
      );

      const choice = response.data?.choices?.[0]?.message;
      if (choice) {
        aiResponseText = (choice.content || '').trim();
        if (!aiResponseText && choice.reasoning_content) {
          aiResponseText = choice.reasoning_content.trim();
        }
      }
    } catch (err: any) {
      console.error('[AI Mode] Failed to call llama.cpp:', err?.message || err);
      aiResponseText = `⚠️ AI Error: Could not connect to AI engine (${err?.message || 'timeout/offline'}). Please ensure llama.cpp is running at ${AI_API_URL}.`;
    }

    if (!aiResponseText) {
      aiResponseText = 'No response received from AI model.';
    }

    // 4. Save and broadcast AI response (scoped to same conversation and device)
    const aiMessage = await this.createMessage({
      conversationId: String(targetConvId),
      text: aiResponseText,
      senderName: 'AI',
      deviceId: payload.deviceId,
      kind: 'text',
    });

    return { userMessage, aiMessage };
  }

  public async clearAndArchive(): Promise<{ archived: IConversation; newLive: IConversation }> {
    const live = await this.getOrCreateLiveConversation();
    const count = await MessageModel.countDocuments({ conversationId: live._id });

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
      ConversationModel.find(query).sort({ archivedAt: -1, createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      ConversationModel.countDocuments(query),
    ]);

    return {
      data: (data as unknown) as IConversation[],
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
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
