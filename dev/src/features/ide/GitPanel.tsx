/**
 * GitPanel: sidebar panel showing git status, staging, commit, push, and log.
 * Displayed as a tab alongside the file tree in the IDE sidebar.
 */
import { useState, useCallback } from 'react';
import { arena } from '@/shared/theme/colors';
import type { GitStatusEntry, GitLogEntry } from '@/lib/git/browser-git';

export interface GitPanelProps {
  branch: string | null;
  statusEntries: GitStatusEntry[];
  logEntries: GitLogEntry[];
  hasToken: boolean;
  onStage: (filepath: string) => void;
  onUnstage: (filepath: string) => void;
  onCommit: (message: string) => void;
  onPush: () => void;
  onRefresh: () => void;
}

/** Short status label for each file status */
function statusLabel(status: GitStatusEntry['status']): string {
  switch (status) {
    case 'modified': return 'M';
    case 'added': return 'A';
    case 'deleted': return 'D';
    case 'untracked': return '?';
    default: return ' ';
  }
}

/** Status badge color */
function statusColor(status: GitStatusEntry['status']): string {
  switch (status) {
    case 'modified': return '#e5c07b'; // yellow
    case 'added': return arena.success;
    case 'deleted': return arena.error;
    case 'untracked': return arena.textMuted;
    default: return arena.textMuted;
  }
}

