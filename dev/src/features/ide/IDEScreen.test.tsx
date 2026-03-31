// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { FileEntry } from './FileTree';

const mockNavigate = vi.fn();
const mockRouteParams: any = {};
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: vi.fn(), goBack: vi.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));
let mockAuthReturn: any = { user: { id: 'u1' }, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/shared/hooks/useDocumentMeta', () => ({ useDocumentMeta: () => {} }));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens({ mono: true }));
vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <div data-testid="monaco-editor" onClick={() => onChange?.('changed code')}>
      {value}
    </div>
  ),
}));

let mockLayoutReturn: any = {
  sidebarCollapsed: false,
  bottomCollapsed: false,
  sidebarPosition: 'left',
  resultsDock: 'bottom',
  activeBottomTab: 'terminal',
  setSidebarCollapsed: vi.fn(),
  setBottomCollapsed: vi.fn(),
  toggleSidebarPosition: vi.fn(),
  setResultsDock: vi.fn(),
  setActiveBottomTab: vi.fn(),
};
vi.mock('@/features/shared-ide/hooks/useIDELayout', () => ({
  useIDELayout: () => mockLayoutReturn,
}));
vi.mock('@/features/shared-ide/lib/monaco-init', () => ({}));
vi.mock('@/lib/git/browser-git', () => ({
  clone: vi.fn().mockResolvedValue(undefined),
  status: vi.fn().mockResolvedValue([]),
  add: vi.fn().mockResolvedValue(undefined),
  unstage: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue('abc'),
  push: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue([]),
  diff: vi.fn().mockResolvedValue([]),
  currentBranch: vi.fn().mockResolvedValue('main'),
}));

// Mock useRuntime hook (replaces useWebContainer)
const mockReadFile = vi.fn().mockResolvedValue('// file content');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockBackend = {
  mode: 'browser' as const,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, size: 0 }),
  spawn: vi.fn().mockResolvedValue({ output: new ReadableStream(), exit: Promise.resolve(0) }),
  connectTerminal: vi.fn().mockReturnValue({ write: vi.fn(), resize: vi.fn(), disconnect: vi.fn() }),
};
const defaultFiles: FileEntry[] = [
  { name: 'index.js', path: 'index.js', type: 'file' },
  { name: 'package.json', path: 'package.json', type: 'file' },
];
let mockWCReturn: { ready: boolean; files: FileEntry[]; error: string | null; refreshFiles: () => Promise<void>; saveStatus: string; markDirty: () => void; saveProject: (id: string) => Promise<boolean>; collectFiles: () => Promise<Record<string, string>>; backend: any };
const mockRefreshFiles = vi.fn().mockResolvedValue(undefined);
const mockMarkDirty = vi.fn();
const mockSaveProject = vi.fn().mockResolvedValue(true);
const mockCollectFiles = vi.fn().mockResolvedValue({});
vi.mock('./useRuntime', () => ({
  useRuntime: () => mockWCReturn,
}));

// Mock IDETerminal — heavy xterm dependency
vi.mock('./IDETerminal', () => ({
  IDETerminal: () => <div data-testid="ide-terminal-mock">Terminal</div>,
}));

// Mock FileTree — import the real one (it uses arena colors which are already mocked via the real module)
vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    accentBg: 'rgba(201,169,98,0.12)',
    success: '#3fb950',
    error: '#f85149',
  },
}));

// Mock fetch for project metadata loading and save
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { IDEScreen } = await import('./IDEScreen');

