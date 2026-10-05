import { createTheme, ThemeOptions } from '@mui/material/styles';

export const getAppTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: isDark ? '#8ab4f8' : '#1a73e8',
        light: isDark ? '#aecbfa' : '#4285f4',
        dark: isDark ? '#669df6' : '#174ea6',
        contrastText: isDark ? '#041e49' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#c58af9' : '#9334e6',
      },
      background: {
        default: isDark ? '#131314' : '#f8f9fa',
        paper: isDark ? '#1e1f20' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e8eaed' : '#202124',
        secondary: isDark ? '#9aa0a6' : '#5f6368',
      },
      divider: isDark ? '#3c4043' : '#dadce0',
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
        selected: isDark ? 'rgba(138, 180, 248, 0.16)' : 'rgba(26, 115, 232, 0.08)',
      },
    },
    shape: {
      borderRadius: 6,
    },
    typography: {
      fontFamily: [
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
            border: `1px solid ${isDark ? '#3c4043' : '#e0e0e0'}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)',
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
              borderColor: isDark ? '#3c4043' : '#dadce0',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#5f6368' : '#bdc1c6',
            },
            '&.Mui-focused fieldset': {
              borderColor: isDark ? '#8ab4f8' : '#1a73e8',
            },
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
