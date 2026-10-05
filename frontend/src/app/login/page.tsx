'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import Brightness7RoundedIcon from '@mui/icons-material/Brightness7Rounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useColorMode } from '@/theme/ColorModeContext';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { mode, toggleColorMode } = useColorMode();
  const isDark = mode === 'dark';

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError(null);
      await api.loginGoogle(credentialResponse.credential);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Google sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        p: 2,
        position: 'relative',
      }}
    >
      {/* Top action header */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Button
          component={Link}
          href="/"
          startIcon={<ArrowBackRoundedIcon />}
          color="inherit"
          size="small"
          sx={{ borderRadius: 3 }}
        >
          Back to Chat
        </Button>
        <Tooltip title="Toggle theme">
          <IconButton onClick={toggleColorMode} color="inherit" size="small">
            {isDark ? <Brightness7RoundedIcon /> : <Brightness4RoundedIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 4,
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.6)'
            : '0 8px 24px rgba(0,0,0,0.08)',
          backgroundColor: isDark ? '#1e1f20' : '#ffffff',
          border: 1,
          borderColor: isDark ? '#3c4043' : '#e0e0e0',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 30 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
              MyChats
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Sign in to your private chat &amp; archive
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Google Sign In */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in encountered an error')}
              theme={isDark ? 'filled_black' : 'outline'}
              shape="pill"
            />
          </Box>

          <Divider sx={{ my: 2.5 }}>
            <Typography variant="caption" color="text.secondary">
              OR EMAIL &amp; PASSWORD
            </Typography>
          </Divider>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
            />

            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="small"
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ mt: 1, py: 1.2, borderRadius: 3, fontWeight: 600 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
