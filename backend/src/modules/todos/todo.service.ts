import { Service } from 'typedi';
import { Types } from 'mongoose';
import axios from 'axios';
import { TodoModel, ITodo, TodoPriority, TodoStatus } from './todo.model';
import { HttpException } from '@exceptions/httpException';
import { AI_API_URL } from '@config';
import { SSEService } from '../chat/sse.service';

export interface CreateTodoDto {
  title: string;
  description?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  tags?: string[];
  dueDate?: Date | string | null;
  subtasks?: Array<{ title: string; completed?: boolean }>;
  deviceId?: string;
  userId?: string | Types.ObjectId | null;
  sourceMessageId?: string | Types.ObjectId | null;
  prompt?: string | null;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
  tags?: string[];
  dueDate?: Date | string | null;
  subtasks?: Array<{ title: string; completed: boolean }>;
  prompt?: string | null;
}

export interface AIParsedTaskItem {
  title: string;
  description?: string;
  priority: TodoPriority;
  tags: string[];
  subtasks: Array<{ title: string; completed: boolean }>;
  dueDate?: string | null;
  prompt?: string | null;
}

const TODO_AI_SYSTEM_PROMPT = `You are an expert Productivity Assistant and Task Structuring AI.
Your task is to analyze user text (which may be notes, bullet points, reminders, rough thoughts, or messages in English or Arabic) and extract one or more actionable tasks.

### Guidelines:
1. Language Requirement (STRICT): Always produce all output values (title, description, tags, subtasks, prompt) in ENGLISH ONLY. Even if the user input or source message is in Arabic or another language, translate and structure it into clear, professional English tasks.
2. Extract distinct tasks. If the input contains multiple goals, return an array of tasks. If it's a single task with multiple steps, return one task with subtasks.
3. Formulate concise, action-oriented titles in English (e.g. "Deploy backend to production", "Fix layout bug on mobile").
4. Assign an appropriate priority: "low", "medium", "high", or "urgent" based on urgency keywords, deadlines, or tone.
5. Extract relevant tags in English (e.g. ["dev", "frontend", "bug", "meeting", "personal"]).
6. If intermediate steps or checklist items are mentioned, format them as subtasks with completed: false.
7. Provide an ISO date string for dueDate if a specific time/day is mentioned (relative to now), otherwise null.
8. Task-Execution Prompt Handoff (CRITICAL):
   - Assess if the task is an actionable, executable task (e.g. software engineering, code changes, debugging, API creation, refactoring, configuring tools, DevOps, technical writing, research investigation, or any objective achievable by an AI coding/task agent).
   - If EXECUTION-RELATED, the "prompt" field MUST be a ready-to-run, self-contained prompt in English designed for immediate execution by an AI coding/execution agent (such as Antigravity, Claude, or ChatGPT). The prompt must be comprehensive and directly actionable without requiring further conversation:
     * Role & Objective: State clearly who the agent is and what precise outcome is required.
     * Context & Inputs: Provide all relevant background, inputs, constraints, files, or technologies implied by the task.
     * Step-by-Step Instructions: Enumerate explicit instructions to execute, implement, or resolve the issue.
     * Acceptance Criteria & Verification: Detail how the agent should verify its work (e.g., test cases, build/type-check commands, output format).
   - If NOT related to execution (e.g. personal reminder "call mom", physical errand "buy coffee", doctor appointment, general unstructured note with no action item): you MUST set "prompt" to null. Never generate an execution prompt for non-executable or passive personal tasks.

### Output Format:
You MUST respond with ONLY valid, raw JSON (no markdown formatting, no code block backticks, no explanations).
JSON schema:
{
  "tasks": [
    {
      "title": "Clean task title",
      "description": "More context or details if present",
      "priority": "low" | "medium" | "high" | "urgent",
      "tags": ["tag1", "tag2"],
      "subtasks": [
        { "title": "Subtask title", "completed": false }
      ],
      "dueDate": "YYYY-MM-DD" or null,
      "prompt": "You are an autonomous AI agent...\\n\\n### Objective:\\n...\\n### Instructions:\\n1. ...\\n### Verification:\\n..." or null
    }
  ]
}`;

@Service()
export class TodoService {
  constructor(private sseService: SSEService) {}