export function GitPanel({
  branch,
  statusEntries,
  logEntries,
  hasToken,
  onStage,
  onUnstage,
  onCommit,
  onPush,
  onRefresh,
}: GitPanelProps) {
  const [commitMsg, setCommitMsg] = useState('');
  const [activeSection, setActiveSection] = useState<'changes' | 'log'>('changes');

  const handleCommit = useCallback(() => {
    if (!commitMsg.trim()) return;
    onCommit(commitMsg.trim());
    setCommitMsg('');
  }, [commitMsg, onCommit]);

  return (
    <div style={rootStyle} data-testid="git-panel">
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Git</span>
        <button
          onClick={onRefresh}
          style={refreshBtnStyle}
          data-testid="git-refresh-btn"
          aria-label="Refresh git status"
        >
          Refresh
        </button>
      </div>

      {/* Branch indicator */}
      <div style={branchRowStyle} data-testid="git-branch">
        <span style={branchIconStyle}>*</span>
        <span style={branchNameStyle}>{branch ?? 'detached'}</span>
      </div>

      {/* Section tabs */}
      <div style={sectionTabsStyle}>
        <button
          onClick={() => setActiveSection('changes')}
          style={{
            ...sectionTabStyle,
            borderBottom: activeSection === 'changes'
              ? `2px solid ${arena.accent}`
              : '2px solid transparent',
            color: activeSection === 'changes' ? arena.text : arena.textMuted,
          }}
          data-testid="git-tab-changes"
        >
          Changes ({statusEntries.length})
        </button>
        <button
          onClick={() => setActiveSection('log')}
          style={{
            ...sectionTabStyle,
            borderBottom: activeSection === 'log'
              ? `2px solid ${arena.accent}`
              : '2px solid transparent',
            color: activeSection === 'log' ? arena.text : arena.textMuted,
          }}
          data-testid="git-tab-log"
        >
          Log
        </button>
      </div>

      {/* Changes section */}
      {activeSection === 'changes' && (
        <div style={sectionBodyStyle}>
          {statusEntries.length === 0 ? (
            <div style={emptyMsgStyle} data-testid="git-no-changes">
              No changes
            </div>
          ) : (
            <div style={fileListStyle} data-testid="git-file-list">
              {statusEntries.map((entry) => (
                <div
                  key={entry.filepath}
                  style={fileRowStyle}
                  data-testid={`git-file-${entry.filepath}`}
                >
                  <span
                    style={{ ...statusBadgeStyle, color: statusColor(entry.status) }}
                    data-testid={`git-status-${entry.filepath}`}
                  >
                    {statusLabel(entry.status)}
                  </span>
                  <span style={fileNameStyle}>{entry.filepath}</span>
                  <div style={fileActionsStyle}>
                    <button
                      onClick={() => onStage(entry.filepath)}
                      style={stageActionBtnStyle}
                      data-testid={`git-stage-${entry.filepath}`}
                      aria-label={`Stage ${entry.filepath}`}
                    >
                      +
                    </button>
                    <button
                      onClick={() => onUnstage(entry.filepath)}
                      style={stageActionBtnStyle}
                      data-testid={`git-unstage-${entry.filepath}`}
                      aria-label={`Unstage ${entry.filepath}`}
                    >
                      -
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Commit input */}
          <div style={commitSectionStyle}>
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message"
              style={commitInputStyle}
              data-testid="git-commit-input"
            />
            <button
              onClick={handleCommit}
              disabled={!commitMsg.trim()}
              style={{
                ...commitBtnStyle,
                opacity: commitMsg.trim() ? 1 : 0.5,
              }}
              data-testid="git-commit-btn"
            >
              Commit
            </button>
            {hasToken && (
              <button
                onClick={onPush}
                style={pushBtnStyle}
                data-testid="git-push-btn"
              >
                Push
              </button>
            )}
          </div>
        </div>
      )}

      {/* Log section */}
      {activeSection === 'log' && (
        <div style={sectionBodyStyle}>
          {logEntries.length === 0 ? (
            <div style={emptyMsgStyle} data-testid="git-no-log">
              No commits
            </div>
          ) : (
            <div style={logListStyle} data-testid="git-log-list">
              {logEntries.map((entry) => (
                <div
                  key={entry.oid}
                  style={logEntryStyle}
                  data-testid={`git-log-${entry.oid}`}
                >
                  <span style={logOidStyle}>{entry.oid.slice(0, 7)}</span>
                  <span style={logMsgStyle}>{entry.message.split('\n')[0]}</span>
                  <span style={logAuthorStyle}>{entry.author.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px 6px',
  borderBottom: `1px solid ${arena.border}`,
};

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: arena.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

const refreshBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 6px',
};

const branchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
};

const branchIconStyle: React.CSSProperties = {
  color: arena.accent,
  fontSize: 12,
  fontWeight: 700,
};

const branchNameStyle: React.CSSProperties = {
  fontSize: 12,
  color: arena.text,
  fontWeight: 500,
};

const sectionTabsStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${arena.border}`,
};

const sectionTabStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '6px 8px',
  textAlign: 'center' as const,
};

const sectionBodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const emptyMsgStyle: React.CSSProperties = {
  padding: 16,
  fontSize: 12,
  color: arena.textMuted,
  textAlign: 'center' as const,
};

const fileListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const fileRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  fontSize: 12,
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  width: 14,
  textAlign: 'center' as const,
  flexShrink: 0,
};

const fileNameStyle: React.CSSProperties = {
  flex: 1,
  color: arena.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const fileActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  flexShrink: 0,
};

const stageActionBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.border}`,
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 11,
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 3,
  padding: 0,
};

const commitSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 12px',
  borderTop: `1px solid ${arena.border}`,
};

const commitInputStyle: React.CSSProperties = {
  background: arena.bg,
  border: `1px solid ${arena.border}`,
  borderRadius: 4,
  color: arena.text,
  fontSize: 12,
  padding: '6px 8px',
  outline: 'none',
};

const commitBtnStyle: React.CSSProperties = {
  background: arena.accent,
  border: 'none',
  color: arena.bg,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '5px 12px',
  borderRadius: 4,
};

const pushBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.accent}`,
  color: arena.accent,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '5px 12px',
  borderRadius: 4,
};

const logListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const logEntryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  fontSize: 12,
};

const logOidStyle: React.CSSProperties = {
  color: arena.accent,
  fontFamily: 'monospace',
  fontSize: 11,
  flexShrink: 0,
};

const logMsgStyle: React.CSSProperties = {
  flex: 1,
  color: arena.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const logAuthorStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 11,
  flexShrink: 0,
};
