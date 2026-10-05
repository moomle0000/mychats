'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  AppBar,
  Toolbar,
  Paper,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import Brightness7RoundedIcon from '@mui/icons-material/Brightness7Rounded';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, AITool, User } from '@/lib/api';
import { useColorMode } from '@/theme/ColorModeContext';
import { TRANSLATOR_SYSTEM_PROMPT } from '@/lib/constants';

const AVAILABLE_ICONS = [
  { id: 'translate', label: 'Translate', icon: TranslateRoundedIcon },
  { id: 'auto_awesome', label: 'AI Sparkle', icon: AutoAwesomeRoundedIcon },
  { id: 'code', label: 'Code', icon: CodeRoundedIcon },
  { id: 'terminal', label: 'Terminal', icon: TerminalRoundedIcon },
  { id: 'psychology', label: 'Brain / Logic', icon: PsychologyRoundedIcon },
  { id: 'storage', label: 'Database', icon: StorageRoundedIcon },
  { id: 'security', label: 'Security', icon: SecurityRoundedIcon },
];

function getToolIconComponent(iconName?: string) {
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

export default function ToolsPage() {
  const router = useRouter();
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === 'dark';

  const [tools, setTools] = useState<AITool[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AITool | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formIcon, setFormIcon] = useState('auto_awesome');
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [toolsRes, meRes] = await Promise.all([
        api.getTools().catch(() => ({ data: [] })),
        api.getMe().catch(() => ({ data: null })),
      ]);
      setTools(toolsRes.data || []);
      setUser(meRes.data);
    } catch (err: any) {
      console.error('Failed to load tools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingTool(null);
    setFormName('');
    setFormDescription('');
    setFormPrompt('');
    setFormIcon('auto_awesome');
    setDialogOpen(true);
  };

  const handleOpenEdit = (tool: AITool) => {
    setEditingTool(tool);
    setFormName(tool.name);
    setFormDescription(tool.description || '');
    setFormPrompt(tool.systemPrompt);
    setFormIcon(tool.icon || 'auto_awesome');
    setDialogOpen(true);
  };

  const handleSaveTool = async () => {
    if (!formName.trim()) {
      setToast({ open: true, message: 'Please enter a name for the tool.', severity: 'error' });
      return;
    }
    if (!formPrompt.trim()) {
      setToast({ open: true, message: 'Please enter a system prompt.', severity: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      if (editingTool) {
        await api.updateTool(editingTool._id, {
          name: formName.trim(),
          description: formDescription.trim(),
          systemPrompt: formPrompt.trim(),
          icon: formIcon,
        });
        setToast({ open: true, message: 'Tool updated successfully!', severity: 'success' });
      } else {
        await api.createTool({
          name: formName.trim(),
          description: formDescription.trim(),
          systemPrompt: formPrompt.trim(),
          icon: formIcon,
        });
        setToast({ open: true, message: 'AI Tool created successfully!', severity: 'success' });
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to save tool', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTool = async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      await api.deleteTool(deleteConfirmId);
      setToast({ open: true, message: 'Tool deleted successfully.', severity: 'success' });
      setDeleteConfirmId(null);
      loadData();
    } catch (err: any) {
      setToast({ open: true, message: err?.message || 'Failed to delete tool', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleUseTool = (tool: AITool) => {
    router.push(`/?tool=${tool._id}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 8 }}>
      {/* Top Navbar */}
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(10px)',
          backgroundColor: isDark ? 'rgba(19,19,20,0.85)' : 'rgba(255,255,255,0.85)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              component={Link}
              href="/"
              startIcon={<ArrowBackRoundedIcon />}
              color="inherit"
              sx={{ borderRadius: 4, fontWeight: 600, fontSize: '0.85rem' }}
            >
              Back to Chat
            </Button>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.3, display: { xs: 'none', sm: 'block' } }}>
              AI Studio &amp; Custom Tools
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <IconButton onClick={toggleColorMode} color="inherit" size="small">
                {isDark ? <Brightness7RoundedIcon /> : <Brightness4RoundedIcon />}
              </IconButton>
            </Tooltip>
            {user && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={handleOpenCreate}
                sx={{
                  borderRadius: 5,
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  px: 2,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  },
                }}
              >
                Create Tool
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Container */}
      <Container maxWidth="lg" sx={{ pt: 4 }}>
        {/* Hero Section */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: -0.5,
              mb: 1,
              background: isDark
                ? 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)'
                : 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Custom AI Tools Studio
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 650, mx: 'auto', fontSize: '0.95rem' }}>
            Build specialized AI assistants tailored to your workflow. Define a role, persona, and system prompt, then launch directly in your chat interface.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Create Card Prompt */}
            {user && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  onClick={handleOpenCreate}
                  sx={{
                    height: '100%',
                    minHeight: 220,
                    borderRadius: 4,
                    border: '2px dashed',
                    borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(99, 102, 241, 0.3)',
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.04)' : 'rgba(99, 102, 241, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    p: 3,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#8b5cf6',
                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(99, 102, 241, 0.06)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(99, 102, 241, 0.12)',
                      color: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    <AddRoundedIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Create New AI Tool
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    Define custom system instructions, persona &amp; technical rules
                  </Typography>
                </Card>
              </Grid>
            )}

            {/* List Existing Tools */}
            {tools.map((tool) => {
              const IconComp = getToolIconComponent(tool.icon);
              return (
                <Grid key={tool._id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 4,
                      border: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      backgroundColor: isDark ? '#1e1f20' : '#ffffff',
                      boxShadow: isDark
                        ? '0 4px 20px rgba(0,0,0,0.3)'
                        : '0 2px 12px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: isDark
                          ? '0 8px 28px rgba(0,0,0,0.45)'
                          : '0 6px 20px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <CardContent sx={{ flex: 1, p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 3,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isDark
                              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)'
                              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
                            color: isDark ? '#a78bfa' : '#6366f1',
                          }}
                        >
                          <IconComp sx={{ fontSize: 24 }} />
                        </Box>
                        {tool.isBuiltin ? (
                          <Chip
                            size="small"
                            label="Built-in"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Custom Tool"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>

                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>
                        {tool.name}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.84rem',
                          mb: 2,
                          lineHeight: 1.45,
                          minHeight: 40,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {tool.description || 'Custom technical prompt processor powered by AI.'}
                      </Typography>

                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.25,
                          borderRadius: 2.5,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
                          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            color: 'text.secondary',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {tool.systemPrompt}
                        </Typography>
                      </Paper>
                    </CardContent>

                    <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0, justifyContent: 'space-between' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<ForumRoundedIcon sx={{ fontSize: 16 }} />}
                        onClick={() => handleUseTool(tool)}
                        sx={{
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          px: 2,
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                          },
                        }}
                      >
                        Open in Chat
                      </Button>

                      {user && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit Tool">
                            <IconButton size="small" onClick={() => handleOpenEdit(tool)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {!tool.isBuiltin && (
                            <Tooltip title="Delete Tool">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteConfirmId(tool._id)}
                              >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      {/* Create / Edit Tool Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              p: 1,
              backgroundColor: isDark ? '#1e1f20' : '#ffffff',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
          {editingTool ? `Edit "${editingTool.name}"` : 'Create Custom AI Tool'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
            {/* Tool Name */}
            <TextField
              label="Tool Name"
              placeholder="e.g. SQL Query Generator, Technical Translator, Bug Fixer"
              fullWidth
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />

            {/* Description */}
            <TextField
              label="Information / Description"
              placeholder="Brief explanation of what this tool specializes in..."
              fullWidth
              multiline
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />

            {/* Icon Picker */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                Select Tool Icon
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {AVAILABLE_ICONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = formIcon === item.id;
                  return (
                    <Box
                      key={item.id}
                      onClick={() => setFormIcon(item.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 0.85,
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: 1,
                        borderColor: isSelected ? 'primary.main' : isDark ? '#333' : '#e5e7eb',
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(139, 92, 246, 0.25)'
                            : 'rgba(99, 102, 241, 0.12)'
                          : 'transparent',
                        color: isSelected ? 'primary.main' : 'text.primary',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* System Prompt Header with Preset Buttons */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  System Prompt (AI Instructions)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setFormPrompt(TRANSLATOR_SYSTEM_PROMPT)}
                    sx={{ fontSize: '0.72rem', borderRadius: 2 }}
                  >
                    Load Translator Template
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      setFormPrompt(
                        `You are an elite Senior Code Reviewer and Software Architect. Inspect the submitted code or architecture question for performance bottlenecks, security vulnerabilities, edge cases, and modern best practices. Output clear, concise feedback followed by clean, production-ready code examples.`
                      )
                    }
                    sx={{ fontSize: '0.72rem', borderRadius: 2 }}
                  >
                    Load Code Reviewer Template
                  </Button>
                </Box>
              </Box>

              <TextField
                placeholder="Instruct the AI model how to behave, what rules to follow, formatting guidelines, and response tone..."
                fullWidth
                multiline
                rows={9}
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                slotProps={{
                  input: {
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                    },
                  },
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pb: 2.5, px: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTool}
            disabled={submitting}
            sx={{
              borderRadius: 3,
              px: 3,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              },
            }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : editingTool ? 'Update Tool' : 'Save Tool'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Tool Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => !deleting && setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete AI Tool?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this custom tool? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteTool}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} sx={{ borderRadius: 3 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
