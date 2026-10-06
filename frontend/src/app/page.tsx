'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import Sidebar from '@/components/Sidebar';
import ChatToolbar from '@/components/ChatToolbar';
import MessageList from '@/components/MessageList';
import ChatBox, { InputMode } from '@/components/ChatBox';
import TodoView from '@/components/TodoView';
import { api, Message, Conversation, User, AITool } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { TRANSLATOR_SYSTEM_PROMPT } from '@/lib/constants';

export default function ChatPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Conversations list & active conversation
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tools, setTools] = useState<AITool[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('live');
  const [activeTitle, setActiveTitle] = useState<string>('Live Chat');

  // Input & AI Mode State
  const [mode, setMode] = useState<InputMode>('chat');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [currentDbConv, setCurrentDbConv] = useState<Conversation | null>(null);

  // Toggle Mode Handler (Chat <-> AI)
  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === 'chat' ? 'ai' : 'chat'));
  }, []);

  // Global keydown listener for Tab key to switch mode seamlessly
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        // If focus is inside the chat text field (textarea/input), the ChatBox
        // onKeyDown handler already switches the mode. Skip here to avoid a
        // double-toggle (two handlers firing on one Tab press = no net change).
        if (tag === 'input' || tag === 'textarea') return;
        // Otherwise (body, buttons, links, etc.) let Tab switch the mode.
        if (tag !== 'button' && tag !== 'a') {
          e.preventDefault();
          handleToggleMode();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleMode]);

  // On mobile, close sidebar by default
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  // Load user profile
  useEffect(() => {
    api
      .getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  // Load AI tools
  const loadTools = useCallback(async () => {
    try {
      const res = await api.getTools();
      setTools(res.data || []);
    } catch (err) {
      console.error('[ChatPage] Failed to load tools:', err);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  // Check URL query param `?tool=<id>` if launched from Tools studio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const toolParam = params.get('tool');
      if (toolParam) {
        setActiveConversationId(toolParam);
      }
    }
  }, []);

  // Active Tool Detection
  const activeTool = tools.find(
    (t) => t._id === activeConversationId || (t.name === 'Technical Translator' && activeConversationId === 'translator')
  );
  const isTranslator = activeConversationId === 'translator' || activeTool?.name === 'Technical Translator';
  const isToolChat = Boolean(activeTool || isTranslator);

  // When switching to a tool, set mode to AI
  useEffect(() => {
    if (isToolChat) {
      setMode('ai');
    }
  }, [isToolChat, activeConversationId]);

  // Fetch all archived conversations for sidebar ONLY if user is logged in
  const loadSidebarConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    try {
      const res = await api.getSidebarConversations();
      setConversations(res.data || []);
    } catch (err) {
      console.error('[ChatPage] Failed to load sidebar conversations:', err);
    }
  }, [user]);

  useEffect(() => {
    loadSidebarConversations();
  }, [loadSidebarConversations]);

  // If user logs out while viewing an archived conversation, reset back to Live Chat
  useEffect(() => {
    if (!user && activeConversationId !== 'live' && !isToolChat) {
      setActiveConversationId('live');
      setActiveTitle('Live Chat');
    }
  }, [user, activeConversationId, isToolChat]);

  // Load messages for currently active conversation
  // Load messages for currently active conversation
  const loadMessages = useCallback(async (convId: string) => {
    if (convId === 'todo') {
      setActiveTitle('My Tasks');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getMessages(convId, 100);
      setMessages(res.data.messages || []);
      setCurrentDbConv(res.data.conversation || null);

      if (convId === 'live') {
        setActiveTitle('Live Chat');
      } else if (convId === 'translator') {
        setActiveTitle('Technical Translator (Arabic ➔ AI Prompt)');
      } else if (res.data.conversation) {
        setActiveTitle(res.data.conversation.title || 'Chat');
      }
    } catch (err) {
      console.error('[ChatPage] Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  // Update title when activeTool loads
  useEffect(() => {
    if (activeTool) {
      setActiveTitle(activeTool.name);
    }
  }, [activeTool]);

  // Handle new message from SSE broadcast (Isolated to current active conversation)
  const handleNewMessage = useCallback(
    (msg: Message) => {
      if (activeConversationId === 'live') {
        if (!currentDbConv || msg.conversationId === currentDbConv._id) {
          setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
        }
      } else if (currentDbConv && msg.conversationId === currentDbConv._id) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
    },
    [activeConversationId, currentDbConv]
  );

  // Handle message deleted from SSE broadcast
  const handleDeletedMessage = useCallback((data: { messageId: string; conversationId: string }) => {
    setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
  }, []);

  // Handle live chat reset event from SSE
  const handleLiveReset = useCallback(() => {
    if (activeConversationId === 'live') {
      setMessages([]);
    }
    loadSidebarConversations();
  }, [activeConversationId, loadSidebarConversations]);

  // Connect SSE realtime stream
  const { status, reconnect } = useSSE({
    conversationId: 'live',
    onNewMessage: handleNewMessage,
    onDeleteMessage: handleDeletedMessage,
    onLiveReset: handleLiveReset,
  });

  // Select a conversation from sidebar
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // "+ New Chat" button handler
  const handleNewChat = () => {
    if (activeConversationId !== 'live') {
      setActiveConversationId('live');
      setActiveTitle('Live Chat');
      setMode('chat');
      if (isMobile) setSidebarOpen(false);
    } else {
      handleClear();
    }
  };

  // Send message handler (Supports both Chat mode and AI mode / Tools)
  const handleSendMessage = async (text: string, imageUrl?: string, inputMode: InputMode = mode) => {
    if (isReadOnly) return;

    // AI Mode or Dedicated Tool
    if (isToolChat || inputMode === 'ai') {
      try {
        setAiGenerating(true);
        const systemPrompt = activeTool?.systemPrompt || (isTranslator ? TRANSLATOR_SYSTEM_PROMPT : undefined);

        const res = await api.sendAIMessage({
          text,
          conversationId: activeConversationId,
          systemPrompt,
        });

        // Add both user message and AI response immediately
        setMessages((prev) => {
          const next = [...prev];
          if (!next.some((m) => m._id === res.data.userMessage._id)) next.push(res.data.userMessage);
          if (!next.some((m) => m._id === res.data.aiMessage._id)) next.push(res.data.aiMessage);
          return next;
        });
      } catch (err: any) {
        alert(`AI Generation error: ${err?.message || 'Could not reach AI model'}`);
      } finally {
        setAiGenerating(false);
      }
      return;
    }

    // Normal Chat Mode (Live Chat or a saved conversation — both stay writable)
    const res = await api.sendMessage({ text, imageUrl, conversationId: activeConversationId });
    handleNewMessage(res.data);
  };

  // Delete message
  const handleDeleteMessage = async (id: string) => {
    await api.deleteMessage(id);
    setMessages((prev) => prev.filter((m) => m._id !== id));
  };

  // Clear & Archive
  const handleClear = async () => {
    if (isToolChat) {
      await api.clearChat(activeConversationId);
      setMessages([]);
      return;
    }
    await api.clearChat('live');
    setMessages([]);
    setActiveConversationId('live');
    setActiveTitle('Live Chat');
    loadSidebarConversations();
  };

  // Rename conversation in sidebar
  const handleRename = async (id: string, newTitle: string) => {
    await api.renameConversation(id, newTitle);
    if (activeConversationId === id) {
      setActiveTitle(newTitle);
    }
    loadSidebarConversations();
  };

  // Delete conversation in sidebar
  const handleDelete = async (id: string) => {
    await api.deleteConversation(id);
    if (activeConversationId === id) {
      setActiveConversationId('live');
    }
    loadSidebarConversations();
  };

  // Logout
  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const isLive = activeConversationId === 'live';
  // Saved conversations remain active/writable — nothing is read-only anymore
  const isReadOnly = false;

  return (
    <Box
      sx={{
        display: 'flex',
        height: { xs: '100dvh', md: '100vh' },
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        backgroundColor: 'background.default',
      }}
    >
      {/* Gemini / ChatGPT Style Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        conversations={conversations}
        tools={tools}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        user={user}
        onLogout={handleLogout}
        onRename={handleRename}
        onDelete={handleDelete}
        isMobile={isMobile}
      />

      {/* Main Chat Interface */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ChatToolbar
          status={status}
          reconnect={reconnect}
          onClear={handleClear}
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          activeTitle={activeTitle}
          isLive={isLive}
          isTool={isToolChat}
          onNewChat={handleNewChat}
          hasMessages={messages.length > 0}
        />

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: '100%',
            maxWidth: activeConversationId === 'todo' ? '100%' : { sm: '70%', xs: '100%' },
            minHeight: 0,
            minWidth: 0,
            mx: 'auto',
          }}
        >
          {activeConversationId === 'todo' ? (
            <TodoView onBackToChat={() => setActiveConversationId('live')} />
          ) : loading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <>
              <MessageList
                messages={messages}
                currentUserId={user?._id}
                onDeleteMessage={handleDeleteMessage}
                isReadOnly={isReadOnly}
                aiGenerating={aiGenerating}
              />
              <ChatBox
                onSendMessage={handleSendMessage}
                isReadOnly={isReadOnly}
                mode={mode}
                onToggleMode={handleToggleMode}
                aiGenerating={aiGenerating}
                placeholder={
                  isToolChat
                    ? `Ask ${activeTool?.name || 'AI Tool'}... (Press Enter to send)`
                    : undefined
                }
              />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
