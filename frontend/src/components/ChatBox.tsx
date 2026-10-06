'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { api } from '@/lib/api';

export type InputMode = 'chat' | 'ai';

interface ChatBoxProps {
  onSendMessage: (text: string, imageUrl?: string, mode?: InputMode) => Promise<void>;
  disabled?: boolean;
  isReadOnly?: boolean;
  mode?: InputMode;
  onToggleMode?: () => void;
  aiGenerating?: boolean;
  placeholder?: string;
}

export default function ChatBox({
  onSendMessage,
  disabled,
  isReadOnly,
  mode = 'chat',
  onToggleMode,
  aiGenerating,
  placeholder,
}: ChatBoxProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut listener for Tab key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (typeof onToggleMode === 'function') {
        onToggleMode();
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (isReadOnly || aiGenerating) return;
    const trimmed = text.trim();
    if (!trimmed && !pendingImageUrl) return;

    try {
      const img = pendingImageUrl || undefined;
      setText('');
      setPendingImageUrl(null);
      await onSendMessage(trimmed, img, mode);
    } catch (err: any) {
      alert(`Failed to send: ${err?.message || 'Error'}`);
    }
  };

  const handleUploadFile = async (file: File) => {
    try {
      setUploading(true);
      const res = await api.uploadFile(file);
      setPendingImageUrl(res.data.url);
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleUploadFile(file);
          break;
        }
      }
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isReadOnly) {
    return (
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            py: 1.25,
            // px: 3,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            backgroundColor: 'action.hover',
            maxWidth: { sm: '70%', xs: '100%' },
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Viewing archived conversation (Read-Only). Switch to <strong>Live Chat</strong> or click <strong>+ New chat</strong> to post.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const isAIMode = mode === 'ai';

  return (
    <Box
      sx={{
        p: { xs: 1.25, sm: 2.5 },
        pb: { xs: 'calc(10px + env(safe-area-inset-bottom, 0px))', sm: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: "100%" }}>
        
        {/* Mode Selector Header Pill Bar with Tab Shortcut Indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            px: 1,
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              p: 0.5,
              borderRadius: 2,
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? '#262626' : '#eceff6',
              border: 1,
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? '#333333' : '#e3e7f0',
            }}
          >
            {/* Chat Mode Pill */}
            <Chip
              size="small"
              icon={<ForumRoundedIcon sx={{ fontSize: 16 }} />}
              label="Chat"
              onClick={() => mode !== 'chat' && onToggleMode?.()}
              clickable
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: 2,
                backgroundColor: !isAIMode ? 'primary.main' : 'transparent',
                color: !isAIMode ? 'primary.contrastText' : 'text.secondary',
                '&:hover': {
                  backgroundColor: !isAIMode ? 'primary.main' : 'action.hover',
                },
              }}
            />

            {/* AI Mode Pill */}
            <Chip
              size="small"
              icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
              label="AI Mode"
              onClick={() => mode !== 'ai' && onToggleMode?.()}
              clickable
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: 2,
                background: isAIMode
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                  : 'transparent',
                color: isAIMode ? '#ffffff' : 'text.secondary',
                boxShadow: isAIMode ? '0 2px 10px rgba(139, 92, 246, 0.4)' : 'none',
                '&:hover': {
                  background: isAIMode
                    ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                    : 'action.hover',
                },
              }}
            />
          </Box>

          {/* Tab Key Badge */}
          <Tooltip title="Press the Tab key on your keyboard to switch between Chat and AI mode">
            <Box
              onClick={() => onToggleMode?.()}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                cursor: 'pointer',
                opacity: 0.8,
                '&:hover': { opacity: 1 },
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                Switch mode
              </Typography>
              <Box
                component="kbd"
                sx={{
                  px: 0.8,
                  py: 0.25,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  borderRadius: 1,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark' ? '#333333' : '#dde2ee',
                  color: 'text.primary',
                  border: 1,
                  borderColor: (theme) =>
                    theme.palette.mode === 'dark' ? '#444444' : '#cdd3e0',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.2)',
                }}
              >
                Tab
              </Box>
            </Box>
          </Tooltip>
        </Box>

        {/* Pending image preview capsule */}
        {pendingImageUrl && (
          <Paper
            variant="outlined"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              mb: 1.5,
              borderRadius: 2,
              backgroundColor: 'action.hover',
            }}
          >
            <Box
              component="img"
              src={pendingImageUrl}
              alt="pending upload"
              sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 2 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Image ready to send
            </Typography>
            <IconButton size="small" onClick={() => setPendingImageUrl(null)}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Paper>
        )}

        {/* Floating prompt capsule (changes border glow according to mode) */}
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            p: 1,
            borderRadius: 2,
            border: 1,
            borderColor: (theme) =>
              isAIMode
                ? theme.palette.mode === 'dark'
                  ? '#8b5cf6'
                  : '#a78bfa'
                : theme.palette.mode === 'dark'
                ? '#3c4043'
                : '#e3e7f0',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? '#1e1f20' : '#ffffff',
            boxShadow: (theme) =>
              isAIMode
                ? '0 4px 24px rgba(139, 92, 246, 0.25)'
                : theme.palette.mode === 'dark'
                ? '0 4px 20px rgba(0,0,0,0.4)'
                : '0 2px 12px rgba(27,32,48,0.08)',
            transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
            '&:focus-within': {
              borderColor: isAIMode ? '#8b5cf6' : 'primary.main',
              boxShadow: (theme) =>
                isAIMode
                  ? '0 4px 28px rgba(139, 92, 246, 0.35)'
                  : theme.palette.mode === 'dark'
                  ? '0 4px 24px rgba(138, 180, 248, 0.15)'
                  : '0 4px 16px rgba(79, 70, 229, 0.15)',
            },
          }}
        >
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={onFileInputChange}
          />

          {/* Attachment button */}
          <Tooltip title="Attach image or document (or paste screenshot directly)">
            <span>
              <IconButton
                color="inherit"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || disabled || aiGenerating}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                  p: 1,
                }}
              >
                {uploading ? <CircularProgress size={20} /> : <AttachFileRoundedIcon />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Text input */}
          <TextField
            inputRef={textareaRef}
            fullWidth
            multiline
            maxRows={6}
            placeholder={
              placeholder ||
              (isAIMode
                ? 'Ask AI anything... (Press Tab for Chat mode, Enter to send)'
                : 'Type a message or paste a link/image... (Press Tab for AI mode)')
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || aiGenerating}
            variant="standard"
            slotProps={{
              input: {
                disableUnderline: true,
                sx: {
                  py: 0.75,
                  fontSize: '0.925rem',
                  color: 'text.primary',
                },
              },
            }}
          />

          {/* Send button (Pill with icon matching current mode) */}
          <Tooltip title={isAIMode ? 'Ask AI (Enter)' : 'Send message (Enter)'}>
            <span>
              <IconButton
                onClick={handleSend}
                disabled={(!text.trim() && !pendingImageUrl) || disabled || uploading || aiGenerating}
                sx={{
                  p: 1,
                  background: isAIMode
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                    : 'primary.main',
                  color: '#ffffff',
                  borderRadius: '2px',
                  '&:hover': {
                    background: isAIMode
                      ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                      : 'primary.dark',
                  },
                  '&.Mui-disabled': {
                    background: 'action.disabledBackground',
                    color: 'action.disabled',
                  },
                }}
              >
                {aiGenerating ? (
                  <CircularProgress size={20} sx={{ color: '#fff' }} />
                ) : isAIMode ? (
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 20 }} />
                ) : (
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 20, fontWeight: 700 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Paper>

        <Typography
          variant="caption"
          align="center"
          sx={{ display: 'block', mt: 1, color: 'text.secondary', opacity: 0.75, fontSize: '0.72rem' }}
        >
          {isAIMode
            ? '✨ AI Mode powered by llama.cpp (myai.lmstream.xyz). Press Tab to return to Chat.'
            : '💬 Chat Mode. Messages sync across all devices via SSE. Press Tab for AI Mode.'}
        </Typography>
      </Box>
    </Box>
  );
}
