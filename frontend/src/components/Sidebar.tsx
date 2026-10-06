'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Divider,
  Paper,
  Tooltip,
  Chip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import Brightness7RoundedIcon from '@mui/icons-material/Brightness7Rounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { Conversation, User, AITool, api, getOrCreateDeviceId, getDeviceLabel, setDeviceLabel } from '@/lib/api';
import { useColorMode } from '@/theme/ColorModeContext';
import Link from 'next/link';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  tools?: AITool[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  user: User | null;
  onLogout: () => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin?: (id: string, isPinned?: boolean) => Promise<void>;
  isMobile: boolean;
}

function getSidebarToolIcon(iconName?: string) {
  switch (iconName) {
    case 'translate':
      return TranslateRoundedIcon;
    case 'code':
      return CodeRoundedIcon;
    case 'terminal':
      return TerminalRoundedIcon;
    case 'psychology':
      return PsychologyRoundedIcon;
    case 'storage':
      return StorageRoundedIcon;
    case 'security':
      return SecurityRoundedIcon;
    default:
      return AutoAwesomeRoundedIcon;
  }
}

export default function Sidebar({
  isOpen,
  onToggle,
  conversations,
  tools = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  user,
  onLogout,
  onRename,
  onDelete,
  onTogglePin,
  isMobile,
}: SidebarProps) {
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === 'dark';

  // Menu states
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

  // Rename Dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Device identity states
  const [sidebarDeviceId, setSidebarDeviceId] = useState('');
  const [sidebarDeviceLabel, setSidebarDeviceLabel] = useState('');
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [newDeviceLabel, setNewDeviceLabel] = useState('');

  // Tools collapsible state (click-to-toggle; user choice sticks on all screens)
  const [toolsExpanded, setToolsExpanded] = useState(true);

  // Pinned conversations (sorted chronologically)
  const pinnedConversations = React.useMemo(() => {
    return conversations
      .filter((c) => Boolean(c.isPinned))
      .sort((a, b) => {
        const timeA = new Date(a.archivedAt || a.createdAt).getTime();
        const timeB = new Date(b.archivedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [conversations]);

  // Unpinned / Recent conversations (sorted chronologically)
  const recentConversations = React.useMemo(() => {
    return conversations
      .filter((c) => !c.isPinned)
      .sort((a, b) => {
        const timeA = new Date(a.archivedAt || a.createdAt).getTime();
        const timeB = new Date(b.archivedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [conversations]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = getOrCreateDeviceId();
      const label = getDeviceLabel();
      setSidebarDeviceId(id);
      setSidebarDeviceLabel(label);
      setNewDeviceLabel(label);

      const handleDeviceChange = (e: any) => {
        if (e.detail?.label) {
          setSidebarDeviceLabel(e.detail.label);
          setNewDeviceLabel(e.detail.label);
        }
      };
      window.addEventListener('mychats:device-changed', handleDeviceChange);
      return () => window.removeEventListener('mychats:device-changed', handleDeviceChange);
    }
  }, []);

  const handleSaveSidebarDeviceLabel = () => {
    if (newDeviceLabel.trim()) {
      setDeviceLabel(newDeviceLabel.trim());
      setSidebarDeviceLabel(newDeviceLabel.trim());
      setDeviceModalOpen(false);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, conv: Conversation) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedConv(conv);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
  };

  const handleTogglePin = async () => {
    if (selectedConv && onTogglePin) {
      const nextPinned = !selectedConv.isPinned;
      handleCloseMenu();
      await onTogglePin(selectedConv._id, nextPinned);
    } else {
      handleCloseMenu();
    }
  };

  const handleTriggerRename = () => {
    if (selectedConv) {
      setRenameTitle(selectedConv.title);
      setRenameDialogOpen(true);
    }
    handleCloseMenu();
  };

  const handleConfirmRename = async () => {
    if (selectedConv && renameTitle.trim()) {
      await onRename(selectedConv._id, renameTitle.trim());
      setRenameDialogOpen(false);
    }
  };

  const handleTriggerDelete = () => {
    setDeleteDialogOpen(true);
    handleCloseMenu();
  };

  const handleConfirmDelete = async () => {
    if (selectedConv) {
      await onDelete(selectedConv._id);
      setDeleteDialogOpen(false);
    }
  };


  const sidebarContent = (
    <Box
      sx={{
        width: 270,
        height: '100%',
        maxHeight: { xs: '100dvh', md: '100%' },
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDark ? '#171717' : '#eef1f7',
        borderRight: 1,
        borderColor: isDark ? '#262626' : '#e3e7f0',
        p: 2,
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Top Header: Brand & Close button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeRoundedIcon
            sx={{
              color: isDark ? '#8ab4f8' : '#4f46e5',
              fontSize: 22,
            }}
          />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              letterSpacing: -0.3,
              color: isDark ? '#f3f4f6' : '#1b2030',
            }}
          >
            MyChats AI
          </Typography>
        </Box>

        {isMobile && (
          <IconButton size="small" onClick={onToggle}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* "+ New chat" pill button (Gemini / ChatGPT Signature Style) */}
      <Button
        variant="contained"
        fullWidth
        onClick={onNewChat}
        startIcon={<AddRoundedIcon />}
        sx={{
          py: 1.1,
          px: 2,
          borderRadius: 6,
          backgroundColor: isDark ? '#262626' : '#ffffff',
          color: isDark ? '#ffffff' : '#1b2030',
          border: 1,
          borderColor: isDark ? '#404040' : '#dde2ee',
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06)',
          justifyContent: 'flex-start',
          fontWeight: 600,
          fontSize: '0.875rem',
          mb: 2.5,
          '&:hover': {
            backgroundColor: isDark ? '#333333' : '#e4e8f1',
            borderColor: isDark ? '#525252' : '#cdd3e0',
            boxShadow: isDark
              ? '0 2px 6px rgba(0,0,0,0.6)'
              : '0 2px 6px rgba(0,0,0,0.08)',
          },
        }}
      >
        New chat
      </Button>

      {/* Collapsible Tools Section: Accessible on both mobile and desktop */}
      <Box
        sx={{
          mb: 1.5,
          borderRadius: 2.5,
          border: 1,
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(27, 32, 48, 0.08)',
          backgroundColor: (theme) =>
            toolsExpanded
              ? theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(255, 255, 255, 0.95)'
              : theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.02)'
              : 'rgba(27, 32, 48, 0.02)',
          boxShadow: toolsExpanded
            ? (theme) =>
                theme.palette.mode === 'dark' ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(27,32,48,0.06)'
            : 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0,
          maxHeight: toolsExpanded ? { xs: '42dvh', sm: 480 } : 44,
          // Click-only toggle: hover must NOT force-expand, otherwise the
          // section springs back open and can never be closed.
          '&:hover': {
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(99, 102, 241, 0.25)',
          },
        }}
      >
        {/* Header bar that toggles on click and acts as hover anchor */}
        <Box
          onClick={() => setToolsExpanded((prev) => !prev)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.25,
            py: 1,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <AutoAwesomeRoundedIcon
              sx={{
                fontSize: 15,
                color: (theme) => (theme.palette.mode === 'dark' ? '#a78bfa' : '#6366f1'),
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontSize: '0.7rem',
                color: isDark ? '#e5e7eb' : '#1b2030',
              }}
            >
              Tools &amp; AI
            </Typography>
            <Chip
              label={1 + (tools?.length || 1)}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.625rem',
                fontWeight: 700,
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.12)',
                color: (theme) => (theme.palette.mode === 'dark' ? '#c4b5fd' : '#4f46e5'),
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {user && (
              <Tooltip title="AI Tools Studio (Create & Manage)">
                <IconButton
                  component={Link}
                  href="/tools"
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    p: 0.25,
                    color: isDark ? '#a78bfa' : '#6366f1',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                    },
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
            <ExpandMoreRoundedIcon
              className="tools-header-chevron"
              sx={{
                fontSize: 16,
                color: 'text.secondary',
                transition: 'transform 0.25s ease',
                transform: toolsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </Box>
        </Box>

        {/* Collapsible Content: Fully accessible on click & hover */}
        <Box
          className="tools-collapse-content"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            px: 1,
            pb: 1,
            pt: 0.25,
            opacity: toolsExpanded ? 1 : 0,
            transform: toolsExpanded ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'all 0.2s ease',
            pointerEvents: toolsExpanded ? 'auto' : 'none',
            maxHeight: { xs: 'calc(42dvh - 60px)', sm: 420 },
            overflowY: 'auto',
            // Touch momentum scrolling for mobile nested list
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
          }}
        >
          {/* 1. Dedicated "My Tasks" (Todo) Button */}
          <Box
            onClick={() => onSelectConversation('todo')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.25,
              py: 0.85,
              borderRadius: 2,
              cursor: 'pointer',
              backgroundColor:
                activeConversationId === 'todo'
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(5, 150, 105, 0.12)'
                  : 'transparent',
              border: 1,
              borderColor:
                activeConversationId === 'todo'
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.45)'
                    : 'rgba(5, 150, 105, 0.3)'
                  : 'transparent',
              color: activeConversationId === 'todo' ? (isDark ? '#6ee7b7' : '#059669') : 'inherit',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: isDark ? '#262626' : '#e4e8f1',
              },
            }}
          >
            <TaskAltRoundedIcon
              sx={{
                fontSize: 18,
                color: activeConversationId === 'todo' ? (isDark ? '#34d399' : '#059669') : '#10b981',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: activeConversationId === 'todo' ? 700 : 600,
                    fontSize: '0.825rem',
                    lineHeight: 1.2,
                  }}
                >
                  My Tasks
                </Typography>
                <Chip
                  label="Todo"
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.12)',
                    color: (theme) => (theme.palette.mode === 'dark' ? '#6ee7b7' : '#059669'),
                    '& .MuiChip-label': { px: 0.4 },
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.67rem',
                  color: isDark ? '#9ca3af' : '#5b6478',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                AI-organized task manager
              </Typography>
            </Box>
          </Box>

          {/* 2. Custom Tools and Technical Translator */}
          {tools && tools.length > 0 ? (
            <>
              {tools.map((tool) => {
                const isActive =
                  activeConversationId === tool._id ||
                  (tool.name === 'Technical Translator' && activeConversationId === 'translator');
                const IconComp = getSidebarToolIcon(tool.icon);

                return (
                  <Box
                    key={tool._id}
                    onClick={() => onSelectConversation(tool._id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 0.85,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      backgroundColor: isActive
                        ? isDark
                          ? 'rgba(139, 92, 246, 0.22)'
                          : 'rgba(99, 102, 241, 0.12)'
                        : 'transparent',
                      border: 1,
                      borderColor: isActive
                        ? isDark
                          ? 'rgba(167, 139, 250, 0.45)'
                          : 'rgba(99, 102, 241, 0.35)'
                        : 'transparent',
                      color: isActive ? (isDark ? '#c4b5fd' : '#4f46e5') : 'inherit',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        backgroundColor: isDark ? '#262626' : '#e4e8f1',
                      },
                    }}
                  >
                    <IconComp
                      sx={{
                        fontSize: 18,
                        color: isActive
                          ? isDark
                            ? '#a78bfa'
                            : '#6366f1'
                          : isDark
                          ? '#9ca3af'
                          : '#5b6478',
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '0.825rem',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tool.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.67rem',
                          color: isDark ? '#9ca3af' : '#5b6478',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tool.description || 'AI Tool'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}

              {!tools.some((t) => t.name === 'Technical Translator') && (
                <Box
                  onClick={() => onSelectConversation('translator')}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1.5,
                    py: 0.85,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    backgroundColor:
                      activeConversationId === 'translator'
                        ? isDark
                          ? 'rgba(139, 92, 246, 0.22)'
                          : 'rgba(99, 102, 241, 0.12)'
                        : 'transparent',
                    border: 1,
                    borderColor:
                      activeConversationId === 'translator'
                        ? isDark
                          ? 'rgba(167, 139, 250, 0.45)'
                          : 'rgba(99, 102, 241, 0.35)'
                        : 'transparent',
                    color: activeConversationId === 'translator' ? (isDark ? '#c4b5fd' : '#4f46e5') : 'inherit',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: isDark ? '#262626' : '#e4e8f1',
                    },
                  }}
                >
                  <TranslateRoundedIcon
                    sx={{
                      fontSize: 18,
                      color: activeConversationId === 'translator' ? (isDark ? '#a78bfa' : '#6366f1') : isDark ? '#9ca3af' : '#5b6478',
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: activeConversationId === 'translator' ? 700 : 500,
                        fontSize: '0.825rem',
                        lineHeight: 1.2,
                      }}
                    >
                      Technical Translator
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.67rem',
                        color: isDark ? '#9ca3af' : '#5b6478',
                        display: 'block',
                      }}
                    >
                      Arabic ➔ AI Prompt
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Box
              onClick={() => onSelectConversation('translator')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 0.85,
                borderRadius: 2.5,
                cursor: 'pointer',
                backgroundColor:
                  activeConversationId === 'translator'
                    ? isDark
                      ? 'rgba(139, 92, 246, 0.22)'
                      : 'rgba(99, 102, 241, 0.12)'
                    : 'transparent',
                border: 1,
                borderColor:
                  activeConversationId === 'translator'
                    ? isDark
                      ? 'rgba(167, 139, 250, 0.45)'
                      : 'rgba(99, 102, 241, 0.35)'
                    : 'transparent',
                color: activeConversationId === 'translator' ? (isDark ? '#c4b5fd' : '#4f46e5') : 'inherit',
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: isDark ? '#262626' : '#e4e8f1',
                },
              }}
            >
              <TranslateRoundedIcon
                sx={{
                  fontSize: 18,
                  color: activeConversationId === 'translator' ? (isDark ? '#a78bfa' : '#6366f1') : isDark ? '#9ca3af' : '#5b6478',
                  flexShrink: 0,
                }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: activeConversationId === 'translator' ? 700 : 500,
                    fontSize: '0.825rem',
                    lineHeight: 1.2,
                  }}
                >
                  Technical Translator
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.67rem',
                    color: isDark ? '#9ca3af' : '#5b6478',
                    display: 'block',
                  }}
                >
                  Arabic ➔ AI Prompt
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Section Label: Live Chat is always accessible */}
      <Typography
        variant="caption"
        sx={{
          px: 1,
          pb: 1,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontSize: '0.6875rem',
          color: isDark ? '#9ca3af' : '#5b6478',
        }}
      >
        Chats
      </Typography>

      {/* Conversations List */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          pr: 0.5,
        }}
      >
        {/* Live Active Conversation Entry (Visible to everyone) */}
        <Box
          onClick={() => onSelectConversation('live')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 1,
            borderRadius: 2.5,
            cursor: 'pointer',
            backgroundColor:
              activeConversationId === 'live'
                ? isDark
                  ? '#262626'
                  : '#dde2ee'
                : 'transparent',
            color: activeConversationId === 'live' ? (isDark ? '#fff' : '#1b2030') : 'inherit',
            '&:hover': {
              backgroundColor: isDark ? '#262626' : '#e4e8f1',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981',
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: activeConversationId === 'live' ? 700 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.84rem',
              }}
            >
              Live Chat
            </Typography>
          </Box>
        </Box>

        {/* If user is logged in: SHOW PINNED & RECENT CHATS ARCHIVES */}
        {user ? (
          <>
            {/* 1. DEDICATED PINNED SECTION (At the top of archived chats) */}
            {pinnedConversations.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, pt: 1.5, pb: 0.5 }}>
                  <PushPinRoundedIcon
                    sx={{
                      fontSize: 13,
                      color: isDark ? '#818cf8' : '#4f46e5',
                      transform: 'rotate(45deg)',
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      fontSize: '0.6875rem',
                      color: isDark ? '#818cf8' : '#4f46e5',
                    }}
                  >
                    Pinned
                  </Typography>
                </Box>

                {pinnedConversations.map((conv) => {
                  const isActive = activeConversationId === conv._id;
                  return (
                    <Box
                      key={conv._id}
                      onClick={() => onSelectConversation(conv._id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1.5,
                        py: 0.85,
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        backgroundColor: isActive ? (isDark ? '#262626' : '#dde2ee') : 'transparent',
                        color: isActive ? (isDark ? '#fff' : '#1b2030') : 'inherit',
                        '&:hover': {
                          backgroundColor: isDark ? '#262626' : '#e4e8f1',
                          '& .more-btn': { opacity: 1 },
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
                        <PushPinRoundedIcon
                          sx={{
                            fontSize: 16,
                            color: isDark ? '#818cf8' : '#4f46e5',
                            flexShrink: 0,
                            transform: 'rotate(45deg)',
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isActive ? 600 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.825rem',
                            color: isDark ? '#e5e7eb' : '#2f3646',
                          }}
                        >
                          {conv.title}
                        </Typography>
                      </Box>

                      {/* 3-dots actions trigger */}
                      <IconButton
                        className="more-btn"
                        size="small"
                        onClick={(e) => handleOpenMenu(e, conv)}
                        sx={{
                          opacity: isActive ? 1 : 0,
                          transition: 'opacity 0.15s ease',
                          p: 0.25,
                          color: isDark ? '#9ca3af' : '#5b6478',
                        }}
                      >
                        <MoreHorizRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </>
            )}

            {/* 2. RECENT CHATS SECTION (Exclusively unpinned conversations) */}
            {recentConversations.length > 0 && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  pt: 1.5,
                  pb: 0.5,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  fontSize: '0.6875rem',
                  color: isDark ? '#9ca3af' : '#5b6478',
                }}
              >
                Recent Chats
              </Typography>
            )}

            {recentConversations.map((conv) => {
              const isActive = activeConversationId === conv._id;
              return (
                <Box
                  key={conv._id}
                  onClick={() => onSelectConversation(conv._id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 0.85,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    backgroundColor: isActive ? (isDark ? '#262626' : '#dde2ee') : 'transparent',
                    color: isActive ? (isDark ? '#fff' : '#1b2030') : 'inherit',
                    '&:hover': {
                      backgroundColor: isDark ? '#262626' : '#e4e8f1',
                      '& .more-btn': { opacity: 1 },
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
                    <ChatBubbleOutlineRoundedIcon
                      sx={{
                        fontSize: 18,
                        color: isDark ? '#9ca3af' : '#5b6478',
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isActive ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.825rem',
                        color: isDark ? '#e5e7eb' : '#2f3646',
                      }}
                    >
                      {conv.title}
                    </Typography>
                  </Box>

                  {/* 3-dots actions trigger */}
                  <IconButton
                    className="more-btn"
                    size="small"
                    onClick={(e) => handleOpenMenu(e, conv)}
                    sx={{
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      p: 0.25,
                      color: isDark ? '#9ca3af' : '#5b6478',
                    }}
                  >
                    <MoreHorizRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </>
        ) : (
          /* If user is NOT logged in: HIDE RECENT CHATS and show private notice */
          <Paper
            variant="outlined"
            sx={{
              mt: 2,
              p: 1.75,
              borderRadius: 3,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? '#262626' : '#e3e7f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <LockOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Recent Chats Private
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.4 }}>
              Sign in as owner to view and manage your conversation history &amp; archives.
            </Typography>
            <Button
              component={Link}
              href="/login"
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<LoginRoundedIcon />}
              sx={{
                borderRadius: 2,
                fontSize: '0.75rem',
                py: 0.5,
                mt: 0.5,
              }}
            >
              Sign in
            </Button>
          </Paper>
        )}
      </Box>

      <Divider sx={{ my: 1.5, borderColor: isDark ? '#262626' : '#e3e7f0' }} />

      {/* Bottom Footer Section: Theme Toggle, Admin Link, User Profile */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* Dark / Light Toggle Option */}
        <Box
          onClick={toggleColorMode}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 0.85,
            borderRadius: 2,
            cursor: 'pointer',
            '&:hover': { backgroundColor: isDark ? '#262626' : '#e4e8f1' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {isDark ? (
              <Brightness7RoundedIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
            ) : (
              <Brightness4RoundedIcon sx={{ fontSize: 18, color: '#6366f1' }} />
            )}
            <Typography variant="body2" sx={{ fontSize: '0.825rem', fontWeight: 500 }}>
              {isDark ? 'Light mode' : 'Dark mode'}
            </Typography>
          </Box>
        </Box>

        {/* Admin Dashboard link (only shown to logged-in user) */}
        {user && (
          <>
            <Box
              component={Link}
              href="/tools"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 0.85,
                borderRadius: 2,
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': { backgroundColor: isDark ? '#262626' : '#e4e8f1' },
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: '#8b5cf6' }} />
              <Typography variant="body2" sx={{ fontSize: '0.825rem', fontWeight: 500 }}>
                AI Studio &amp; Tools
              </Typography>
            </Box>

            <Box
              component={Link}
              href="/admin"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 0.85,
                borderRadius: 2,
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': { backgroundColor: isDark ? '#262626' : '#e4e8f1' },
              }}
            >
              <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18, color: isDark ? '#9ca3af' : '#5b6478' }} />
              <Typography variant="body2" sx={{ fontSize: '0.825rem', fontWeight: 500 }}>
                Admin Archive
              </Typography>
            </Box>
          </>
        )}

        {/* Device Identity Card */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <DevicesRoundedIcon sx={{ fontSize: 16, color: isDark ? '#a78bfa' : '#6366f1', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.725rem',
                  display: 'block',
                  color: isDark ? '#e5e7eb' : '#2f3646',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sidebarDeviceLabel}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.62rem',
                  color: isDark ? '#9ca3af' : '#5b6478',
                  display: 'block',
                }}
              >
                ID: {sidebarDeviceId.slice(0, 10)}... (Device Scope)
              </Typography>
            </Box>
          </Box>

          <Tooltip title="Rename this device's label">
            <IconButton
              size="small"
              onClick={() => setDeviceModalOpen(true)}
              sx={{ p: 0.5, color: isDark ? '#9ca3af' : '#5b6478' }}
            >
              <EditRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* User Profile / Auth */}
        {user ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
              py: 0.75,
              borderRadius: 2,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Avatar
                src={user.avatarUrl}
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: '0.75rem',
                  backgroundColor: isDark ? '#3b82f6' : '#1d4ed8',
                }}
              >
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </Avatar>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.username}
              </Typography>
            </Box>

            <Tooltip title="Log out">
              <IconButton size="small" onClick={onLogout} color="inherit">
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Button
            component={Link}
            href="/login"
            variant="outlined"
            size="small"
            fullWidth
            startIcon={<LoginRoundedIcon />}
            sx={{
              borderRadius: 2,
              borderColor: isDark ? '#404040' : '#cdd3e0',
              color: 'inherit',
              py: 0.75,
              fontSize: '0.8rem',
            }}
          >
            Sign in
          </Button>
        )}
      </Box>

      {/* Hover 3-dots Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              minWidth: 160,
              boxShadow: isDark
                ? '0 8px 24px rgba(0,0,0,0.6)'
                : '0 8px 24px rgba(0,0,0,0.12)',
              border: 1,
              borderColor: isDark ? '#333' : '#dde2ee',
            },
          },
        }}
      >
        {selectedConv && (
          <MenuItem onClick={handleTogglePin}>
            <ListItemIcon>
              {selectedConv.isPinned ? (
                <PushPinRoundedIcon fontSize="small" sx={{ color: isDark ? '#818cf8' : '#4f46e5', transform: 'rotate(45deg)' }} />
              ) : (
                <PushPinOutlinedIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography sx={{ fontSize: '0.85rem' }}>
                  {selectedConv.isPinned ? 'Unpin chat' : 'Pin to top'}
                </Typography>
              }
            />
          </MenuItem>
        )}

        <MenuItem onClick={handleTriggerRename}>
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography sx={{ fontSize: '0.85rem' }}>Rename</Typography>} />
        </MenuItem>

        {selectedConv && (
          <MenuItem
            component="a"
            href={api.getExportUrl(selectedConv._id, 'md')}
            download
            onClick={handleCloseMenu}
          >
            <ListItemIcon>
              <FileDownloadOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={<Typography sx={{ fontSize: '0.85rem' }}>Export Markdown</Typography>} />
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleTriggerDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={<Typography sx={{ fontSize: '0.85rem' }}>Delete</Typography>} />
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Rename conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setRenameDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirmRename}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Delete conversation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete "{selectedConv?.title}"? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Device Identity Dialog */}
      <Dialog open={deviceModalOpen} onClose={() => setDeviceModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Device Identity & Label</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          <Typography variant="body2" color="text.secondary">
            Tools (Translation, AI Tools) are scoped exclusively to this device.
          </Typography>
          <TextField
            label="Device ID"
            value={sidebarDeviceId}
            size="small"
            slotProps={{ input: { readOnly: true } }}
          />
          <TextField
            label="Device Label"
            value={newDeviceLabel}
            onChange={(e) => setNewDeviceLabel(e.target.value)}
            size="small"
            placeholder="e.g. 💻 Work Laptop, 📱 iPhone"
          />
          {/* Quick suggestions */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {['💻 Laptop', '📱 Phone', '🖥️ Desktop', '📟 Tablet'].map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                clickable
                onClick={() => setNewDeviceLabel(tag)}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeviceModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveSidebarDeviceLabel}>
            Save Label
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer Overlay: visible on xs/sm screens */}
      <Box
        sx={{
          display: { xs: isOpen ? 'block' : 'none', md: 'none' },
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100dvh',
          maxHeight: '100dvh',
          zIndex: 1300,
        }}
      >
        {/* Backdrop */}
        <Box
          onClick={onToggle}
          sx={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1299,
          }}
        />
        <Box
          sx={{
            position: 'relative',
            zIndex: 1300,
            height: '100%',
            maxHeight: '100dvh',
            display: 'flex',
          }}
        >
          {sidebarContent}
        </Box>
      </Box>

      {/* Desktop Sidebar: static layout for md+ screens */}
      <Box
        sx={{
          display: { xs: 'none', md: isOpen ? 'block' : 'none' },
          height: '100%',
        }}
      >
        {sidebarContent}
      </Box>
    </>
  );
}
