'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MarkdownRenderer from './MarkdownRenderer';
import { BACKEND_URL, Message } from '@/lib/api';

interface MessageListProps {
  messages: Message[];
  currentUserId?: string | null;
  onDeleteMessage?: (id: string) => Promise<void>;
  isReadOnly?: boolean;
  aiGenerating?: boolean;
}

export default function MessageList({
  messages,
  currentUserId,
  onDeleteMessage,
  isReadOnly,
  aiGenerating,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };


  const handleConfirmDelete = async () => {
    if (!deleteConfirmId || !onDeleteMessage) return;
    try {
      setDeleting(true);
      await onDeleteMessage(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(`Failed to delete message: ${err?.message || 'Error'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        p: { xs: 1.25, sm: 2.5, md: 3 },
        pb: { xs: 2.5, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.5, sm: 2 },
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {messages.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            opacity: 0.6,
            my: 'auto',
            gap: 1.5,
          }}
        >
          <ForumOutlinedIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6" color="text.secondary">
            No messages in this chat yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Say hello, share a link, or paste an image to start!
          </Typography>
        </Box>
      ) : (
        messages.map((msg) => {
          const isSenderMe = currentUserId && msg.senderId === currentUserId;
          const isAI = msg.senderName === 'AI';
          const isImage = msg.kind === 'image' || !!msg.url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
          const fullImageUrl = getMediaUrl(msg.url || '');

          return (
            <Box
              key={msg._id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isSenderMe ? 'flex-end' : 'flex-start',
                maxWidth: { xs: '100%', sm: '88%', md: '78%' },
                minWidth: 0,
                alignSelf: isSenderMe ? 'flex-end' : 'flex-start',
                position: 'relative',
                boxSizing: 'border-box',
                '&:hover .msg-actions': { opacity: 1 },
              }}
            >
              {/* Sender Name & Timestamp */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mb: 0.5,
                  px: 0.75,
                  maxWidth: '100%',
                  minWidth: 0,
                }}
              >
                {isAI ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: '#8b5cf6' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#8b5cf6' }}>
                      AI Model
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      {msg.senderName}
                    </Typography>
                    {msg.deviceLabel && (
                      <Chip
                        label={msg.deviceLabel}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.68rem',
                          fontWeight: 500,
                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                          color: 'text.secondary',
                          borderRadius: '6px',
                          border: 1,
                          borderColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                          '& .MuiChip-label': { px: 0.7 },
                        }}
                      />
                    )}
                  </Box>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.8 }} suppressHydrationWarning>
                  {formatTime(msg.createdAt)}
                </Typography>

                {/* Hover Delete Action Button */}
                {onDeleteMessage && !isReadOnly && (
                  <Tooltip title="Delete message">
                    <IconButton
                      className="msg-actions"
                      size="small"
                      onClick={() => setDeleteConfirmId(msg._id)}
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        p: 0.25,
                        color: 'text.secondary',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {/* Bubble */}
              <Paper
                elevation={0}
                sx={{
                  p: isImage ? 1 : { xs: 1.25, sm: 1.75 },
                  borderRadius: 3,
                  backgroundColor: (theme) => {
                    if (isSenderMe) {
                      return theme.palette.mode === 'dark' ? '#1a4971' : '#e8f0fe';
                    }
                    if (isAI) {
                      return theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(99, 102, 241, 0.08)';
                    }
                    return theme.palette.mode === 'dark' ? '#2d2f31' : '#f1f3f4';
                  },
                  border: 1,
                  borderColor: (theme) => {
                    if (isAI) {
                      return theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(99, 102, 241, 0.25)';
                    }
                    return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                  },
                  maxWidth: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Image message */}
                {isImage && fullImageUrl && (
                  <Box
                    component="img"
                    src={fullImageUrl}
                    alt="attachment"
                    onClick={() => setSelectedImage(fullImageUrl)}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 320,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'block',
                      objectFit: 'cover',
                      '&:hover': { opacity: 0.95 },
                    }}
                  />
                )}

                {/* Text message content */}
                {msg.text && (
                  <Box
                    sx={{
                      mt: isImage ? 1 : 0,
                      px: isImage ? 1 : 0,
                      color: 'text.primary',
                      minWidth: 0,
                      maxWidth: '100%',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    <MarkdownRenderer content={msg.text} />
                  </Box>
                )}

                {/* Copy button (for quick prompt/text copying) */}
                {msg.text && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75, pt: 0.25 }}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={
                        copiedId === msg._id ? (
                          <CheckRoundedIcon sx={{ fontSize: 13 }} />
                        ) : (
                          <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                        )
                      }
                      onClick={() => handleCopy(msg._id, msg.text)}
                      sx={{
                        fontSize: '0.72rem',
                        py: 0.2,
                        px: 0.75,
                        borderRadius: 1.5,
                        textTransform: 'none',
                        color:
                          copiedId === msg._id
                            ? 'success.main'
                            : isAI
                            ? (theme) => (theme.palette.mode === 'dark' ? '#c4b5fd' : '#6d28d9')
                            : 'text.secondary',
                        '&:hover': {
                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        },
                      }}
                    >
                      {copiedId === msg._id ? 'Copied!' : isAI ? 'Copy Prompt' : 'Copy'}
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
          );
        })
      )}

      {aiGenerating && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 3,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.08)',
            border: 1,
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(99, 102, 241, 0.2)',
            maxWidth: 360,
          }}
        >
          <CircularProgress size={16} sx={{ color: '#8b5cf6' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', fontWeight: 500 }}>
            AI is generating response...
          </Typography>
        </Box>
      )}

      <div ref={bottomRef} />

      {/* Delete Message Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => !deleting && setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Delete message?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this message? It will be removed immediately for all connected devices.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Lightbox */}
      <Dialog
        open={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        maxWidth="lg"
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
        }}
      >
        <Box sx={{ position: 'relative', p: 1 }}>
          <IconButton
            onClick={() => setSelectedImage(null)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.6)',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.85)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage}
              alt="fullscreen preview"
              sx={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                borderRadius: 2,
                boxShadow: 24,
              }}
            />
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
