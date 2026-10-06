'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BACKEND_URL, Message, Todo } from '@/lib/api';
import { getOrCreateDeviceId } from '@/lib/device';

export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSSEOptions {
  conversationId?: string;
  onNewMessage?: (message: Message) => void;
  onDeleteMessage?: (data: { messageId: string; conversationId: string }) => void;
  onLiveReset?: (data: { previousArchivedId: string; newLiveId: string; timestamp: string }) => void;
  onConversationPinned?: (data: { conversationId: string; isPinned: boolean }) => void;
  onTodoCreated?: (data: { todo: Todo }) => void;
  onTodoUpdated?: (data: { todo: Todo }) => void;
  onTodoDeleted?: (data: { todoId: string }) => void;
  onTodoCleared?: (data: { count: number }) => void;
}

export function useSSE({
  conversationId = 'live',
  onNewMessage,
  onDeleteMessage,
  onLiveReset,
  onConversationPinned,
  onTodoCreated,
  onTodoUpdated,
  onTodoDeleted,
  onTodoCleared,
}: UseSSEOptions = {}) {
  const [status, setStatus] = useState<SSEConnectionStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onDeleteMessageRef = useRef(onDeleteMessage);
  onDeleteMessageRef.current = onDeleteMessage;

  const onLiveResetRef = useRef(onLiveReset);
  onLiveResetRef.current = onLiveReset;

  const onConversationPinnedRef = useRef(onConversationPinned);
  onConversationPinnedRef.current = onConversationPinned;

  const onTodoCreatedRef = useRef(onTodoCreated);
  onTodoCreatedRef.current = onTodoCreated;

  const onTodoUpdatedRef = useRef(onTodoUpdated);
  onTodoUpdatedRef.current = onTodoUpdated;

  const onTodoDeletedRef = useRef(onTodoDeleted);
  onTodoDeletedRef.current = onTodoDeleted;

  const onTodoClearedRef = useRef(onTodoCleared);
  onTodoClearedRef.current = onTodoCleared;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setStatus('connecting');

    const deviceId = getOrCreateDeviceId();
    const streamUrl = `${BACKEND_URL}/api/chat/stream?conversationId=${encodeURIComponent(conversationId)}&deviceId=${encodeURIComponent(deviceId)}`;
    const es = new EventSource(streamUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setStatus('connected');
      retryCountRef.current = 0;
    });

    es.addEventListener('ping', () => {
      setStatus('connected');
    });

    es.addEventListener('message:new', (event: MessageEvent) => {
      try {
        const message: Message = JSON.parse(event.data);
        if (onNewMessageRef.current) {
          onNewMessageRef.current(message);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:new event:', err);
      }
    });

    es.addEventListener('message:deleted', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (onDeleteMessageRef.current) {
          onDeleteMessageRef.current(payload);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:deleted event:', err);
      }
    });

    es.addEventListener('chat:live-reset', (event: MessageEvent) => {
      try {
        const resetData = JSON.parse(event.data);
        if (onLiveResetRef.current) {
          onLiveResetRef.current(resetData);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse chat:live-reset event:', err);
      }
    });

    es.addEventListener('conversation:pinned', (event: MessageEvent) => {
      try {
        const pinData = JSON.parse(event.data);
        if (onConversationPinnedRef.current) {
          onConversationPinnedRef.current(pinData);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse conversation:pinned event:', err);
      }
    });

    es.addEventListener('todo:created', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (onTodoCreatedRef.current) {
          onTodoCreatedRef.current(payload);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse todo:created event:', err);
      }
    });

    es.addEventListener('todo:updated', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (onTodoUpdatedRef.current) {
          onTodoUpdatedRef.current(payload);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse todo:updated event:', err);
      }
    });

    es.addEventListener('todo:deleted', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (onTodoDeletedRef.current) {
          onTodoDeletedRef.current(payload);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse todo:deleted event:', err);
      }
    });

    es.addEventListener('todo:cleared_completed', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (onTodoClearedRef.current) {
          onTodoClearedRef.current(payload);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse todo:cleared_completed event:', err);
      }
    });

    es.onerror = () => {
      setStatus('disconnected');
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff reconnect
      const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
      retryCountRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoff);
    };
  }, [conversationId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return {
    status,
    reconnect,
  };
}
