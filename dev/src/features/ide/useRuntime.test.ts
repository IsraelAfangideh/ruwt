// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock RuwtBackend
// ---------------------------------------------------------------------------

const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockVfsReadFile = vi.fn().mockReturnValue(null);
const mockVfsWriteFile = vi.fn();
const mockVfsExists = vi.fn().mockReturnValue(false);
const mockVfsReaddir = vi.fn().mockReturnValue(null);
const mockVfsStat = vi.fn().mockReturnValue(null);
const mockVfsMkdir = vi.fn().mockReturnValue(true);
const mockVfsGetCwd = vi.fn().mockReturnValue('/home/user');
const mockVfsOnChange = vi.fn().mockReturnValue(() => {});

const mockVfs = {
  readFile: mockVfsReadFile,
  writeFile: mockVfsWriteFile,
  exists: mockVfsExists,
  readdir: mockVfsReaddir,
  stat: mockVfsStat,
  mkdir: mockVfsMkdir,
  getCwd: mockVfsGetCwd,
  onChange: mockVfsOnChange,
  resolve: vi.fn((p: string) => p.startsWith('/') ? p : `/home/user/${p}`),
  setSolutionCode: vi.fn(),
  getSolutionCode: vi.fn().mockReturnValue(''),
  solutionFilename: 'solution.js',
  solutionPath: '/home/user/solution.js',
  setCwd: vi.fn().mockReturnValue(true),
  getShortCwd: vi.fn().mockReturnValue('~'),
  remove: vi.fn().mockReturnValue(true),
  rename: vi.fn().mockReturnValue(true),
  copy: vi.fn().mockReturnValue(true),
  listDetailed: vi.fn().mockReturnValue([]),
  isSolutionPath: vi.fn().mockReturnValue(false),
};

