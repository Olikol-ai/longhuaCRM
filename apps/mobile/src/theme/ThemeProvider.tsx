import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colorScheme } from 'nativewind';
import * as SystemUI from 'expo-system-ui';
import { AppTheme, ThemeMode, resolveTheme } from './colors';

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    colorScheme.set(mode);
    void SystemUI.setBackgroundColorAsync(
      mode === 'dark' ? '#1A1212' : '#F7F5F2',
    );
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolveTheme(mode),
      mode,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
