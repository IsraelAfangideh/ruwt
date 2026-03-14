import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { ThemeProvider, useTheme } from '@/shared/theme';
import { ToastProvider } from '@/shared/ui/Toast';
import { AuthProvider } from '@/shared/lib/AuthContext';
import { AppModeProvider } from '@/shared/lib/AppModeContext';
import { DashboardDataProvider } from '@/shared/lib/DashboardDataContext';
import { AppNavigator } from '@/shared/navigation/AppNavigator';
import './index.css';

function BodyTheme() {
  const { colors } = useTheme();
  useEffect(() => {
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
  }, [colors.bg, colors.text]);
  return null;
}

function ErrorFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', backgroundColor: '#f5f3f0',
      fontFamily: "'Libre Franklin', -apple-system, sans-serif",
      flexDirection: 'column', gap: 12, padding: 32,
    }}>
      <h2 style={{ color: '#1a1816', fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h2>
      <p style={{ color: '#6b6560', fontSize: 14, textAlign: 'center', maxWidth: 320, margin: 0 }}>
        An unexpected error occurred. Please reload the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: '#c9a962', border: 'none', padding: '10px 24px',
          borderRadius: 8, color: '#1a1816', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Reload
      </button>
    </div>
  );
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppModeProvider>
              <DashboardDataProvider>
                <BodyTheme />
                <AppNavigator />
              </DashboardDataProvider>
            </AppModeProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}
