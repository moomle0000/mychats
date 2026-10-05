'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getAppTheme } from './theme';

interface ColorModeContextType {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
  setColorMode: (mode: 'light' | 'dark') => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'dark',
  toggleColorMode: () => {},
  setColorMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('chat_theme_mode') as 'light' | 'dark' | null;
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setMode('light');
    }
    setMounted(true);
  }, []);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light';
          localStorage.setItem('chat_theme_mode', next);
          return next;
        });
      },
      setColorMode: (newMode: 'light' | 'dark') => {
        setMode(newMode);
        localStorage.setItem('chat_theme_mode', newMode);
      },
    }),
    [mode]
  );

  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
