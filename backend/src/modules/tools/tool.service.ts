import { Service } from 'typedi';
import { Types } from 'mongoose';
import { ToolModel, ITool } from './tool.model';
import { HttpException } from '@exceptions/httpException';

export const DEFAULT_TRANSLATOR_PROMPT = `You are an expert Technical Translator and Prompt Localization AI. Your primary objective is to translate user inputs from Arabic (both Modern Standard Arabic and technical Arabizi/informal dialects) into precise, structured, and idiomatically accurate English suitable for consumption by downstream AI agents, LLM coding assistants, and technical pipelines.

### Core Objectives:
1. **Semantic & Technical Precision**:
- Detect technical intent, domain context (e.g., Web Dev, Networking, Cybersecurity, Cloud, Embedded Systems, Hardware, Database Schemas), and software design patterns. 
- Do NOT translate literally. Map Arabic technical expressions and informal phrasings directly to standard industry terminology (e.g., translate "ابغى اربط قاعدة البيانات مع الواجهة" to "Establish a database connection and integrate it with the frontend client"). 
- Retain variable names, technical keywords, CLI commands, file extensions, and code snippets exactly as intended or format them cleanly.

2. **AI-Ready Translation**:
- Translate into actionable, clear, and unambiguous English instructions/prompts. 
- Clarify implicit requirements (e.g., if the user says "ابغى زر يرسل البيانات للباك ايند", output "Implement a UI button component that submits form data to the backend API endpoint").

3. **Output Discipline**:
- Deliver ONLY the translated technical prompt/content unless explicitly asked for explanations. 
- Maintain the tone, urgency, and technical hierarchy of the original request. 
- Preserve formatting (Markdown, bullet points, JSON, code blocks) where provided in the input. 

### Guidelines for Arabizi & Mixed Dialects:
- Seamlessly handle blended Arabic-English technical syntax (e.g., "سويلي رووت في الاكسبريس رجع الداتا" -> "Create an Express.js route handler that returns the data payload").
- Normalize vague phrases into standard technical actions:
- "صلح المشكلة / فيه خطأ" -> "Debug and resolve the following issue/exception"
- "ارفع مشروع" -> "Deploy the project / Push to remote repository" (infer context)
- "سوي سكربت" -> "Write an automated script"

### Response Format: Output ONLY the clean, translated English prompt ready to be ingested by the target AI agent.`;

@Service()
export class ToolService {
  public async ensureDefaultTools(): Promise<void> {
    const existing = await ToolModel.findOne({ name: 'Technical Translator' });
    if (!existing) {
      await ToolModel.create({
        name: 'Technical Translator',
        description: 'Translates Arabic (technical/dialects/Arabizi) into AI-ready technical English prompts.',
        systemPrompt: DEFAULT_TRANSLATOR_PROMPT,
        icon: 'translate',
        isBuiltin: true,
      });
    }
  }

  public async getAllTools(): Promise<ITool[]> {
    await this.ensureDefaultTools();
    return ToolModel.find().sort({ isBuiltin: -1, createdAt: 1 }).lean() as unknown as ITool[];
  }

  public async getToolById(id: string): Promise<ITool> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException(400, 'Invalid tool ID');
    }
    const tool = await ToolModel.findById(id);
    if (!tool) {
      throw new HttpException(404, 'Tool not found');
    }
    return tool;
  }

  public async createTool(data: {
    name: string;
    description?: string;
    systemPrompt: string;
    icon?: string;
    createdBy?: Types.ObjectId | string | null;
  }): Promise<ITool> {
    if (!data.name || !data.name.trim()) {
      throw new HttpException(400, 'Tool name is required');
    }
    if (!data.systemPrompt || !data.systemPrompt.trim()) {
      throw new HttpException(400, 'System prompt is required');
    }

    const tool = await ToolModel.create({
      name: data.name.trim(),
      description: (data.description || '').trim(),
      systemPrompt: data.systemPrompt.trim(),
      icon: data.icon || 'auto_awesome',
      isBuiltin: false,
      createdBy: data.createdBy ? new Types.ObjectId(String(data.createdBy)) : null,
    });

    return tool;
  }

  public async updateTool(
    id: string,
    data: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      icon?: string;
    }
  ): Promise<ITool> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException(400, 'Invalid tool ID');
    }

    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description.trim();
    if (data.systemPrompt !== undefined) updates.systemPrompt = data.systemPrompt.trim();
    if (data.icon !== undefined) updates.icon = data.icon.trim();

    const tool = await ToolModel.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!tool) {
      throw new HttpException(404, 'Tool not found');
    }
    return tool;
  }

  public async deleteTool(id: string): Promise<{ deleted: boolean; id: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException(400, 'Invalid tool ID');
    }

    const tool = await ToolModel.findById(id);
    if (!tool) {
      throw new HttpException(404, 'Tool not found');
    }

    if (tool.isBuiltin) {
      throw new HttpException(400, 'Built-in tools cannot be deleted');
    }

    await ToolModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }
}
