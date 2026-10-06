import { getOrCreateDeviceId, getDeviceLabel, setDeviceLabel } from './device';

export { getOrCreateDeviceId, getDeviceLabel, setDeviceLabel };
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.11:5223';

export interface User {
  _id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  deviceLabel?: string;
  avatarUrl?: string;
  oauthProvider?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId?: string | null;
  senderName: string;
  deviceId?: string;
  deviceLabel?: string;
  kind: 'text' | 'link' | 'image';
  text: string;
  url?: string;
  mime?: string;
  size?: number;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  status: 'live' | 'archived' | 'translator' | 'tool';
  toolId?: string | null;
  deviceId?: string | null;
  title: string;
  messageCount: number;
  startedAt: string;
  archivedAt?: string | null;
  previewText?: string;
  isPinned?: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalArchives: number;
  totalMessages: number;
  liveMessages: number;
}

export interface AITool {
  _id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
  isBuiltin?: boolean;
  visibility?: 'public' | 'private';
  createdAt?: string;
  updatedAt?: string;
}

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface Subtask {
  _id?: string;
  title: string;
  completed: boolean;
}

export interface Todo {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  dueDate?: string | null;
  subtasks: Subtask[];
  deviceId?: string;
  userId?: string | null;
  sourceMessageId?: string | null;
  prompt?: string | null;
  createdAt: string;
  updatedAt: string;
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

const AUTH_TOKEN_KEY = 'chat_auth_token';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token && !document.cookie.includes('Authorization=')) {
    document.cookie = `Authorization=${token}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
  }
  return token;
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    document.cookie = `Authorization=${token}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    document.cookie = 'Authorization=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
  }
};

