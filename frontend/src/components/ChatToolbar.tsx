'use client';

import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  CircularProgress,
  TextField,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import Brightness7RoundedIcon from '@mui/icons-material/Brightness7Rounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useColorMode } from '@/theme/ColorModeContext';
import { SSEConnectionStatus } from '@/hooks/useSSE';
import { User, getOrCreateDeviceId, getDeviceLabel, setDeviceLabel } from '@/lib/api';

interface ChatToolbarProps {
  status: SSEConnectionStatus;
  reconnect: () => void;
  onClear: () => Promise<void>;
  user: User | null;
  onLogout: () => void;
  onToggleSidebar?: () => void;
  activeTitle?: string;
  isLive?: boolean;
  isTool?: boolean;
  onNewChat?: () => void;
  hasMessages?: boolean;
}

export default function ChatToolbar({
  status,
  reconnect,
  onClear,
  user,
  onLogout,
  onToggleSidebar,
  activeTitle = 'Live Chat',
  isLive = true,
  isTool = false,
  onNewChat,
  hasMessages = true,
}: ChatToolbarProps) {
  const { mode, toggleColorMode } = useColorMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Device identity modal states
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceLabel, setDeviceLabelState] = useState('');
  const [editLabelInput, setEditLabelInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = getOrCreateDeviceId();
      const label = getDeviceLabel();
      setDeviceId(id);
      setDeviceLabelState(label);
      setEditLabelInput(label);

      const handleDeviceChange = (e: any) => {
        if (e.detail?.label) {
          setDeviceLabelState(e.detail.label);
          setEditLabelInput(e.detail.label);
        }
      };
      window.addEventListener('mychats:device-changed', handleDeviceChange);
      return () => {
        window.removeEventListener('mychats:device-changed', handleDeviceChange);
      };
    }
  }, []);

  const handleSaveDeviceLabel = () => {
    if (editLabelInput.trim()) {
      setDeviceLabel(editLabelInput.trim());
      setDeviceLabelState(editLabelInput.trim());
      setDeviceDialogOpen(false);
    }
  };

  const handleConfirmClear = async () => {
    try {
      setClearing(true);
      await onClear();
      setConfirmOpen(false);
    } catch (err: any) {
      alert(`Error clearing chat: ${err?.message || 'Failed'}`);
    } finally {
      setClearing(false);
    }
  };

  const getStatusChip = () => {
    if (isTool) {
      return (
        <Tooltip title="This tool operates in private mode scoped exclusively to this device. Messages are not shared globally.">
          <Chip
            size="small"
            label="Device Isolated"
            color="secondary"
            variant="outlined"
            sx={{
              fontWeight: 600,
              fontSize: '0.725rem',
              height: 22,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Tooltip>
      );
    }

    if (!isLive) {
      return (
        <Chip
          size="small"
          label="Saved Chat"
          variant="outlined"
          sx={{
            fontWeight: 600,
            fontSize: '0.725rem',
            opacity: 0.8,
          }}
        />
      );
    }

    switch (status) {
      case 'connected':
        return (
          <Chip
            size="small"
            label="Live"
            color="success"
            variant="filled"
            sx={{
              fontWeight: 600,
              fontSize: '0.725rem',
              height: 22,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        );
      case 'connecting':
        return (
          <Chip
            size="small"
            label="Connecting..."
            color="warning"
            sx={{ height: 22, fontSize: '0.725rem' }}
            icon={<CircularProgress size={10} color="inherit" />}
          />
        );
      case 'disconnected':
      default:
        return (
          <Tooltip title="Disconnected. Click to retry">
            <Chip
              size="small"
              label="Offline"
              color="error"
              onClick={reconnect}
              clickable
              sx={{ height: 22, fontSize: '0.725rem' }}
              icon={<RefreshRoundedIcon fontSize="small" />}
            />
          </Tooltip>
        );
    }
  };

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(10px)',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(19,19,20,0.85)' : 'rgba(255,255,255,0.85)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 2.5 }, minHeight: 56 }}>
          {/* Left: Sidebar toggle + Active Chat Title + Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {onToggleSidebar && (
              <Tooltip title="Toggle sidebar">
                <IconButton onClick={onToggleSidebar} size="small" color="inherit">
                  <MenuRoundedIcon />
                </IconButton>
              </Tooltip>
            )}

            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                letterSpacing: -0.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: { xs: 150, sm: 280, md: 400 },
              }}
            >
              {activeTitle}
            </Typography>

            {getStatusChip()}

            {/* Device Identity Chip */}
            {deviceLabel && (
              <Tooltip title={`Device ID: ${deviceId} (Click to customize label)`}>
                <Chip
                  icon={<DevicesRoundedIcon sx={{ fontSize: '13px !important' }} />}
                  label={deviceLabel}
                  size="small"
                  variant="outlined"
                  onClick={() => setDeviceDialogOpen(true)}
                  clickable
                  sx={{
                    display: { xs: 'none', md: 'inline-flex' },
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    maxWidth: 180,
                    '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
                  }}
                />
              </Tooltip>
            )}
          </Box>

          {/* Right: Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
            {!isLive && !isTool && onNewChat && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={onNewChat}
                sx={{ borderRadius: 5, fontSize: '0.785rem' }}
              >
                Return to Live
              </Button>
            )}

            {(isLive || isTool) && (
              <Tooltip
                title={
                  !hasMessages
                    ? 'No messages to clear'
                    : isTool
                    ? 'Clear tool history for this device'
                    : 'Clear & Archive to history'
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    color={isTool ? "primary" : "error"}
                    size="small"
                    startIcon={<DeleteSweepRoundedIcon />}
                    onClick={() => setConfirmOpen(true)}
                    disabled={!hasMessages}
                    sx={{
                      borderRadius: 5,
                      fontSize: '0.785rem',
                      display: { xs: 'none', sm: 'inline-flex' },
                    }}
                  >
                    {isTool ? 'Clear Tool Chat' : 'Clear & Archive'}
                  </Button>
                </span>
              </Tooltip>
            )}

            {(isLive || isTool) && (
              <Tooltip
                title={
                  !hasMessages
                    ? 'No messages to clear'
                    : isTool
                    ? 'Clear Tool Chat'
                    : 'Clear & Archive'
                }
              >
                <span>
                  <IconButton
                    color={isTool ? "primary" : "error"}
                    size="small"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!hasMessages}
                    sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                  >
                    <DeleteSweepRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Dark / Light Toggle */}
            <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton onClick={toggleColorMode} color="inherit" size="small">
                {mode === 'dark' ? <Brightness7RoundedIcon fontSize="small" /> : <Brightness4RoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Clear Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => !clearing && setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isTool ? `Clear ${activeTitle}?` : 'Clear & Archive Chat?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isTool
              ? 'This will clear all messages in this tool for your device only. Your Live Chat and other tools will remain unaffected.'
              : 'This will save the current conversation to your history (named after its first line) and start a clean new chat for all connected devices. You can reopen the saved conversation anytime and keep posting in it.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={clearing} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmClear}
            color={isTool ? 'primary' : 'error'}
            variant="contained"
            disabled={clearing}
            startIcon={clearing ? <CircularProgress size={16} color="inherit" /> : <DeleteSweepRoundedIcon />}
          >
            {clearing ? 'Clearing...' : isTool ? 'Clear Tool' : 'Clear & Archive'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Device Identity & Rename Dialog */}
      <Dialog
        open={deviceDialogOpen}
        onClose={() => setDeviceDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Device Identity
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          <DialogContentText variant="body2">
            Each device accessing this website receives a unique identifier. All chat tools (e.g. Translation) are isolated to this device.
          </DialogContentText>

          <TextField
            label="Unique Device ID"
            value={deviceId}
            size="small"
            slotProps={{ input: { readOnly: true } }}
            helperText="Hardware/Session token tied to this browser"
          />

          <TextField
            label="Device Label (Origin Tag)"
            placeholder="e.g. 💻 Work Laptop, 📱 iPhone"
            value={editLabelInput}
            onChange={(e) => setEditLabelInput(e.target.value)}
            size="small"
            helperText="This label appears next to messages sent from this device"
          />

          {/* Quick suggestions */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {['💻 Laptop', '📱 Phone', '🖥️ Desktop', '📟 Tablet'].map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                clickable
                onClick={() => setEditLabelInput(tag)}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeviceDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleSaveDeviceLabel}>
            Save Label
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