describe('IDEScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    mockRouteParams.projectId = undefined;
    mockLayoutReturn = {
      sidebarCollapsed: false,
      bottomCollapsed: false,
      sidebarPosition: 'left',
      resultsDock: 'bottom',
      activeBottomTab: 'terminal',
      setSidebarCollapsed: vi.fn(),
      setBottomCollapsed: vi.fn(),
      toggleSidebarPosition: vi.fn(),
      setResultsDock: vi.fn(),
      setActiveBottomTab: vi.fn(),
    };
    mockReadFile.mockResolvedValue('// file content');
    mockWriteFile.mockResolvedValue(undefined);
    mockWCReturn = {
      ready: true,
      files: [...defaultFiles],
      error: null,
      refreshFiles: mockRefreshFiles,
      saveStatus: 'idle',
      markDirty: mockMarkDirty,
      saveProject: mockSaveProject,
      collectFiles: mockCollectFiles,
      backend: mockBackend,
    };
    mockFetch.mockResolvedValue({ ok: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the top bar with project name', () => {
    render(<IDEScreen />);
    expect(screen.getByText('Untitled Project')).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<IDEScreen />);
    const backBtn = screen.getByTestId('back-btn');
    expect(backBtn).toBeInTheDocument();
  });

  it('navigates to ProjectList when back button is clicked', () => {
    render(<IDEScreen />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('ProjectList');
  });

  it('renders save button', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders file tree once WebContainer is ready', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });
    // index.js may appear in both file tree and tab bar, so use getAllByText
    expect(screen.getAllByText('index.js').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('package.json').length).toBeGreaterThanOrEqual(1);
  });

  it('auto-opens index.js on boot', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('index.js');
    });
    // Tab bar should appear with index.js tab
    await waitFor(() => {
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });
  });

  it('renders Monaco editor with file content after opening a file', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
    expect(screen.getByTestId('monaco-editor').textContent).toContain('// file content');
  });

  it('opens a second file when clicked in file tree', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });

    // Click package.json
    fireEvent.click(screen.getByTestId('file-package.json'));

    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('package.json');
    });
  });

  it('switches tabs when clicking a tab button', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });

    // Open a second file
    fireEvent.click(screen.getByTestId('file-package.json'));
    await waitFor(() => {
      expect(screen.getByTestId('tab-btn-package.json')).toBeInTheDocument();
    });

    // Switch back to index.js tab
    mockReadFile.mockResolvedValueOnce('// index content');
    fireEvent.click(screen.getByTestId('tab-btn-index.js'));

    await waitFor(() => {
      // readFile should have been called for index.js when switching
      const calls = mockReadFile.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).toContain('index.js');
    });
  });

  it('closes a tab when close button is clicked', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });

    // Open a second file
    fireEvent.click(screen.getByTestId('file-package.json'));
    await waitFor(() => {
      expect(screen.getByTestId('tab-close-package.json')).toBeInTheDocument();
    });

    // Close the second tab
    fireEvent.click(screen.getByTestId('tab-close-package.json'));

    await waitFor(() => {
      expect(screen.queryByTestId('tab-btn-package.json')).toBeNull();
    });
  });

  it('closes active tab and switches to remaining tab', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });

    // Open package.json as second tab
    fireEvent.click(screen.getByTestId('file-package.json'));
    await waitFor(() => {
      expect(screen.getByTestId('tab-btn-package.json')).toBeInTheDocument();
    });

    // Close the active tab (package.json)
    fireEvent.click(screen.getByTestId('tab-close-package.json'));

    // Should switch to index.js
    await waitFor(() => {
      expect(screen.queryByTestId('tab-btn-package.json')).toBeNull();
      expect(screen.getByTestId('tab-btn-index.js')).toBeInTheDocument();
    });
  });

  it('writes file content on editor change with debounce', async () => {
    vi.useFakeTimers();

    render(<IDEScreen />);

    // Wait for auto-open to settle
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    // Click the monaco editor mock to trigger onChange('changed code')
    const editor = screen.queryByTestId('monaco-editor');
    if (editor) {
      fireEvent.click(editor);
      // Advance past the 300ms debounce
      act(() => { vi.advanceTimersByTime(400); });

      // writeFile should have been called with the changed content
      expect(mockWriteFile).toHaveBeenCalledWith('index.js', 'changed code');
      // markDirty should have been called
      expect(mockMarkDirty).toHaveBeenCalled();
    }

    vi.useRealTimers();
  });

  it('renders terminal panel with IDETerminal when ready', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('ide-terminal-mock')).toBeInTheDocument();
    });
  });

  it('renders boot screen when not ready', () => {
    mockWCReturn = { ...mockWCReturn, ready: false, files: [] };
    render(<IDEScreen />);
    expect(screen.getByTestId('ide-boot-screen')).toBeInTheDocument();
    expect(screen.getByText('Initializing IDE...')).toBeInTheDocument();
  });

  it('renders resize bars', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('resize-handle-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('resize-handle-vertical')).toBeInTheDocument();
  });

  it('renders editor panel', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  });

  it('returns null when loading', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="editor-panel"]')).toBeNull();
  });

  it('hides sidebar when collapsed', () => {
    mockLayoutReturn = { ...mockLayoutReturn, sidebarCollapsed: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="file-tree"]')).toBeNull();
  });

  it('hides terminal when bottom collapsed', () => {
    mockLayoutReturn = { ...mockLayoutReturn, bottomCollapsed: true };
    const { container } = render(<IDEScreen />);
    expect(container.querySelector('[data-testid="terminal-panel"]')).toBeNull();
  });

  it('shows error on boot screen when WebContainer fails', () => {
    mockWCReturn = { ...mockWCReturn, ready: false, files: [], error: 'Runtime error' };
    render(<IDEScreen />);
    expect(screen.getByTestId('ide-boot-screen')).toBeInTheDocument();
    expect(screen.getByText('Runtime error')).toBeInTheDocument();
  });

  it('shows "Select a file" message when no file is open but ready', () => {
    mockWCReturn = { ...mockWCReturn, ready: true, files: [] };
    render(<IDEScreen />);
    // No index.js found, so no auto-open, no file selected
    expect(screen.getByTestId('no-file-open')).toBeInTheDocument();
    expect(screen.getByText('Select a file to start editing')).toBeInTheDocument();
  });

  it('shows boot screen when runtime is loading', () => {
    mockWCReturn = { ...mockWCReturn, ready: false, files: [], error: null };
    render(<IDEScreen />);
    expect(screen.getByTestId('ide-boot-screen')).toBeInTheDocument();
    expect(screen.getByText('Initializing IDE...')).toBeInTheDocument();
  });

  it('handles readFile failure when opening a file', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('read failed'));

    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });
    // Should show fallback content
    expect(screen.getByTestId('monaco-editor').textContent).toContain('Could not read file');
  });

  it('handles readFile failure when switching tabs', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });

    // Open second file
    fireEvent.click(screen.getByTestId('file-package.json'));
    await waitFor(() => {
      expect(screen.getByTestId('tab-btn-package.json')).toBeInTheDocument();
    });

    // Make readFile fail for the switch back
    mockReadFile.mockRejectedValueOnce(new Error('read error'));
    fireEvent.click(screen.getByTestId('tab-btn-index.js'));

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor').textContent).toContain('Could not read file');
    });
  });

  it('does not add duplicate tabs for the same file', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });

    // Click index.js twice
    fireEvent.click(screen.getByTestId('file-index.js'));
    fireEvent.click(screen.getByTestId('file-index.js'));

    // Should still only have one tab for index.js
    const tabs = screen.getAllByTestId('tab-btn-index.js');
    expect(tabs).toHaveLength(1);
  });

  it('closes last tab and shows no-file-open state', async () => {
    render(<IDEScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    });

    // Close the only tab
    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-close-index.js'));
    });

    // Tab bar should disappear (0 open tabs)
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.getByTestId('no-file-open')).toBeInTheDocument();
  });

  // --- New persistence tests ---

  it('save button shows "Saving..." when saveStatus is "saving"', () => {
    mockWCReturn = { ...mockWCReturn, saveStatus: 'saving' };
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn').textContent).toBe('Saving...');
  });

  it('save button shows "Saved" when saveStatus is "saved"', () => {
    mockWCReturn = { ...mockWCReturn, saveStatus: 'saved' };
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn').textContent).toBe('Saved');
  });

  it('save button shows "Save failed" when saveStatus is "error"', () => {
    mockWCReturn = { ...mockWCReturn, saveStatus: 'error' };
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn').textContent).toBe('Save failed');
  });

  it('save button shows "Save" when idle', () => {
    render(<IDEScreen />);
    expect(screen.getByTestId('save-btn').textContent).toBe('Save');
  });

  it('calls saveProject on save button click when projectId exists', async () => {
    mockRouteParams.projectId = 'proj-123';
    render(<IDEScreen />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-btn'));
    });
    expect(mockSaveProject).toHaveBeenCalledWith('proj-123');
  });

  it('creates a new project on save when no projectId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ project: { id: 'new-proj', name: 'Untitled Project' } }),
    });

    render(<IDEScreen />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-btn'));
    });

    // Should have POSTed to create
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ method: 'POST' }),
    );
    // Then saved
    expect(mockSaveProject).toHaveBeenCalledWith('new-proj');
  });

  it('handles create project failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<IDEScreen />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-btn'));
    });

    // Should not crash; saveProject should not be called
    expect(mockSaveProject).not.toHaveBeenCalled();
  });

  it('handles create project network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));

    render(<IDEScreen />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-btn'));
    });

    expect(mockSaveProject).not.toHaveBeenCalled();
  });

  it('fetches project metadata when projectId is in route params', async () => {
    mockRouteParams.projectId = 'proj-456';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ project: { name: 'Loaded Project' } }),
    });

    render(<IDEScreen />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-456');
    });
    await waitFor(() => {
      expect(screen.getByText('Loaded Project')).toBeInTheDocument();
    });
  });
});