async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  const url = isBrowser ? endpoint : `${BACKEND_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Attach persistent device identity headers (Ensure ASCII-safe encoding for headers)
  if (!headers.has('x-device-id')) {
    const dId = getOrCreateDeviceId();
    if (dId) headers.set('x-device-id', encodeURIComponent(dId));
  }
  if (!headers.has('x-device-label')) {
    const dLabel = getDeviceLabel();
    if (dLabel) {
      try {
        headers.set('x-device-label', encodeURIComponent(dLabel));
      } catch {
        // ignore
      }
    }
  }

  // Attach Authorization header if token is stored
  if (!headers.has('Authorization')) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Optional long-timeout support (e.g. AI parse can take 2-5 min).
  // Uses AbortSignal.timeout when available so the UI keeps waiting
  // instead of the browser/Next proxy hanging up early.
  let signal = options.signal as AbortSignal | undefined;
  if (timeoutMs && !signal && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(timeoutMs);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    signal,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

// Auth API
export const api = {
  async register(email: string, username: string, password: string): Promise<{ data: User; token: string }> {
    const res = await request<{ data: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async login(email: string, password: string): Promise<{ data: User; token: string }> {
    const res = await request<{ data: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async loginGoogle(idToken: string): Promise<{ data: User; token: string }> {
    const res = await request<{ data: User; token: string }>('/api/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async getMe(): Promise<{ data: User | null }> {
    const res = await request<{ data: User | null }>('/api/auth/me', { method: 'GET' });
    if (!res.data) {
      setAuthToken(null);
    }
    return res;
  },

  async logout(): Promise<{ message: string }> {
    setAuthToken(null);
    return request('/api/auth/logout', { method: 'POST' });
  },

  // Chat API
  async getSidebarConversations(search = ''): Promise<{ data: Conversation[] }> {
    const params = new URLSearchParams({ limit: '100' });
    if (search) params.append('search', search);
    return request(`/api/chat/conversations?${params.toString()}`);
  },

  async getMessages(conversationId: string = 'live', limit = 50, before?: string): Promise<{ data: { conversation: Conversation; messages: Message[] } }> {
    const params = new URLSearchParams({ conversationId, limit: String(limit), deviceId: getOrCreateDeviceId() });
    if (before) params.append('before', before);
    return request(`/api/chat/messages?${params.toString()}`);
  },

  async sendMessage(payload: {
    text?: string;
    url?: string;
    imageUrl?: string;
    kind?: 'text' | 'link' | 'image';
    conversationId?: string;
    deviceId?: string;
    deviceLabel?: string;
  }): Promise<{ data: Message }> {
    return request('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getOrCreateDeviceId(),
        deviceLabel: getDeviceLabel(),
        ...payload,
      }),
    });
  },

  async sendAIMessage(
    payload: {
      text: string;
      conversationId?: string;
      systemPrompt?: string;
      deviceId?: string;
      deviceLabel?: string;
    },
    handlers: {
      onUserMessage?: (message: Message) => void;
      onChunk?: (content: string) => void;
      onDone?: (data: { userMessage: Message; aiMessage: Message }) => void;
      onError?: (error: string) => void;
    } = {},
    signal?: AbortSignal
  ): Promise<void> {
    // Stream directly to the backend (bypass Next.js rewrites proxy) so long
    // generations are not reset mid-flight. Response is text/event-stream.
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser ? `${BACKEND_URL}/api/chat/ai` : '/api/chat/ai';

    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    });

    const dId = payload.deviceId || getOrCreateDeviceId();
    if (dId) headers.set('x-device-id', encodeURIComponent(dId));

    const dLabel = payload.deviceLabel || getDeviceLabel();
    if (dLabel) {
      try {
        headers.set('x-device-label', encodeURIComponent(dLabel));
      } catch {
        // ignore
      }
    }

    const token = getAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      signal,
      body: JSON.stringify({
        deviceId: dId,
        deviceLabel: dLabel,
        text: payload.text,
        conversationId: payload.conversationId,
        systemPrompt: payload.systemPrompt,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as { message?: string }));
      throw new Error(errBody.message || `AI stream failed with status ${res.status}`);
    }

    if (!res.body) {
      throw new Error('AI stream response has no body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawDone = false;
    let sawError = false;

    const dispatchEvent = (eventName: string, rawData: string) => {
      if (!rawData) return;
      let parsed: any;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        return;
      }

      switch (eventName) {
        case 'user_message':
          handlers.onUserMessage?.(parsed as Message);
          break;
        case 'chunk':
          if (typeof parsed?.content === 'string' && parsed.content) {
            handlers.onChunk?.(parsed.content);
          }
          break;
        case 'done':
          sawDone = true;
          handlers.onDone?.(parsed as { userMessage: Message; aiMessage: Message });
          break;
        case 'error':
          sawError = true;
          handlers.onError?.(String(parsed?.error || 'AI stream error'));
          break;
        default:
          break;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split(/\r?\n/);
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
          // ignore comment lines (e.g. ": ping")
        }

        if (dataLines.length > 0) {
          dispatchEvent(eventName, dataLines.join('\n'));
        }
      }
    }

    // Flush any trailing SSE frame that lacked a final blank line
    if (buffer.trim()) {
      const lines = buffer.split(/\r?\n/);
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length > 0) {
        dispatchEvent(eventName, dataLines.join('\n'));
      }
    }

    if (!sawDone && !sawError && !signal?.aborted) {
      handlers.onError?.('AI stream ended unexpectedly');
    }
  },

  async deleteMessage(id: string): Promise<{ data: { deleted: boolean; messageId: string } }> {
    return request(`/api/chat/messages/${id}`, { method: 'DELETE' });
  },

  async uploadFile(file: File): Promise<{ data: { url: string; filename: string; mimetype: string; size: number } }> {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/chat/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async clearChat(conversationId: string = 'live'): Promise<{ data: { archived?: Conversation; newLive?: Conversation; cleared?: boolean } }> {
    return request('/api/chat/clear', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        deviceId: getOrCreateDeviceId(),
      }),
    });
  },

  // Admin API
  async getAdminArchives(page = 1, limit = 20, search = ''): Promise<{ data: Conversation[]; total: number; page: number; totalPages: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    return request(`/api/admin/conversations?${params.toString()}`);
  },

  async getConversation(id: string): Promise<{ data: { conversation: Conversation; messages: Message[] } }> {
    return request(`/api/admin/conversations/${id}`);
  },

  async renameConversation(id: string, title: string): Promise<{ data: Conversation }> {
    return request(`/api/admin/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async togglePinConversation(id: string, isPinned?: boolean): Promise<{ data: Conversation }> {
    return request(`/api/chat/conversations/${id}/pin`, {
      method: 'PATCH',
      body: JSON.stringify({ isPinned }),
    });
  },

  async deleteConversation(id: string): Promise<{ deleted: boolean }> {
    return request(`/api/admin/conversations/${id}`, { method: 'DELETE' });
  },

  async getAdminStats(): Promise<{ data: AdminStats }> {
    return request('/api/admin/stats');
  },

  getExportUrl(id: string, format: 'json' | 'md' = 'json'): string {
    return `${BACKEND_URL}/api/admin/conversations/${id}/export?format=${format}`;
  },

  // Admin Account & Device Management API
  async getAdminUsers(): Promise<{ data: User[] }> {
    return request('/api/admin/users');
  },

  async createAdminUser(payload: {
    email: string;
    username: string;
    password?: string;
    deviceLabel?: string;
    role?: 'admin' | 'user';
  }): Promise<{ data: User }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUser(
    id: string,
    payload: {
      username?: string;
      deviceLabel?: string;
      password?: string;
      role?: 'admin' | 'user';
      isActive?: boolean;
    }
  ): Promise<{ data: User }> {
    return request(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminUser(id: string): Promise<{ data: { deleted: boolean; id: string } }> {
    return request(`/api/admin/users/${id}`, { method: 'DELETE' });
  },

  // AI Tools API
  async getTools(): Promise<{ data: AITool[] }> {
    return request('/api/tools');
  },

  async getTool(id: string): Promise<{ data: AITool }> {
    return request(`/api/tools/${id}`);
  },

  async createTool(payload: {
    name: string;
    description?: string;
    systemPrompt: string;
    icon?: string;
    visibility?: 'public' | 'private';
  }): Promise<{ data: AITool }> {
    return request('/api/tools', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTool(
    id: string,
    payload: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      icon?: string;
      visibility?: 'public' | 'private';
    }
  ): Promise<{ data: AITool }> {
    return request(`/api/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTool(id: string): Promise<{ data: { deleted: boolean; id: string } }> {
    return request(`/api/tools/${id}`, { method: 'DELETE' });
  },

  // Todos API
  async getTodos(params?: { status?: string; priority?: string; search?: string }): Promise<{ data: Todo[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request(`/api/todos${qs ? `?${qs}` : ''}`);
  },

  async createTodo(payload: Partial<Todo>): Promise<{ data: Todo }> {
    return request('/api/todos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTodo(id: string, payload: Partial<Todo>): Promise<{ data: Todo }> {
    return request(`/api/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTodo(id: string): Promise<{ message: string }> {
    return request(`/api/todos/${id}`, { method: 'DELETE' });
  },

  async clearCompletedTodos(): Promise<{ count: number; message: string }> {
    return request('/api/todos/completed/clear', { method: 'DELETE' });
  },

  async aiParseTasks(text: string): Promise<{ data: AIParsedTaskItem[] }> {
    // Long-running AI call (execution-prompt handoff can take 2-5 min).
    // Call the backend directly (absolute BACKEND_URL) instead of the
    // relative /api/... path so we bypass the Next.js rewrites proxy,
    // which was resetting the socket (ECONNRESET / "Failed to proxy"
    // ... "socket hang up"). Wait up to 5 min for completion.
    const AI_PARSE_TIMEOUT_MS = 300000;
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser ? `${BACKEND_URL}/api/todos/ai-parse` : '/api/todos/ai-parse';

    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (!headers.has('x-device-id')) {
      const dId = getOrCreateDeviceId();
      if (dId) headers.set('x-device-id', encodeURIComponent(dId));
    }
    if (!headers.has('x-device-label')) {
      const dLabel = getDeviceLabel();
      if (dLabel) {
        try {
          headers.set('x-device-label', encodeURIComponent(dLabel));
        } catch {
          // ignore
        }
      }
    }
    const token = getAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let signal: AbortSignal | undefined;
    if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      signal = AbortSignal.timeout(AI_PARSE_TIMEOUT_MS);
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
        signal,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new Error('AI is still organizing (timed out after 5 min). Please try again with shorter text.');
      }
      throw err;
    }
  },
};
