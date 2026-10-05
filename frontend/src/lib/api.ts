import { getOrCreateDeviceId, getDeviceLabel, setDeviceLabel } from './device';

export { getOrCreateDeviceId, getDeviceLabel, setDeviceLabel };
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5223';

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
  createdAt?: string;
  updatedAt?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
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

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
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
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  },

  async login(email: string, password: string): Promise<{ data: User; token: string }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async loginGoogle(idToken: string): Promise<{ data: User; token: string }> {
    return request('/api/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  async getMe(): Promise<{ data: User }> {
    return request('/api/auth/me', { method: 'GET' });
  },

  async logout(): Promise<{ message: string }> {
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

  async sendAIMessage(payload: {
    text: string;
    conversationId?: string;
    systemPrompt?: string;
    deviceId?: string;
    deviceLabel?: string;
  }): Promise<{ data: { userMessage: Message; aiMessage: Message } }> {
    return request('/api/chat/ai', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getOrCreateDeviceId(),
        deviceLabel: getDeviceLabel(),
        ...payload,
      }),
    });
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

  async createTool(payload: { name: string; description?: string; systemPrompt: string; icon?: string }): Promise<{ data: AITool }> {
    return request('/api/tools', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTool(id: string, payload: { name?: string; description?: string; systemPrompt?: string; icon?: string }): Promise<{ data: AITool }> {
    return request(`/api/tools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTool(id: string): Promise<{ data: { deleted: boolean; id: string } }> {
    return request(`/api/tools/${id}`, { method: 'DELETE' });
  },
};
