// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { FileEntry } from './FileTree';

const mockNavigate = vi.fn();
const mockRouteParams: any = { sessionId: 'sess-123' };
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
vi.mock('@/features/shared-ide/useIDELayout', () => ({
  useIDELayout: () => mockLayoutReturn,
}));
vi.mock('@/features/shared-ide/PanelResizeBar', () => ({
  PanelResizeBar: ({ direction }: any) => <div data-testid={`resize-bar-${direction}`} />,
}));

const mockReadFile = vi.fn().mockResolvedValue('// file content');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/sandbox/webcontainer', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

const defaultFiles: FileEntry[] = [
  { name: 'index.js', path: 'index.js', type: 'file' },
  { name: 'package.json', path: 'package.json', type: 'file' },
];
let mockWCReturn: { ready: boolean; files: FileEntry[]; error: string | null; refreshFiles: () => Promise<void>; saveStatus: string; markDirty: () => void; saveProject: (id: string) => Promise<boolean>; collectFiles: () => Promise<Record<string, string>> };
const mockRefreshFiles = vi.fn().mockResolvedValue(undefined);
const mockMarkDirty = vi.fn();
const mockSaveProject = vi.fn().mockResolvedValue(true);
const mockCollectFiles = vi.fn().mockResolvedValue({ 'index.js': 'code' });
vi.mock('./useWebContainer', () => ({
  useWebContainer: () => mockWCReturn,
}));

vi.mock('./IDETerminal', () => ({
  IDETerminal: () => <div data-testid="ide-terminal-mock">Terminal</div>,
}));

const mockRecorder = {
  record: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  snapshotContent: vi.fn(),
  recordAIPrompt: vi.fn(),
  recordAIResponse: vi.fn(),
  recordTerminalCommand: vi.fn(),
  recordFileOpen: vi.fn(),
  recordFileClose: vi.fn(),
  recordTabSwitch: vi.fn(),
  recordFocus: vi.fn(),
};
vi.mock('./useSessionRecorder', () => ({
  useSessionRecorder: () => mockRecorder,
}));

vi.mock('./TelemetryDisclosure', () => ({
  TelemetryDisclosure: ({ onAccept }: any) => (
    <div data-testid="telemetry-disclosure">
      <button data-testid="disclosure-accept-btn" onClick={onAccept}>Accept</button>
    </div>
  ),
}));

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

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { TakeHomeScreen } = await import('./TakeHomeScreen');

describe('TakeHomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    mockRouteParams.sessionId = 'sess-123';
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
    };
    // Default session fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
        assessment: {
          id: 'assess-1',
          type: 'takehome',
          timeLimit: 3600,
          repoUrl: 'https://github.com/org/repo',
          instructions: 'Build a REST API that handles CRUD operations.',
          allowedModels: null,
        },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    // Make fetch hang
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<TakeHomeScreen />);
    expect(screen.getByTestId('takehome-loading')).toBeInTheDocument();
  });

  it('shows error state when session fails to load', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('takehome-error')).toBeInTheDocument();
    });
  });

  it('renders the main screen after loading', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('takehome-screen')).toBeInTheDocument();
    });
  });

  it('displays the instructions panel', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });
    expect(screen.getByText('Build a REST API that handles CRUD operations.')).toBeInTheDocument();
  });

  it('shows timer', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('timer')).toBeInTheDocument();
    });
  });

  it('toggles instructions panel visibility', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-instructions'));
    expect(screen.queryByTestId('instructions-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('toggle-instructions'));
    expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
  });

  it('renders back button that navigates to Assessments', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('back-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('renders submit button', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('submits and navigates to results', async () => {
    const submitResponse = { ok: true, json: () => Promise.resolve({ shareToken: 'share-abc' }) };
    // First call = session load, subsequent calls for telemetry/submit
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
          assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
        }),
      })
      .mockResolvedValue(submitResponse);

    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    expect(mockCollectFiles).toHaveBeenCalled();
    // Verify navigation happened
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('AssessmentResults', { shareToken: 'share-abc' });
    });
  });

  it('auto-opens index.js', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(mockReadFile).toHaveBeenCalledWith('index.js');
    });
  });

  it('renders file tree when WebContainer is ready', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    });
  });

  it('renders editor panel', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
    });
  });

  it('renders terminal when ready', async () => {
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('ide-terminal-mock')).toBeInTheDocument();
    });
  });

  it('returns null when loading auth', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<TakeHomeScreen />);
    expect(container.querySelector('[data-testid="takehome-screen"]')).toBeNull();
  });

  it('shows WebContainer error when it fails', async () => {
    mockWCReturn = { ...mockWCReturn, ready: false, files: [], error: 'WebContainer error' };
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('wc-error')).toBeInTheDocument();
    });
  });

  it('shows booting state when WebContainer is loading', async () => {
    mockWCReturn = { ...mockWCReturn, ready: false, files: [], error: null };
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('wc-loading')).toBeInTheDocument();
    });
  });

  it('hides terminal when bottom collapsed', async () => {
    mockLayoutReturn = { ...mockLayoutReturn, bottomCollapsed: true };
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('takehome-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('terminal-panel')).toBeNull();
  });

  it('shows no instructions message when none provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
        assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: null, allowedModels: null },
      }),
    });
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('No instructions provided.')).toBeInTheDocument();
    });
  });

  it('shows submitted state when session is already completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        session: { id: 'sess-123', status: 'completed', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
        assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
      }),
    });
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
  });

  it('hides file tree sidebar when collapsed', async () => {
    mockLayoutReturn = { ...mockLayoutReturn, sidebarCollapsed: true };
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('takehome-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('file-tree')).toBeNull();
  });

  it('handles submit failure gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
          assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
        }),
      })
      .mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'fail' }) });

    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    // Should still show Submit (not Submitted) since it failed
    await waitFor(() => {
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('shows disclosure modal when disclosureAccepted is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 0 },
        assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
      }),
    });
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('telemetry-disclosure')).toBeInTheDocument();
    });
    // IDE should NOT be visible yet
    expect(screen.queryByTestId('takehome-screen')).toBeNull();
  });

  it('shows IDE after accepting disclosure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 0 },
        assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
      }),
    });
    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('telemetry-disclosure')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('disclosure-accept-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('takehome-screen')).toBeInTheDocument();
    });
  });

  it('flushes recorder on submit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session: { id: 'sess-123', status: 'in_progress', expiresAt: new Date(Date.now() + 3600000).toISOString(), disclosureAccepted: 1 },
          assessment: { id: 'a1', type: 'takehome', timeLimit: 3600, instructions: 'Test', allowedModels: null },
        }),
      })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ shareToken: 'share-xyz' }) });

    render(<TakeHomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    expect(mockRecorder.flush).toHaveBeenCalled();
  });
});
