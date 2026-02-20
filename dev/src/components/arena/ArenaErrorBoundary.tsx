import React from 'react';
import { arena } from '@/theme/colors';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ArenaErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ArenaIDE crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: arena.bg,
          color: arena.text,
          gap: 16,
          padding: 32,
        }}>
          <span style={{ fontSize: 24, color: arena.error }}>Something went wrong</span>
          <p style={{ fontSize: 13, color: arena.textMuted, textAlign: 'center', maxWidth: 400 }}>
            The arena IDE encountered an error. Your code is safe — try reloading.
          </p>
          <button
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 8,
              color: '#0d1117',
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reload IDE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
