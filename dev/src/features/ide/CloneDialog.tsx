/**
 * CloneDialog: modal for cloning a git repository into the WebContainer.
 * Accepts a repo URL and optional GitHub PAT for private repos.
 * Shows a progress indicator during clone.
 */
import { useState, useCallback } from 'react';
import { arena } from '@/shared/theme/colors';

export interface CloneDialogProps {
  open: boolean;
  onClose: () => void;
  onClone: (url: string, token?: string) => Promise<void>;
}

export function CloneDialog({ open, onClose, onClone }: CloneDialogProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  const handleClone = useCallback(async () => {
    if (!repoUrl.trim() || cloning) return;
    setCloning(true);
    setError(null);
    setProgress('Starting clone...');

    try {
      await onClone(repoUrl.trim(), token.trim() || undefined);
      setProgress(null);
      setRepoUrl('');
      setToken('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed');
      setProgress(null);
    } finally {
      setCloning(false);
    }
  }, [repoUrl, token, cloning, onClone, onClose]);

  if (!open) return null;

  return (
    <div style={overlayStyle} data-testid="clone-dialog-overlay">
      <div style={dialogStyle} data-testid="clone-dialog">
        <div style={headerStyle}>
          <span style={titleStyle}>Clone Repository</span>
          <button
            onClick={onClose}
            style={closeBtnStyle}
            data-testid="clone-dialog-close"
            aria-label="Close clone dialog"
          >
            &times;
          </button>
        </div>

        <div style={bodyStyle}>
          <label style={labelStyle} htmlFor="clone-url">
            Repository URL
          </label>
          <input
            id="clone-url"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            style={inputStyle}
            data-testid="clone-url-input"
            disabled={cloning}
          />

          <label style={labelStyle} htmlFor="clone-token">
            GitHub PAT (optional, for private repos)
          </label>
          <input
            id="clone-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
            style={inputStyle}
            data-testid="clone-token-input"
            disabled={cloning}
          />

          {progress && (
            <div style={progressStyle} data-testid="clone-progress">
              {progress}
            </div>
          )}

          {error && (
            <div style={errorStyle} data-testid="clone-error">
              {error}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button
            onClick={onClose}
            style={cancelBtnStyle}
            data-testid="clone-cancel-btn"
            disabled={cloning}
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            style={{
              ...cloneBtnStyle,
              opacity: cloning || !repoUrl.trim() ? 0.5 : 1,
            }}
            data-testid="clone-submit-btn"
            disabled={cloning || !repoUrl.trim()}
          >
            {cloning ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: arena.surface,
  border: `1px solid ${arena.border}`,
  borderRadius: 8,
  width: 440,
  maxWidth: '90vw',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `1px solid ${arena.border}`,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: arena.text,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 18,
  padding: '2px 6px',
  lineHeight: 1,
};

const bodyStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: arena.textMuted,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  background: arena.bg,
  border: `1px solid ${arena.border}`,
  borderRadius: 4,
  color: arena.text,
  fontSize: 13,
  padding: '8px 10px',
  outline: 'none',
};

const progressStyle: React.CSSProperties = {
  fontSize: 12,
  color: arena.accent,
  padding: '4px 0',
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: arena.error,
  padding: '4px 0',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: `1px solid ${arena.border}`,
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.border}`,
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 13,
  padding: '6px 14px',
  borderRadius: 4,
};

const cloneBtnStyle: React.CSSProperties = {
  background: arena.accent,
  border: 'none',
  color: arena.bg,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 14px',
  borderRadius: 4,
};
