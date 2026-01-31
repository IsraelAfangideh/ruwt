import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, ColorScheme, ThemeMode } from './colors';

interface ThemeContextType {
  colors: ColorScheme;
  isDark: boolean;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const theme = useMemo(() => ({
    colors: isDark ? colors.dark : colors.light,
    isDark,
    mode: (isDark ? 'dark' : 'light') as ThemeMode,
  }), [isDark]);
  
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Export a hook that returns just the colors for convenience
export function useColors(): ColorScheme {
  return useTheme().colors;
}

