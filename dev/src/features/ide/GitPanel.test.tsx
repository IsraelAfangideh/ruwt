// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    success: '#3fb950',
    error: '#f85149',
  },
}));

import { GitPanel } from './GitPanel';
import type { GitStatusEntry, GitLogEntry } from '@/lib/git/browser-git';

describe('GitPanel', () => {
  const defaultProps = {
    branch: 'main',
    statusEntries: [] as GitStatusEntry[],
    logEntries: [] as GitLogEntry[],
    hasToken: false,
    onStage: vi.fn(),
    onUnstage: vi.fn(),
    onCommit: vi.fn(),
    onPush: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the git panel', () => {
    render(<GitPanel {...defaultProps} />);
    expect(screen.getByTestId('git-panel')).toBeInTheDocument();
    expect(screen.getByText('Git')).toBeInTheDocument();
  });

  it('displays branch name', () => {
    render(<GitPanel {...defaultProps} />);
    expect(screen.getByTestId('git-branch')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('shows "detached" when branch is null', () => {
    render(<GitPanel {...defaultProps} branch={null} />);
    expect(screen.getByText('detached')).toBeInTheDocument();
  });

  it('shows "No changes" when status is empty', () => {
    render(<GitPanel {...defaultProps} />);
    expect(screen.getByTestId('git-no-changes')).toBeInTheDocument();
  });

  it('displays changed files with status', () => {
    const entries: GitStatusEntry[] = [
      { filepath: 'index.js', status: 'modified' },
      { filepath: 'new-file.ts', status: 'added' },
      { filepath: 'old-file.js', status: 'deleted' },
      { filepath: 'readme.md', status: 'untracked' },
    ];
    render(<GitPanel {...defaultProps} statusEntries={entries} />);
    expect(screen.getByTestId('git-file-list')).toBeInTheDocument();
    expect(screen.getByTestId('git-file-index.js')).toBeInTheDocument();
    expect(screen.getByTestId('git-status-index.js').textContent).toBe('M');
    expect(screen.getByTestId('git-status-new-file.ts').textContent).toBe('A');
    expect(screen.getByTestId('git-status-old-file.js').textContent).toBe('D');
    expect(screen.getByTestId('git-status-readme.md').textContent).toBe('?');
  });

  it('shows file count in Changes tab', () => {
    const entries: GitStatusEntry[] = [
      { filepath: 'a.js', status: 'modified' },
      { filepath: 'b.js', status: 'added' },
    ];
    render(<GitPanel {...defaultProps} statusEntries={entries} />);
    expect(screen.getByTestId('git-tab-changes').textContent).toContain('2');
  });

  it('calls onStage when stage button clicked', () => {
    const entries: GitStatusEntry[] = [{ filepath: 'index.js', status: 'modified' }];
    render(<GitPanel {...defaultProps} statusEntries={entries} />);
    fireEvent.click(screen.getByTestId('git-stage-index.js'));
    expect(defaultProps.onStage).toHaveBeenCalledWith('index.js');
  });

  it('calls onUnstage when unstage button clicked', () => {
    const entries: GitStatusEntry[] = [{ filepath: 'index.js', status: 'modified' }];
    render(<GitPanel {...defaultProps} statusEntries={entries} />);
    fireEvent.click(screen.getByTestId('git-unstage-index.js'));
    expect(defaultProps.onUnstage).toHaveBeenCalledWith('index.js');
  });

  it('commit button is disabled when message is empty', () => {
    render(<GitPanel {...defaultProps} />);
    expect(screen.getByTestId('git-commit-btn')).toBeDisabled();
  });

  it('calls onCommit with message when commit button clicked', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.change(screen.getByTestId('git-commit-input'), {
      target: { value: 'feat: add feature' },
    });
    fireEvent.click(screen.getByTestId('git-commit-btn'));
    expect(defaultProps.onCommit).toHaveBeenCalledWith('feat: add feature');
  });

  it('clears commit input after commit', () => {
    render(<GitPanel {...defaultProps} />);
    const input = screen.getByTestId('git-commit-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'feat: test' } });
    fireEvent.click(screen.getByTestId('git-commit-btn'));
    expect(input.value).toBe('');
  });

  it('does not commit when message is whitespace only', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.change(screen.getByTestId('git-commit-input'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('git-commit-btn'));
    expect(defaultProps.onCommit).not.toHaveBeenCalled();
  });

  it('does not show push button when no token', () => {
    render(<GitPanel {...defaultProps} hasToken={false} />);
    expect(screen.queryByTestId('git-push-btn')).toBeNull();
  });

  it('shows push button when token exists', () => {
    render(<GitPanel {...defaultProps} hasToken={true} />);
    expect(screen.getByTestId('git-push-btn')).toBeInTheDocument();
  });

  it('calls onPush when push button clicked', () => {
    render(<GitPanel {...defaultProps} hasToken={true} />);
    fireEvent.click(screen.getByTestId('git-push-btn'));
    expect(defaultProps.onPush).toHaveBeenCalled();
  });

  it('calls onRefresh when refresh button clicked', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('git-refresh-btn'));
    expect(defaultProps.onRefresh).toHaveBeenCalled();
  });

  it('switches to log tab when clicked', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('git-tab-log'));
    // Changes section should be hidden, log should be visible
    expect(screen.queryByTestId('git-no-changes')).toBeNull();
    expect(screen.getByTestId('git-no-log')).toBeInTheDocument();
  });

  it('shows "No commits" when log is empty', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('git-tab-log'));
    expect(screen.getByTestId('git-no-log')).toBeInTheDocument();
  });

  it('displays log entries', () => {
    const logEntries: GitLogEntry[] = [
      { oid: 'abc123def456', message: 'feat: initial commit\nMore details', author: { name: 'Test User', email: 'test@test.com', timestamp: 1700000000 } },
      { oid: 'def789ghi012', message: 'fix: bug fix', author: { name: 'Dev', email: 'dev@test.com', timestamp: 1699999000 } },
    ];
    render(<GitPanel {...defaultProps} logEntries={logEntries} />);
    fireEvent.click(screen.getByTestId('git-tab-log'));
    expect(screen.getByTestId('git-log-list')).toBeInTheDocument();
    expect(screen.getByTestId('git-log-abc123def456')).toBeInTheDocument();
    // Shows short OID
    expect(screen.getByText('abc123d')).toBeInTheDocument();
    // Shows first line of message
    expect(screen.getByText('feat: initial commit')).toBeInTheDocument();
    // Shows author name
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('switches back to changes tab', () => {
    render(<GitPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId('git-tab-log'));
    expect(screen.queryByTestId('git-no-changes')).toBeNull();

    fireEvent.click(screen.getByTestId('git-tab-changes'));
    expect(screen.getByTestId('git-no-changes')).toBeInTheDocument();
  });

  it('handles status with unmodified (should return space badge)', () => {
    const entries: GitStatusEntry[] = [
      { filepath: 'test.js', status: 'unmodified' },
    ];
    render(<GitPanel {...defaultProps} statusEntries={entries} />);
    // unmodified should render a space badge
    expect(screen.getByTestId('git-file-test.js')).toBeInTheDocument();
  });
});
