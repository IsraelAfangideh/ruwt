import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/theme';
import { AuthProvider } from '@/lib/AuthContext';
import { AppNavigator } from '@/navigation/AppNavigator';
import './index.css';

function BodyTheme() {
  const { colors, isDark } = useTheme();
  useEffect(() => {
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [colors.bg, colors.text, isDark]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BodyTheme />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
