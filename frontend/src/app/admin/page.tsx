'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  Chip,
  Divider,
  Tabs,
  Tab,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchiveIcon from '@mui/icons-material/Archive';
import MarkChatReadIcon from '@mui/icons-material/MarkChatRead';
import BoltIcon from '@mui/icons-material/Bolt';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LaptopMacRoundedIcon from '@mui/icons-material/LaptopMacRounded';
import SmartphoneRoundedIcon from '@mui/icons-material/SmartphoneRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { useRouter } from 'next/navigation';
import { api, Conversation, Message, AdminStats, BACKEND_URL, User } from '@/lib/api';
import { useColorMode } from '@/theme/ColorModeContext';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const { mode, toggleColorMode } = useColorMode();

  // Active Tab: 'archives' | 'accounts'
  const [activeTab, setActiveTab] = useState<'archives' | 'accounts'>('archives');

  // Logged-in admin user
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Archives data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [archives, setArchives] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Accounts data states
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Archive Drawer / Inspection
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Rename Dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [convToRename, setConvToRename] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // Delete Conversation Dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);

  // Add Account Dialog
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    email: '',
    password: '',
    deviceLabel: '',
    role: 'admin' as 'admin' | 'user',
  });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Edit Account Dialog
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    deviceLabel: '',
    role: 'admin' as 'admin' | 'user',
    isActive: true,
  });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete Account Dialog
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteAccountSaving, setDeleteAccountSaving] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Auth verification
  useEffect(() => {
    api
      .getMe()
      .then((res) => {
        if (!res.data || res.data.role !== 'admin') {
          router.push('/login');
        } else {
          setCurrentUser(res.data);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  // Load archives data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, archivesRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminArchives(1, 50, search),
      ]);
      setStats(statsRes.data);
      setArchives(archivesRes.data || []);
    } catch (err) {
      console.error('[Admin] Load archives error:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Load accounts data
  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.data || []);
    } catch (err) {
      console.error('[Admin] Load users error:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadUsers();
  }, [loadData, loadUsers]);

  // Open conversation details drawer
  const handleOpenDrawer = async (conv: Conversation) => {
    setActiveConv(conv);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await api.getConversation(conv._id);
      setActiveMessages(res.data.messages || []);
    } catch (err) {
      alert('Failed to load conversation messages');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Rename action
  const handleRenameConfirm = async () => {
    if (!convToRename || !newTitle.trim()) return;
    try {
      await api.renameConversation(convToRename._id, newTitle.trim());
      setRenameOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Rename failed: ${err?.message || 'Error'}`);
    }
  };

  // Delete conversation action
  const handleDeleteConfirm = async () => {
    if (!convToDelete) return;
    try {
      await api.deleteConversation(convToDelete._id);
      setDeleteOpen(false);
      loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Error'}`);
    }
  };

  // Open Add Account Dialog
  const handleOpenAddAccount = () => {
    setAddForm({
      username: '',
      email: '',
      password: '',
      deviceLabel: '',
      role: 'admin',
    });
    setAddError('');
    setAddAccountOpen(true);
  };

  // Submit Add Account
  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('Username, email, and password are required');
      return;
    }
    if (addForm.password.length < 6) {
      setAddError('Password must be at least 6 characters');
      return;
    }
    try {
      setAddSaving(true);
      setAddError('');
      await api.createAdminUser(addForm);
      setAddAccountOpen(false);
      loadUsers();
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create account');
    } finally {
      setAddSaving(false);
    }
  };

  // Open Edit Account Dialog
  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      password: '',
      deviceLabel: user.deviceLabel || '',
      role: user.role,
      isActive: user.isActive !== false,
    });
    setEditError('');
    setEditAccountOpen(true);
  };

  // Submit Edit Account
  const handleEditAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.username.trim()) {
      setEditError('Username cannot be empty');
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      setEditError('Password must be at least 6 characters');
      return;
    }
    try {
      setEditSaving(true);
      setEditError('');
      const payload: any = {
        username: editForm.username.trim(),
        deviceLabel: editForm.deviceLabel.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await api.updateAdminUser(editingUser._id, payload);
      setEditAccountOpen(false);
      loadUsers();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update account');
    } finally {
      setEditSaving(false);
    }
  };

  // Open Delete Account Dialog
  const handleOpenDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteAccountError('');
    setDeleteAccountOpen(true);
  };

  // Confirm Delete Account
  const handleDeleteAccountConfirm = async () => {
    if (!userToDelete) return;
    try {
      setDeleteAccountSaving(true);
      setDeleteAccountError('');
      await api.deleteAdminUser(userToDelete._id);
      setDeleteAccountOpen(false);
      loadUsers();
    } catch (err: any) {
      setDeleteAccountError(err?.message || 'Failed to delete account');
    } finally {
      setDeleteAccountSaving(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return '-';
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.deviceLabel && u.deviceLabel.toLowerCase().includes(q))
    );
  });

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 6 }}>
      {/* Top Navbar */}
      <Paper
        elevation={0}
        sx={{
          py: 2,
          px: 3,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={Link}
            href="/"
            startIcon={<ArrowBackIcon />}
            color="inherit"
            size="small"
          >
            Back to Chat
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Admin Management Console
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Toggle theme">
            <IconButton onClick={toggleColorMode} color="inherit" size="small">
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        {/* Navigation Tabs */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            mb: 4,
            px: 2,
            pt: 1,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab
              value="archives"
              icon={<ArchiveIcon fontSize="small" />}
              iconPosition="start"
              label="Archives & Conversations"
              sx={{ fontWeight: 600, minHeight: 48, textTransform: 'none', fontSize: '0.95rem' }}
            />
            <Tab
              value="accounts"
              icon={<PeopleAltRoundedIcon fontSize="small" />}
              iconPosition="start"
              label={`Accounts & Devices (${users.length})`}
              sx={{ fontWeight: 600, minHeight: 48, textTransform: 'none', fontSize: '0.95rem' }}
            />
          </Tabs>
        </Paper>

        {/* ===================== TAB 1: ARCHIVES ===================== */}
        {activeTab === 'archives' && (
          <>
            {/* Stats Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ArchiveIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Archives
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats?.totalArchives ?? 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <MarkChatReadIcon color="secondary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Messages
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats?.totalMessages ?? 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BoltIcon color="success" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Active Live Messages
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats?.liveMessages ?? 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Archives Search & Header */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { sm: 'center' },
                gap: 2,
                mb: 2.5,
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Archived Conversations
              </Typography>

              <TextField
                size="small"
                placeholder="Search archives by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: { xs: '100%', sm: 300 } }}
              />
            </Box>

            {/* Table */}
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Messages</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Archived Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Preview</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} />
                      </TableCell>
                    </TableRow>
                  ) : archives.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          No archived conversations found. Click "Clear & Archive" in the chat to create one!
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    archives.map((conv) => (
                      <TableRow key={conv._id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{conv.title}</TableCell>
                        <TableCell>
                          <Chip size="small" label={`${conv.messageCount} msgs`} />
                        </TableCell>
                        <TableCell suppressHydrationWarning>{formatDate(conv.archivedAt)}</TableCell>
                        <TableCell
                          sx={{
                            color: 'text.secondary',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {conv.previewText || '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View messages">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenDrawer(conv)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Rename">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setConvToRename(conv);
                                setNewTitle(conv.title);
                                setRenameOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Export Markdown">
                            <IconButton
                              size="small"
                              component="a"
                              href={api.getExportUrl(conv._id, 'md')}
                              download
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setConvToDelete(conv);
                                setDeleteOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ===================== TAB 2: ACCOUNTS & DEVICES ===================== */}
        {activeTab === 'accounts' && (
          <>
            {/* Accounts Stats Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PeopleAltRoundedIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total Accounts
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {users.length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <DevicesRoundedIcon color="secondary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Configured Devices
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {users.filter((u) => !!u.deviceLabel).length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ShieldOutlinedIcon color="success" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Admin Credentials
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {users.filter((u) => u.role === 'admin').length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Header & Search */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { sm: 'center' },
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Device Accounts & Attribution
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage accounts for your devices. Messages sent from each login will show the assigned device label.
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search accounts or devices..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ width: { xs: '100%', sm: 260 } }}
                />

                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={handleOpenAddAccount}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Add Account
                </Button>
              </Box>
            </Box>

            {/* Accounts Table */}
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Device Label (Source)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} />
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          No accounts found. Click "Add Account" to create a device credential!
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const isMe = currentUser && currentUser._id === u._id;
                      return (
                        <TableRow key={u._id} hover>
                          {/* Account Username & Avatar */}
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar
                                src={u.avatarUrl}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  fontSize: '0.85rem',
                                  bgcolor: 'primary.main',
                                }}
                              >
                                {u.username.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {u.username}
                                  </Typography>
                                  {isMe && (
                                    <Chip
                                      size="small"
                                      label="You"
                                      color="primary"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {u._id.slice(-6)}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Device Label */}
                          <TableCell>
                            {u.deviceLabel ? (
                              <Chip
                                icon={<DevicesRoundedIcon sx={{ fontSize: '14px !important' }} />}
                                label={u.deviceLabel}
                                size="small"
                                color="default"
                                sx={{
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  backgroundColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(27, 32, 48, 0.07)',
                                }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                None (Default)
                              </Typography>
                            )}
                          </TableCell>

                          {/* Email */}
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                            {u.email}
                          </TableCell>

                          {/* Role */}
                          <TableCell>
                            <Chip
                              size="small"
                              label={u.role.toUpperCase()}
                              color={u.role === 'admin' ? 'secondary' : 'default'}
                              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                            />
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Chip
                              size="small"
                              label={u.isActive === false ? 'Inactive' : 'Active'}
                              color={u.isActive === false ? 'default' : 'success'}
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                            />
                          </TableCell>

                          {/* Created */}
                          <TableCell suppressHydrationWarning sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                            {formatDate(u.createdAt)}
                          </TableCell>

                          {/* Actions */}
                          <TableCell align="right">
                            <Tooltip title="Edit Account & Device">
                              <IconButton size="small" onClick={() => handleOpenEditUser(u)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip
                              title={
                                isMe
                                  ? 'Cannot delete your active logged-in account'
                                  : users.length <= 1
                                  ? 'Cannot delete the only account'
                                  : 'Delete Account'
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={isMe || users.length <= 1}
                                  onClick={() => handleOpenDeleteUser(u)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Container>

      {/* ===================== SLIDE-OUT DRAWER ===================== */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: { width: { xs: '100%', sm: 540 }, p: 3 },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {activeConv?.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Archived: {formatDate(activeConv?.archivedAt)}
            </Typography>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Export buttons in Drawer */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {activeConv && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                component="a"
                href={api.getExportUrl(activeConv._id, 'json')}
                download
              >
                Export JSON
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                component="a"
                href={api.getExportUrl(activeConv._id, 'md')}
                download
              >
                Export Markdown
              </Button>
            </>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {drawerLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : activeMessages.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
            No messages in this archived conversation.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {activeMessages.map((m) => (
              <Paper
                key={m._id}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2, backgroundColor: 'action.hover' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {m.senderName}
                    </Typography>
                    {m.deviceLabel && (
                      <Chip
                        label={m.deviceLabel}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </Typography>
                </Box>
                {m.url && m.kind === 'image' && (
                  <Box
                    component="img"
                    src={`${BACKEND_URL}${m.url.startsWith('/') ? '' : '/'}${m.url}`}
                    alt="attachment"
                    sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 1.5, my: 1 }}
                  />
                )}
                {m.text && <Typography variant="body2">{m.text}</Typography>}
                {m.url && m.kind !== 'image' && (
                  <Typography variant="body2" color="primary">
                    <a href={m.url} target="_blank" rel="noreferrer">
                      {m.url}
                    </a>
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Drawer>

      {/* ===================== RENAME ARCHIVE DIALOG ===================== */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename Archive</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Archive Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameConfirm}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== DELETE ARCHIVE DIALOG ===================== */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Archived Conversation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete "{convToDelete?.title}" and all its messages? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== ADD ACCOUNT DIALOG ===================== */}
      <Dialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleAddAccountSubmit}>
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
            Add Account & Device Credentials
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
            <Typography variant="body2" color="text.secondary">
              Create an account for a specific device (e.g., Laptop, Work PC, Phone). Incoming messages will be tagged with the device label.
            </Typography>

            {addError && <Alert severity="error">{addError}</Alert>}

            <TextField
              required
              fullWidth
              label="Account Username"
              placeholder="e.g. Work Laptop, Ahmad Mobile"
              value={addForm.username}
              onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
            />

            <Box>
              <TextField
                fullWidth
                label="Device Label / Identifier"
                placeholder="e.g. 💻 MacBook Pro, 📱 iPhone 15, 🖥️ Home Desktop"
                value={addForm.deviceLabel}
                onChange={(e) => setAddForm({ ...addForm, deviceLabel: e.target.value })}
                helperText="This label will appear next to sender names in the chat so you know which device sent the message."
              />
              {/* Quick suggestions */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Quick tags:
                </Typography>
                {[
                  '💻 Work Laptop',
                  '📱 Mobile Phone',
                  '🖥️ Home Desktop',
                  '📟 iPad / Tablet',
                ].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    clickable
                    onClick={() => setAddForm({ ...addForm, deviceLabel: tag })}
                  />
                ))}
              </Box>
            </Box>

            <TextField
              required
              fullWidth
              type="email"
              label="Email"
              placeholder="laptop@admin.local"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            />

            <TextField
              required
              fullWidth
              type="password"
              label="Password"
              placeholder="Min 6 characters"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            />

            <FormControl fullWidth>
              <InputLabel id="add-role-label">Role</InputLabel>
              <Select
                labelId="add-role-label"
                value={addForm.role}
                label="Role"
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value as 'admin' | 'user' })}
              >
                <MenuItem value="admin">Admin (Full administrative & clear chat access)</MenuItem>
                <MenuItem value="user">User (Standard chat messaging only)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ pb: 2.5, px: 3 }}>
            <Button onClick={() => setAddAccountOpen(false)} disabled={addSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addSaving}
              startIcon={addSaving && <CircularProgress size={16} />}
            >
              {addSaving ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ===================== EDIT ACCOUNT DIALOG ===================== */}
      <Dialog open={editAccountOpen} onClose={() => setEditAccountOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEditAccountSubmit}>
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
            Edit Account: {editingUser?.username}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '10px !important' }}>
            {editError && <Alert severity="error">{editError}</Alert>}

            <TextField
              required
              fullWidth
              label="Username"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />

            <Box>
              <TextField
                fullWidth
                label="Device Label / Identifier"
                placeholder="e.g. 💻 Work Laptop, 📱 iPhone"
                value={editForm.deviceLabel}
                onChange={(e) => setEditForm({ ...editForm, deviceLabel: e.target.value })}
                helperText="Attributed origin tag attached to all messages sent by this account."
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Quick tags:
                </Typography>
                {[
                  '💻 Work Laptop',
                  '📱 Mobile Phone',
                  '🖥️ Home Desktop',
                  '📟 iPad / Tablet',
                ].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    clickable
                    onClick={() => setEditForm({ ...editForm, deviceLabel: tag })}
                  />
                ))}
              </Box>
            </Box>

            <TextField
              fullWidth
              type="password"
              label="New Password"
              placeholder="Leave blank to keep existing password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />

            <FormControl fullWidth>
              <InputLabel id="edit-role-label">Role</InputLabel>
              <Select
                labelId="edit-role-label"
                value={editForm.role}
                label="Role"
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })}
              >
                <MenuItem value="admin">Admin (Full administrative access)</MenuItem>
                <MenuItem value="user">User (Standard chat messaging only)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-status-label">Account Status</InputLabel>
              <Select
                labelId="edit-status-label"
                value={editForm.isActive ? 'active' : 'inactive'}
                label="Account Status"
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
              >
                <MenuItem value="active">Active (Permitted to sign in)</MenuItem>
                <MenuItem value="inactive">Inactive (Suspended)</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ pb: 2.5, px: 3 }}>
            <Button onClick={() => setEditAccountOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={editSaving}
              startIcon={editSaving && <CircularProgress size={16} />}
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ===================== DELETE ACCOUNT DIALOG ===================== */}
      <Dialog open={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Account?</DialogTitle>
        <DialogContent>
          {deleteAccountError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteAccountError}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete the account <strong>{userToDelete?.username}</strong> ({userToDelete?.email})?
            <br />
            This device will no longer be able to log in.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteAccountOpen(false)} disabled={deleteAccountSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccountConfirm}
            disabled={deleteAccountSaving}
            startIcon={deleteAccountSaving && <CircularProgress size={16} />}
          >
            {deleteAccountSaving ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
