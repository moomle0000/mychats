'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Chip,
  Checkbox,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Collapse,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import Link from 'next/link';
import { api, Todo, TodoPriority, AIParsedTaskItem, User } from '@/lib/api';
import { useColorMode } from '@/theme/ColorModeContext';
import { useSSE } from '@/hooks/useSSE';

interface TodoViewProps {
  user?: User | null;
  onBackToChat?: () => void;
  initialPrompt?: string;
}

const PRIORITY_COLORS: Record<TodoPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  high: { label: 'High', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
  medium: { label: 'Medium', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  low: { label: 'Low', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

export default function TodoView({ user, onBackToChat, initialPrompt }: TodoViewProps) {
  const { mode } = useColorMode();
  const isDark = mode === 'dark';

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Natural Language & Quick Add Inputs
  const [promptText, setPromptText] = useState(initialPrompt || '');
  const [parsingAI, setParsingAI] = useState(false);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);

  // New subtask state per task
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<{ [id: string]: string }>({});

  // Manual Add Dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualPriority, setManualPriority] = useState<TodoPriority>('medium');
  const [manualTags, setManualTags] = useState('');

  // AI Parsed preview dialog
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiParsedTasks, setAiParsedTasks] = useState<AIParsedTaskItem[]>([]);
  const [savingParsed, setSavingParsed] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Real-time sync with SSE
  const handleTodoCreated = useCallback((data: { todo: Todo }) => {
    setTodos((prev) => (prev.some((t) => t._id === data.todo._id) ? prev : [data.todo, ...prev]));
  }, []);

  const handleTodoUpdated = useCallback((data: { todo: Todo }) => {
    setTodos((prev) => prev.map((t) => (t._id === data.todo._id ? data.todo : t)));
  }, []);

  const handleTodoDeleted = useCallback((data: { todoId: string }) => {
    setTodos((prev) => prev.filter((t) => t._id !== data.todoId));
  }, []);

  const handleTodoCleared = useCallback(() => {
    setTodos((prev) => prev.filter((t) => t.status !== 'completed'));
  }, []);

  useSSE({
    conversationId: 'live',
    onTodoCreated: handleTodoCreated,
    onTodoUpdated: handleTodoUpdated,
    onTodoDeleted: handleTodoDeleted,
    onTodoCleared: handleTodoCleared,
  });

  // Load Todos
  const loadTodos = useCallback(async () => {
    if (!user) {
      setTodos([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.getTodos({
        status: filterTab !== 'all' ? filterTab : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setTodos(res.data || []);
    } catch (err) {
      console.error('[TodoView] Failed to load todos:', err);
    } finally {
      setLoading(false);
    }
  }, [user, filterTab, priorityFilter, searchQuery]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Handle AI parse (long-running: execution-prompt handoff can take 2-3+ min)
  const handleAIParse = async () => {
    if (!promptText.trim()) return;
    try {
      setParsingAI(true);
      const res = await api.aiParseTasks(promptText.trim());
      setAiParsedTasks(res.data || []);
      setAiPreviewOpen(true);
    } catch (err: any) {
      const msg: string = err?.message || 'Error';
      if (/timed out|still organizing/i.test(msg)) {
        alert('AI is taking longer than 5 minutes. Please try again with shorter text.');
      } else {
        alert(`AI Task Parsing failed: ${msg}`);
      }
    } finally {
      setParsingAI(false);
    }
  };

  // Save all AI parsed tasks
  const handleSaveParsedTasks = async () => {
    try {
      setSavingParsed(true);
      for (const item of aiParsedTasks) {
        await api.createTodo({
          title: item.title,
          description: item.description,
          priority: item.priority,
          tags: item.tags,
          subtasks: item.subtasks,
          dueDate: item.dueDate,
          prompt: item.prompt,
          status: 'pending',
        });
      }
      setAiPreviewOpen(false);
      setPromptText('');
      await loadTodos();
    } catch (err: any) {
      alert(`Failed to save parsed tasks: ${err?.message || 'Error'}`);
    } finally {
      setSavingParsed(false);
    }
  };

  // Toggle status (completed <-> pending)
  const handleToggleTodo = async (todo: Todo) => {
    const nextStatus = todo.status === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t._id === todo._id ? { ...t, status: nextStatus } : t))
    );
    try {
      await api.updateTodo(todo._id, { status: nextStatus });
    } catch (err) {
      console.error('[TodoView] Toggle failed:', err);
      loadTodos();
    }
  };

  // Toggle subtask completion
  const handleToggleSubtask = async (todo: Todo, subtaskIndex: number) => {
    const updatedSubtasks = todo.subtasks.map((st, i) =>
      i === subtaskIndex ? { ...st, completed: !st.completed } : st
    );

    setTodos((prev) =>
      prev.map((t) => (t._id === todo._id ? { ...t, subtasks: updatedSubtasks } : t))
    );

    try {
      await api.updateTodo(todo._id, { subtasks: updatedSubtasks });
    } catch (err) {
      console.error('[TodoView] Subtask toggle failed:', err);
      loadTodos();
    }
  };

  // Add subtask
  const handleAddSubtask = async (todoId: string) => {
    const title = (newSubtaskTitle[todoId] || '').trim();
    if (!title) return;

    const target = todos.find((t) => t._id === todoId);
    if (!target) return;

    const nextSubtasks = [...target.subtasks, { title, completed: false }];
    setNewSubtaskTitle((prev) => ({ ...prev, [todoId]: '' }));

    setTodos((prev) =>
      prev.map((t) => (t._id === todoId ? { ...t, subtasks: nextSubtasks } : t))
    );

    try {
      await api.updateTodo(todoId, { subtasks: nextSubtasks });
    } catch (err) {
      console.error('[TodoView] Add subtask error:', err);
      loadTodos();
    }
  };

  // Delete task
  const handleDeleteTodo = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t._id !== id));
    try {
      await api.deleteTodo(id);
    } catch (err) {
      console.error('[TodoView] Delete failed:', err);
      loadTodos();
    }
  };

  // Clear completed
  const handleClearCompleted = async () => {
    try {
      await api.clearCompletedTodos();
      loadTodos();
    } catch (err) {
      console.error('[TodoView] Clear completed error:', err);
    }
  };

  // Create manual task
  const handleCreateManual = async () => {
    if (!manualTitle.trim()) return;
    try {
      const tags = manualTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.createTodo({
        title: manualTitle.trim(),
        description: manualDesc.trim(),
        priority: manualPriority,
        tags,
        status: 'pending',
      });
      setManualOpen(false);
      setManualTitle('');
      setManualDesc('');
      setManualTags('');
      loadTodos();
    } catch (err: any) {
      alert(`Failed to create task: ${err?.message || 'Error'}`);
    }
  };

  // Stats calculation
  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const pendingCount = totalCount - completedCount;

  // Unauthenticated user notice
  if (!user) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            maxWidth: 420,
            p: 4,
            borderRadius: 4,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#34d399' : '#059669',
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              My Tasks is Private
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
              Sign in to access your shared task list, create AI-structured todo items, and sync in real-time across all your devices and accounts.
            </Typography>
          </Box>
          <Button
            component={Link}
            href="/login"
            variant="contained"
            fullWidth
            startIcon={<LoginRoundedIcon />}
            sx={{
              borderRadius: 2.5,
              py: 1,
              backgroundColor: isDark ? '#10b981' : '#059669',
              '&:hover': {
                backgroundColor: isDark ? '#059669' : '#047857',
              },
            }}
          >
            Sign in
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        p: { xs: 2, sm: 3 },
        maxWidth: "100%",
        mx: 'auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2.5,
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {onBackToChat && (
            <IconButton onClick={onBackToChat} size="small" sx={{ color: 'text.secondary' }}>
              <ArrowBackRoundedIcon />
            </IconButton>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 2.5,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
            }}
          >
            <TaskAltRoundedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              My Tasks &amp; Todo
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Organize notes, reminders &amp; AI-structured tasks
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setManualOpen(true)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Manual Task
          </Button>
          {completedCount > 0 && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ClearAllRoundedIcon />}
              onClick={handleClearCompleted}
              sx={{ color: 'text.secondary', fontSize: '0.8rem' }}
            >
              Clear Done
            </Button>
          )}
        </Box>
      </Box>

      {/* AI Quick Task Input Bar (The Magic NLP Input) */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: 1,
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(99, 102, 241, 0.25)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%)',
          boxShadow: isDark
            ? '0 4px 20px rgba(139, 92, 246, 0.15)'
            : '0 4px 16px rgba(99, 102, 241, 0.06)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: '#8b5cf6' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#c4b5fd' : '#4f46e5' }}>
            AI Task Formatter &amp; Organizer
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Write messy thoughts in English or Arabic (e.g. <i>"deploy backend, fix mobile navbar bug before 5pm urgent, and send docs to team"</i>).
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={3}
            placeholder="Type or paste natural language tasks..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAIParse();
              }
            }}
            disabled={parsingAI}
            sx={{
              backgroundColor: isDark ? '#1e1f20' : '#ffffff',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAIParse}
            disabled={!promptText.trim() || parsingAI}
            startIcon={
              parsingAI ? (
                <CircularProgress size={16} sx={{ color: '#fff' }} />
              ) : (
                <AutoAwesomeRoundedIcon />
              )
            }
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: '#ffffff',
              borderRadius: 2,
              px: 2.5,
              whiteSpace: 'nowrap',
              fontWeight: 600,
              minWidth: 150,
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              },
            }}
          >
            {parsingAI ? 'Organizing… (may take up to 3 min)' : 'AI Structure'}
          </Button>
        </Box>
        {parsingAI && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            AI is structuring tasks + writing the agent execution prompt… please keep waiting, this can take
            2–3 minutes on long inputs.
          </Typography>
        )}
      </Paper>

      {/* Filter Tabs & Stats Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          pb: 1,
        }}
      >
        <Tabs
          value={filterTab}
          onChange={(_, val) => setFilterTab(val)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 1.5,
              fontSize: '0.825rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          <Tab value="all" label={`All (${totalCount})`} />
          <Tab value="pending" label={`Pending (${pendingCount})`} />
          <Tab value="completed" label={`Completed (${completedCount})`} />
        </Tabs>

        {/* Priority Filter Chips */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {['all', 'urgent', 'high', 'medium', 'low'].map((p) => {
            const isSelected = priorityFilter === p;
            return (
              <Chip
                key={p}
                size="small"
                label={p.charAt(0).toUpperCase() + p.slice(1)}
                onClick={() => setPriorityFilter(p)}
                clickable
                sx={{
                  height: 22,
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 500,
                  backgroundColor: isSelected
                    ? isDark
                      ? '#333'
                      : '#dde2ee'
                    : 'transparent',
                  border: 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Tasks List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : todos.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <TaskAltRoundedIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5, mb: 1.5 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            No tasks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use the AI prompt bar above to quickly organize notes into tasks, or create one manually.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {todos.map((todo) => {
            const isCompleted = todo.status === 'completed';
            const isExpanded = expandedTodoId === todo._id;
            const prioMeta = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium;
            const subtaskCompletedCount = (todo.subtasks || []).filter((s) => s.completed).length;

            return (
              <Paper
                key={todo._id}
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  p: 1.5,
                  backgroundColor: isDark
                    ? isCompleted
                      ? 'rgba(255,255,255,0.02)'
                      : '#1e1f20'
                    : isCompleted
                    ? '#f3f4f8'
                    : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(27,32,48,0.08)',
                  opacity: isCompleted ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(99, 102, 241, 0.3)',
                    boxShadow: isDark
                      ? '0 2px 10px rgba(0,0,0,0.3)'
                      : '0 2px 10px rgba(27,32,48,0.05)',
                  },
                }}
              >
                {/* Main Task Row */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Checkbox
                    checked={isCompleted}
                    onChange={() => handleToggleTodo(todo)}
                    icon={<RadioButtonUncheckedRoundedIcon />}
                    checkedIcon={<CheckCircleOutlineRoundedIcon sx={{ color: '#10b981' }} />}
                    sx={{ p: 0.5 }}
                  />

                  <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.925rem',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? 'text.secondary' : 'text.primary',
                        }}
                      >
                        {todo.title}
                      </Typography>

                      {/* Priority Badge */}
                      <Chip
                        size="small"
                        icon={<FlagRoundedIcon sx={{ fontSize: 13, color: `${prioMeta.color} !important` }} />}
                        label={prioMeta.label}
                        sx={{
                          height: 20,
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          backgroundColor: prioMeta.bg,
                          color: prioMeta.color,
                          borderRadius: 1,
                          '& .MuiChip-label': { px: 0.6 },
                        }}
                      />

                      {/* Tags */}
                      {todo.tags?.map((t) => (
                        <Chip
                          key={t}
                          size="small"
                          label={`#${t}`}
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(27,32,48,0.06)',
                            color: 'text.secondary',
                            borderRadius: 1,
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      ))}

                      {/* Due Date */}
                      {todo.dueDate && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <CalendarMonthRoundedIcon sx={{ fontSize: 13 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {new Date(todo.dueDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Description preview */}
                    {todo.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.825rem',
                          mb: 0.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {todo.description}
                      </Typography>
                    )}

                    {/* AI Agent Execution Prompt (Handoff) */}
                    {todo.prompt && (
                      <Box
                        sx={{
                          my: 0.75,
                          p: 1,
                          borderRadius: 1.5,
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(99, 102, 241, 0.06)',
                          border: 1,
                          borderColor: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <SmartToyOutlinedIcon sx={{ fontSize: 15, color: '#8b5cf6' }} />
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700, color: '#8b5cf6', fontSize: '0.72rem', letterSpacing: 0.3 }}
                            >
                              AGENT EXECUTION PROMPT
                            </Typography>
                          </Box>
                          <Tooltip title={copiedPromptId === todo._id ? 'Copied prompt!' : 'Copy prompt for AI agent'}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(todo.prompt || '');
                                setCopiedPromptId(todo._id);
                                setTimeout(() => setCopiedPromptId(null), 2500);
                              }}
                              sx={{ p: 0.25, color: '#8b5cf6' }}
                            >
                              {copiedPromptId === todo._id ? (
                                <CheckRoundedIcon sx={{ fontSize: 14 }} />
                              ) : (
                                <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.78rem',
                            color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 120,
                            overflowY: 'auto',
                            wordBreak: 'break-word',
                          }}
                        >
                          {todo.prompt}
                        </Typography>
                      </Box>
                    )}

                    {/* Subtasks Count Badge / Expand Toggle */}
                    {todo.subtasks && todo.subtasks.length > 0 && (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setExpandedTodoId(isExpanded ? null : todo._id)}
                        endIcon={isExpanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        sx={{
                          p: 0,
                          minWidth: 0,
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {subtaskCompletedCount} of {todo.subtasks.length} subtasks completed
                      </Button>
                    )}
                  </Box>

                  {/* Right Actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Expand / Add subtasks">
                      <IconButton
                        size="small"
                        onClick={() => setExpandedTodoId(isExpanded ? null : todo._id)}
                        sx={{ color: 'text.secondary' }}
                      >
                        {isExpanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete task">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteTodo(todo._id)}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Subtasks Collapsible Checklist */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      pl: 5,
                      pr: 1,
                      pt: 1.5,
                      borderTop: 1,
                      borderColor: 'divider',
                      mt: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75,
                    }}
                  >
                    {todo.subtasks?.map((st, idx) => (
                      <Box
                        key={st._id || idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={st.completed}
                          onChange={() => handleToggleSubtask(todo, idx)}
                          sx={{ p: 0.25 }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.825rem',
                            textDecoration: st.completed ? 'line-through' : 'none',
                            color: st.completed ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {st.title}
                        </Typography>
                      </Box>
                    ))}

                    {/* Add new subtask row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TextField
                        size="small"
                        placeholder="Add subtask..."
                        value={newSubtaskTitle[todo._id] || ''}
                        onChange={(e) =>
                          setNewSubtaskTitle((prev) => ({ ...prev, [todo._id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask(todo._id);
                          }
                        }}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.8rem' } }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAddSubtask(todo._id)}
                        disabled={!(newSubtaskTitle[todo._id] || '').trim()}
                        sx={{ height: 32, textTransform: 'none', fontSize: '0.75rem' }}
                      >
                        Add
                      </Button>
                    </Box>
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* AI Parsed Tasks Preview Modal */}
      <Dialog
        open={aiPreviewOpen}
        onClose={() => !savingParsed && setAiPreviewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeRoundedIcon sx={{ color: '#8b5cf6' }} />
          AI Structured Task Preview
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The AI organized your input into {aiParsedTasks.length} task(s). Review them before saving:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {aiParsedTasks.map((task, idx) => {
              const prioMeta = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
              return (
                <Paper
                  key={idx}
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 2, backgroundColor: 'action.hover' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {task.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={prioMeta.label}
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        backgroundColor: prioMeta.bg,
                        color: prioMeta.color,
                      }}
                    />
                  </Box>
                  {task.description && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.75 }}>
                      {task.description}
                    </Typography>
                  )}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <Box sx={{ pl: 1, borderLeft: 2, borderColor: 'primary.main', mb: 0.5 }}>
                      {task.subtasks.map((st, i) => (
                        <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                          • {st.title}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      {task.tags.map((t) => (
                        <Chip key={t} size="small" label={`#${t}`} sx={{ height: 16, fontSize: '0.625rem' }} />
                      ))}
                    </Box>
                  )}
                  {task.prompt && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                        border: 1,
                        borderColor: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(99, 102, 241, 0.2)',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <SmartToyOutlinedIcon sx={{ fontSize: 13, color: '#8b5cf6' }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#8b5cf6', fontSize: '0.68rem' }}>
                          EXECUTION PROMPT:
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          whiteSpace: 'pre-wrap',
                          maxHeight: 80,
                          overflowY: 'auto',
                        }}
                      >
                        {task.prompt}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAiPreviewOpen(false)} disabled={savingParsed} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveParsedTasks}
            disabled={savingParsed}
            startIcon={savingParsed ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <TaskAltRoundedIcon />}
            sx={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: '#ffffff',
            }}
          >
            {savingParsed ? 'Saving...' : 'Add All to My Tasks'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Add Task Dialog */}
      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Task</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            label="Task Title *"
            fullWidth
            size="small"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={2}
            size="small"
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(['low', 'medium', 'high', 'urgent'] as TodoPriority[]).map((p) => {
              const isSelected = manualPriority === p;
              const meta = PRIORITY_COLORS[p];
              return (
                <Chip
                  key={p}
                  label={meta.label}
                  onClick={() => setManualPriority(p)}
                  clickable
                  sx={{
                    flex: 1,
                    fontWeight: 700,
                    backgroundColor: isSelected ? meta.color : meta.bg,
                    color: isSelected ? '#ffffff' : meta.color,
                  }}
                />
              );
            })}
          </Box>
          <TextField
            label="Tags (comma-separated e.g. dev, bug)"
            fullWidth
            size="small"
            value={manualTags}
            onChange={(e) => setManualTags(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setManualOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateManual}
            disabled={!manualTitle.trim()}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
