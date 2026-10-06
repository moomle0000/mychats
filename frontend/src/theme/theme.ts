import { createTheme, ThemeOptions } from '@mui/material/styles';

export const getAppTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: isDark ? '#8ab4f8' : '#4f46e5',
        light: isDark ? '#aecbfa' : '#6366f1',
        dark: isDark ? '#669df6' : '#4338ca',
        contrastText: isDark ? '#041e49' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#c58af9' : '#7c3aed',
      },
      ...(isDark ? {} : { error: { main: '#dc2626' }, success: { main: '#059669' } }),
      background: {
        default: isDark ? '#131314' : '#f7f8fc',
        paper: isDark ? '#1e1f20' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e8eaed' : '#1b2030',
        secondary: isDark ? '#9aa0a6' : '#5b6478',
      },
      divider: isDark ? '#3c4043' : '#e3e7f0',
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(27, 32, 48, 0.05)',
        selected: isDark ? 'rgba(138, 180, 248, 0.16)' : 'rgba(79, 70, 229, 0.10)',
      },
    },
    shape: {
      borderRadius: 6,
    },
    typography: {
      fontFamily: [
        'var(--font-inter)',
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '8px 16px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: 16,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? '#3c4043' : '#e3e7f0'}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 12px rgba(27,32,48,0.06)',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '& fieldset': {
              borderColor: isDark ? '#3c4043' : '#e3e7f0',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#5f6368' : '#cdd3e0',
            },
            '&.Mui-focused fieldset': {
              borderColor: isDark ? '#8ab4f8' : '#4f46e5',
            },
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