vi.mock('@/lib/sandbox/ruwt-backend', () => {
  class MockRuwtBackend {
    mode = 'browser' as const;
    initialize = mockInitialize;
    getVfs = () => mockVfs;
    readFile = vi.fn().mockResolvedValue('content');
    writeFile = vi.fn().mockResolvedValue(undefined);
    readdir = vi.fn().mockResolvedValue([]);
    mkdir = vi.fn().mockResolvedValue(undefined);
    rm = vi.fn().mockResolvedValue(undefined);
    stat = vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, size: 0 });
    spawn = vi.fn().mockResolvedValue({ output: new ReadableStream(), exit: Promise.resolve(0) });
    connectTerminal = vi.fn().mockReturnValue({ write: vi.fn(), resize: vi.fn(), disconnect: vi.fn() });
  }
  return { RuwtBackend: MockRuwtBackend };
});

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117', surface: '#161b22', surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)', text: '#e6edf3', textMuted: '#8b929a',
    accent: '#c9a962', error: '#f85149',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useRuntime } from './useRuntime';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialize.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: false });
    mockVfsReaddir.mockReturnValue(null);
    mockVfsStat.mockReturnValue(null);
    mockVfsReadFile.mockReturnValue(null);
    mockVfsExists.mockReturnValue(false);
  });

  it('initializes RuwtBackend on mount and sets ready=true', async () => {
    mockVfsReaddir.mockImplementation((path: string) => {
      if (path === '/home/user') return ['index.js', 'package.json'];
      return null;
    });
    mockVfsStat.mockImplementation((path: string) => {
      if (path.endsWith('.js') || path.endsWith('.json')) return { isDirectory: false, size: 10, name: path.split('/').pop() };
      return null;
    });

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('sets error state on initialization failure', async () => {
    mockInitialize.mockRejectedValueOnce(new Error('WASM load failed'));

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.error).toBe('WASM load failed'));
    expect(result.current.ready).toBe(false);
  });

  it('sets generic error for non-Error throws', async () => {
    mockInitialize.mockRejectedValueOnce('string-error');

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.error).toBe('Failed to initialize runtime'));
  });

  it('builds file tree from VFS', async () => {
    mockVfsReaddir.mockImplementation((path: string) => {
      if (path === '/home/user') return ['app.js'];
      return null;
    });
    mockVfsStat.mockImplementation((path: string) => {
      if (path === '/home/user/app.js') return { isDirectory: false, size: 5, name: 'app.js' };
      return null;
    });

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.files).toEqual([
      { name: 'app.js', path: 'app.js', type: 'file' },
    ]);
  });

  it('builds nested file tree with directories', async () => {
    mockVfsReaddir.mockImplementation((path: string) => {
      if (path === '/home/user') return ['src', 'index.js'];
      if (path === '/home/user/src') return ['main.ts'];
      return null;
    });
    mockVfsStat.mockImplementation((path: string) => {
      if (path === '/home/user/src') return { isDirectory: true, size: 0, name: 'src' };
      if (path.endsWith('.ts') || path.endsWith('.js')) return { isDirectory: false, size: 10, name: path.split('/').pop() };
      return null;
    });

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.files).toEqual([
      {
        name: 'src', path: 'src', type: 'directory',
        children: [{ name: 'main.ts', path: 'src/main.ts', type: 'file' }],
      },
      { name: 'index.js', path: 'index.js', type: 'file' },
    ]);
  });

  it('skips node_modules and hidden files', async () => {
    mockVfsReaddir.mockImplementation((path: string) => {
      if (path === '/home/user') return ['node_modules', '.git', 'index.js'];
      return null;
    });
    mockVfsStat.mockImplementation((path: string) => {
      if (path === '/home/user/node_modules') return { isDirectory: true, size: 0, name: 'node_modules' };
      if (path === '/home/user/.git') return { isDirectory: true, size: 0, name: '.git' };
      if (path === '/home/user/index.js') return { isDirectory: false, size: 5, name: 'index.js' };
      return null;
    });

    const { result } = renderHook(() => useRuntime());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.files).toEqual([
      { name: 'index.js', path: 'index.js', type: 'file' },
    ]);
  });

  it('refreshFiles rebuilds the file tree', async () => {
    mockVfsReaddir.mockReturnValue(['index.js']);
    mockVfsStat.mockReturnValue({ isDirectory: false, size: 5, name: 'index.js' });

    const { result } = renderHook(() => useRuntime());
    await waitFor(() => expect(result.current.ready).toBe(true));

    mockVfsReaddir.mockReturnValue(['index.js', 'app.js']);
    mockVfsStat.mockImplementation((path: string) => ({
      isDirectory: false, size: 5, name: path.split('/').pop(),
    }));

    await act(async () => { await result.current.refreshFiles(); });
    expect(result.current.files.length).toBe(2);
  });

  it('markDirty flags project as changed', async () => {
    mockVfsReaddir.mockReturnValue([]);
    const { result } = renderHook(() => useRuntime());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => { result.current.markDirty(); });
    expect(result.current.saveStatus).toBe('idle');
  });

  it('saveProject sends files to API', async () => {
    mockVfsReaddir.mockImplementation((path: string) => {
      if (path === '/home/user') return ['index.js'];
      return null;
    });
    mockVfsStat.mockReturnValue({ isDirectory: false, size: 5, name: 'index.js' });
    mockVfsReadFile.mockReturnValue('code');

    mockFetch.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useRuntime('project-123'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => { await result.current.saveProject('project-123'); });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/project-123',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('loads project files from API when projectId given', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: { 'main.js': 'loaded code' } }),
    });
    mockVfsReaddir.mockReturnValue(['main.js']);
    mockVfsStat.mockReturnValue({ isDirectory: false, size: 11, name: 'main.js' });

    const { result } = renderHook(() => useRuntime('proj-1'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Should have called fetch for project files
    expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-1/files');
  });

  it('mounts starter files when no projectId', async () => {
    mockVfsReaddir.mockReturnValue(['index.js', 'package.json']);
    mockVfsStat.mockReturnValue({ isDirectory: false, size: 5, name: 'x' });

    const { result } = renderHook(() => useRuntime());
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Should have written starter files to VFS
    expect(mockVfsWriteFile).toHaveBeenCalled();
  });

  it('exposes the backend instance', async () => {
    mockVfsReaddir.mockReturnValue([]);
    const { result } = renderHook(() => useRuntime());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.backend).toBeDefined();
    expect(result.current.backend.mode).toBe('browser');
  });

  it('cleans up on unmount', async () => {
    mockVfsReaddir.mockReturnValue([]);
    const { unmount } = renderHook(() => useRuntime());
    unmount();
    // Should not throw
  });
});
