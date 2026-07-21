export const colors = {
  brand: {
    red: '#8B1A1A',
    redLight: '#A11F1F',
    redDark: '#6B1212',
    gold: '#C9A227',
    goldLight: '#D4AF37',
    goldDark: '#A8861F',
  },
  light: {
    background: '#F7F5F2',
    surface: '#FFFFFF',
    text: '#1A1212',
    textMuted: '#6B5E5E',
    border: '#E8E0D8',
    tabBar: '#FFFFFF',
    tabInactive: '#6B5E5E',
  },
  dark: {
    background: '#1A1212',
    surface: '#241818',
    text: '#F7F5F2',
    textMuted: '#C4B8B8',
    border: '#3A2A2A',
    tabBar: '#241818',
    tabInactive: '#C4B8B8',
  },
} as const;

export type ThemeMode = 'light' | 'dark';

export type AppTheme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  tabBar: string;
  tabInactive: string;
  primary: string;
  accent: string;
};

export function resolveTheme(mode: ThemeMode): AppTheme {
  const palette = mode === 'dark' ? colors.dark : colors.light;
  return {
    mode,
    ...palette,
    primary: colors.brand.red,
    accent: colors.brand.gold,
  };
}
