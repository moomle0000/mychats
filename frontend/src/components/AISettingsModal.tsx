'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Autocomplete,
  IconButton,
  Tooltip,
  Chip,
  InputAdornment,
  Paper,
} from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { api, AIModelOption } from '@/lib/api';

interface AISettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function AISettingsModal({ open, onClose, onSaved }: AISettingsModalProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<AIModelOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch available models from the target URL via the backend
  const loadModelsForUrl = async (urlToFetch: string, keyToUse?: string) => {
    if (!urlToFetch || !urlToFetch.trim()) {
      setError('Please provide a valid Base URL first');
      return;
    }

    setFetchingModels(true);
    setError(null);
    try {
      const res = await api.fetchAIModels(urlToFetch.trim(), keyToUse);
      const fetched = res.data || [];
      setModels(fetched);
      if (fetched.length === 0) {
        setError('No models returned from /models at this endpoint.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not fetch models from provider URL');
      setModels([]);
    } finally {
      setFetchingModels(false);
    }
  };

  // Load current settings when modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    api
      .getAISettings()
      .then((res) => {
        const currentUrl = res.data?.aiBaseUrl || '';
        const currentModel = res.data?.defaultModel || '';
        const currentKey = res.data?.apiKey || '';
        setBaseUrl(currentUrl);
        setSelectedModel(currentModel);
        setApiKey(currentKey);

        // Preload models list automatically from /models
        if (currentUrl) {
          loadModelsForUrl(currentUrl, currentKey);
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to fetch AI configuration');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  const handleSave = async () => {
    if (!baseUrl.trim()) {
      setError('AI Provider Base URL cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.updateAISettings({
        aiBaseUrl: baseUrl.trim(),
        defaultModel: selectedModel.trim(),
        apiKey: apiKey.trim(),
      });
      setSuccess('AI settings saved successfully!');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          fontWeight: 700,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneRoundedIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            AI Provider &amp; Model Settings
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 2.5 }}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" icon={<CheckCircleRoundedIcon fontSize="inherit" />}>
            {success}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary">
          Configure the OpenAI-compatible endpoint base URL, optional API authorization key, and
          select your default AI model.
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {/* 1. AI Provider Base URL */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
                Base URL
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="https://cliproxy.lmstream.xyz/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                disabled={saving}
                helperText="Backend calls <BaseURL>/chat/completions and fetches models from <BaseURL>/models"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Call /models endpoint on this Base URL">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => loadModelsForUrl(baseUrl, apiKey)}
                              disabled={fetchingModels || !baseUrl.trim()}
                              startIcon={
                                fetchingModels ? (
                                  <CircularProgress size={14} color="inherit" />
                                ) : (
                                  <RefreshRoundedIcon fontSize="small" />
                                )
                              }
                              sx={{ textTransform: 'none', px: 1.5, py: 0.25, fontSize: '0.75rem' }}
                            >
                              Fetch Models
                            </Button>
                          </span>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* 2. API Key (Optional) */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <KeyRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    API Key
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label="Optional" sx={{ height: 18, fontSize: '0.65rem' }} />
              </Box>
              <TextField
                fullWidth
                size="small"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-... or leave empty if no key required"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={saving}
                helperText="Sent as Bearer token in the Authorization header"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowApiKey((prev) => !prev)}
                          edge="end"
                        >
                          {showApiKey ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* 3. Default Model Selector */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Select Model (from /models)
                </Typography>
                {models.length > 0 && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="primary"
                    label={`${models.length} models available`}
                    icon={<SmartToyRoundedIcon fontSize="small" />}
                    sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                  />
                )}
              </Box>

              <Autocomplete
                freeSolo
                size="small"
                options={models.map((m) => m.id)}
                value={selectedModel}
                onChange={(event, newValue) => {
                  setSelectedModel(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                  setSelectedModel(newInputValue || '');
                }}
                disabled={saving}
                noOptionsText={fetchingModels ? 'Calling /models...' : 'No models loaded. Click "Fetch Models" above.'}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Click to select or type model ID..."
                    helperText="Selected model will be used as default for live chat, tools, and tasks."
                  />
                )}
                renderOption={(props, option) => {
                  const modelObj = models.find((m) => m.id === option);
                  const isSelected = selectedModel === option;
                  return (
                    <li {...props} key={option}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          py: 0.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isSelected ? 700 : 500,
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {option}
                          </Typography>
                          {isSelected && (
                            <Chip size="small" color="primary" label="Default" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                        {modelObj?.owned_by && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={modelObj.owned_by}
                            sx={{ height: 18, fontSize: '0.65rem', ml: 1 }}
                          />
                        )}
                      </Box>
                    </li>
                  );
                }}
              />
            </Box>

            {/* Quick Pick Models */}
            {models.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.75 }}>
                  Quick Pick (from /models):
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    maxHeight: 140,
                    overflowY: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    bgcolor: 'action.hover',
                  }}
                >
                  {models.slice(0, 30).map((m) => {
                    const active = selectedModel === m.id;
                    return (
                      <Chip
                        key={m.id}
                        label={m.id}
                        size="small"
                        clickable
                        color={active ? 'primary' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        onClick={() => setSelectedModel(m.id)}
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          height: 24,
                        }}
                      />
                    );
                  })}
                  {models.length > 30 && (
                    <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary', px: 0.5 }}>
                      +{models.length - 30} more in dropdown
                    </Typography>
                  )}
                </Paper>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRoundedIcon />}
        >
          {saving ? 'Saving...' : 'Set as Default Model'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