  public async getTodos(query: {
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<ITodo[]> {
    const filter: any = {};

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.priority && query.priority !== 'all') {
      filter.priority = query.priority;
    }

    if (query.search && query.search.trim()) {
      filter.title = { $regex: query.search.trim(), $options: 'i' };
    }

    return TodoModel.find(filter).sort({ createdAt: -1 }).lean() as unknown as ITodo[];
  }

  public async createTodo(dto: CreateTodoDto): Promise<ITodo> {
    if (!dto.title || !dto.title.trim()) {
      throw new HttpException(400, 'Task title is required');
    }

    const todo = await TodoModel.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      priority: dto.priority || 'medium',
      status: dto.status || 'pending',
      tags: Array.isArray(dto.tags) ? dto.tags : [],
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      subtasks: Array.isArray(dto.subtasks)
        ? dto.subtasks.map((st) => ({ title: st.title.trim(), completed: !!st.completed }))
        : [],
      deviceId: dto.deviceId || '',
      userId: dto.userId && Types.ObjectId.isValid(String(dto.userId)) ? new Types.ObjectId(String(dto.userId)) : null,
      sourceMessageId: dto.sourceMessageId && Types.ObjectId.isValid(String(dto.sourceMessageId)) ? new Types.ObjectId(String(dto.sourceMessageId)) : null,
      prompt: dto.prompt && dto.prompt.trim() ? dto.prompt.trim() : null,
    });

    await this.sseService.broadcast('todo:created', { todo });

    return todo;
  }

  public async updateTodo(id: string, dto: UpdateTodoDto): Promise<ITodo> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException(400, 'Invalid task ID');
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.subtasks !== undefined) updateData.subtasks = dto.subtasks;
    if (dto.prompt !== undefined) updateData.prompt = dto.prompt && dto.prompt.trim() ? dto.prompt.trim() : null;

    const updated = await TodoModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      throw new HttpException(404, 'Task not found');
    }

    await this.sseService.broadcast('todo:updated', { todo: updated });

    return updated;
  }

  public async deleteTodo(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException(400, 'Invalid task ID');
    }
    const result = await TodoModel.findByIdAndDelete(id);
    if (!result) {
      throw new HttpException(404, 'Task not found');
    }

    await this.sseService.broadcast('todo:deleted', { todoId: id });

    return true;
  }

  public async clearCompleted(): Promise<number> {
    const query: any = { status: 'completed' };
    const res = await TodoModel.deleteMany(query);

    await this.sseService.broadcast('todo:cleared_completed', { count: res.deletedCount || 0 });

    return res.deletedCount || 0;
  }

  public async parseNaturalLanguageToTasks(text: string): Promise<AIParsedTaskItem[]> {
    if (!text || !text.trim()) {
      throw new HttpException(400, 'Input text is required for AI task parsing');
    }

    try {
      // Long-running AI call: execution-prompt generation can take 2-3+ min
      // on llama.cpp (CPU). Allow up to 5 min so the task completes instead
      // of hitting the old 60s axios timeout (which surfaced as
      // "Failed to proxy ... socket hang up" on the frontend).
      const response = await axios.post(
        `${AI_API_URL}/chat/completions`,
        {
          messages: [
            { role: 'system', content: TODO_AI_SYSTEM_PROMPT },
            { role: 'user', content: text.trim() },
          ],
          temperature: 0.3,
          max_tokens: 3500,
          stream: false,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 300000,
        }
      );

      const content = response.data?.choices?.[0]?.message?.content?.trim() || '';
      
      // Clean possible markdown code fences if AI wrapped JSON
      let cleaned = content;
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        return parsed.tasks.map((t: any) => ({
          title: String(t.title || 'New Task'),
          description: String(t.description || ''),
          priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
          tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
          subtasks: Array.isArray(t.subtasks)
            ? t.subtasks.map((st: any) => ({
                title: String(st.title || st),
                completed: false,
              }))
            : [],
          dueDate: t.dueDate || null,
          prompt: typeof t.prompt === 'string' && t.prompt.trim() ? t.prompt.trim() : null,
        }));
      }
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '');
      console.warn(
        `[TodoService] AI parse ${isTimeout ? 'timed out after 5min' : 'fallback/JSON error'}:`,
        err?.message || err
      );
    }

    // Fallback: create single structured task from the raw input
    const firstLine = text.trim().split('\n')[0].slice(0, 80);
    return [
      {
        title: firstLine,
        description: text.trim().length > firstLine.length ? text.trim() : '',
        priority: 'medium',
        tags: ['quick-task'],
        subtasks: [],
        dueDate: null,
        prompt: null,
      },
    ];
  }
}
