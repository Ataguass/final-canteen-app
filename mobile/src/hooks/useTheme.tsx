import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider as NavThemeProvider, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';

// ─── Color Tokens ────────────────────────────────────────────────────────────

export type ThemeColors = {
  /** Main screen background */
  background: string;
  /** Card / elevated surface */
  card: string;
  /** Primary text */
  text: string;
  /** Secondary / subtitle text */
  textSecondary: string;
  /** Muted / hint text */
  textMuted: string;
  /** Borders, dividers */
  border: string;
  /** Alternate surface (e.g. input backgrounds, chips) */
  surfaceAlt: string;
  /** Brand accent (orange) */
  accent: string;
  /** Primary brand color alias */
  primary: string;
  /** Danger / destructive */
  danger: string;
  /** Search bar / input background */
  inputBg: string;
  /** Header / top bar background */
  headerBg: string;
  /** Tab bar background */
  tabBarBg: string;
  /** Modal overlay */
  overlay: string;
  /** Icon default color */
  icon: string;
  /** Icon secondary / muted */
  iconMuted: string;
};

const lightColors: ThemeColors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  surfaceAlt: '#F1F5F9',
  accent: '#FF6B35',
  primary: '#FF6B35',
  danger: '#EF4444',
  inputBg: '#FFFFFF',
  headerBg: '#EEF2F7',
  tabBarBg: '#FFFFFF',
  overlay: 'rgba(15,23,42,0.28)',
  icon: '#0F172A',
  iconMuted: '#64748B',
};

const darkColors: ThemeColors = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#334155',
  surfaceAlt: '#334155',
  accent: '#FF6B35',
  primary: '#FF6B35',
  danger: '#F87171',
  inputBg: '#1E293B',
  headerBg: '#0F172A',
  tabBarBg: '#1E293B',
  overlay: 'rgba(0,0,0,0.55)',
  icon: '#F1F5F9',
  iconMuted: '#94A3B8',
};

// ─── Context ─────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
};

const STORAGE_KEY = 'canteen_theme_mode';

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  // Load persisted theme on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setModeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const isDark = mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, colors, toggleTheme, setTheme }),
    [mode, isDark, colors, toggleTheme, setTheme]
  );

  const navTheme = useMemo(() => {
    const baseTheme = isDark ? NavDarkTheme : NavDefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [isDark, colors]);

  return (
    <ThemeContext.Provider value={value}>
      <NavThemeProvider value={navTheme}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        {children}
      </NavThemeProvider>
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Export palettes for direct use if needed
export { lightColors, darkColors };
