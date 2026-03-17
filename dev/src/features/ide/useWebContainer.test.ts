// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetWebContainer = vi.fn().mockResolvedValue({});
const mockMountFiles = vi.fn().mockResolvedValue(undefined);
const mockCreateStarterFiles = vi.fn().mockReturnValue({
  'package.json': { file: { contents: '{}' } },
  'index.js': { file: { contents: '// hello' } },
});

// listFiles mock: returns entries for '.', throws for files
const mockListFiles = vi.fn();
const mockReadFile = vi.fn().mockResolvedValue('// content');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdir = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/sandbox/webcontainer', () => ({
  getWebContainer: (...args: unknown[]) => mockGetWebContainer(...args),
  mountFiles: (...args: unknown[]) => mockMountFiles(...args),
  createStarterFiles: (...args: unknown[]) => mockCreateStarterFiles(...args),
  listFiles: (...args: unknown[]) => mockListFiles(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Need to mock colors because FileTree import chain uses them
vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    error: '#f85149',
  },
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useWebContainer } from './useWebContainer';

describe('useWebContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default implementations after clearAllMocks
    mockGetWebContainer.mockResolvedValue({});
    mockMountFiles.mockResolvedValue(undefined);
    mockCreateStarterFiles.mockReturnValue({
      'package.json': { file: { contents: '{}' } },
      'index.js': { file: { contents: '// hello' } },
    });
    mockReadFile.mockResolvedValue('// content');
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    // Default: root directory has two files, no directories
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['index.js', 'package.json']);
      // Any other path = it's a file, throw
      return Promise.reject(new Error('not a directory'));
    });
    mockFetch.mockResolvedValue({ ok: false });
  });


  it('boots and sets ready=true with file tree', async () => {
    const { result } = renderHook(() => useWebContainer());

    expect(result.current.ready).toBe(false);
    expect(result.current.files).toEqual([]);

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(mockGetWebContainer).toHaveBeenCalledTimes(1);
    expect(mockCreateStarterFiles).toHaveBeenCalledTimes(1);
    expect(mockMountFiles).toHaveBeenCalledTimes(1);

    // Should have two file entries, sorted alphabetically
    expect(result.current.files).toEqual([
      { name: 'index.js', path: 'index.js', type: 'file' },
      { name: 'package.json', path: 'package.json', type: 'file' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('sets error when boot fails', async () => {
    mockGetWebContainer.mockRejectedValueOnce(new Error('Boot failed'));

    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.error).toBe('Boot failed'));

    expect(result.current.ready).toBe(false);
    expect(result.current.files).toEqual([]);
  });

  it('sets generic error message for non-Error throws', async () => {
    mockGetWebContainer.mockRejectedValueOnce('string-error');

    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.error).toBe('Failed to boot WebContainer'));
  });

  it('builds nested file tree with directories', async () => {
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['src', 'index.js']);
      if (path === 'src') return Promise.resolve(['main.ts']);
      // Everything else is a file
      return Promise.reject(new Error('not a directory'));
    });

    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Directories sort before files
    expect(result.current.files).toEqual([
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [
          { name: 'main.ts', path: 'src/main.ts', type: 'file' },
        ],
      },
      { name: 'index.js', path: 'index.js', type: 'file' },
    ]);
  });

  it('skips node_modules and hidden files', async () => {
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['node_modules', '.git', 'index.js']);
      return Promise.reject(new Error('not a directory'));
    });

    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Only index.js should appear — node_modules and .git are skipped
    expect(result.current.files).toEqual([
      { name: 'index.js', path: 'index.js', type: 'file' },
    ]);
  });

  it('refreshFiles re-reads the tree', async () => {
    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.files).toHaveLength(2);

    // Now update mock to return an extra file
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['index.js', 'package.json', 'new.js']);
      return Promise.reject(new Error('not a directory'));
    });

    await act(async () => {
      await result.current.refreshFiles();
    });

    expect(result.current.files).toHaveLength(3);
    // Files are sorted alphabetically: index.js, new.js, package.json
    expect(result.current.files.map((f) => f.name)).toEqual(['index.js', 'new.js', 'package.json']);
  });

  it('refreshFiles swallows errors silently', async () => {
    const { result } = renderHook(() => useWebContainer());

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Make listFiles throw on refresh
    mockListFiles.mockRejectedValueOnce(new Error('gone'));

    await act(async () => {
      await result.current.refreshFiles();
    });

    // Should not crash — files remain as before
    expect(result.current.files).toHaveLength(2);
  });

  it('does not update state after unmount (cancelled)', async () => {
    // Use a long delay to simulate slow boot
    const holder: { resolve: (() => void) | null } = { resolve: null };
    mockGetWebContainer.mockImplementation(
      () => new Promise<object>((res) => { holder.resolve = () => res({}); })
    );

    const { result, unmount } = renderHook(() => useWebContainer());
    expect(result.current.ready).toBe(false);

    // Unmount before boot completes
    unmount();

    // Now resolve — should not throw or update state
    if (holder.resolve) holder.resolve();

    // Give it a tick — no errors expected
    await new Promise((r) => setTimeout(r, 20));
  });

  it('exposes saveStatus as idle initially', async () => {
    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.saveStatus).toBe('idle');
  });

  it('markDirty is callable', async () => {
    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));
    // Should not throw
    act(() => result.current.markDirty());
  });

  it('saveProject calls fetch PUT and sets saveStatus', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.saveProject('proj-1');
    });

    expect(success).toBe(true);
    expect(result.current.saveStatus).toBe('saved');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects/proj-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('saveProject sets error status on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.saveProject('proj-1');
    });

    expect(success).toBe(false);
    expect(result.current.saveStatus).toBe('error');
  });

  it('saveProject sets error status on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.saveProject('proj-1');
    });

    expect(success).toBe(false);
    expect(result.current.saveStatus).toBe('error');
  });

  it('collectFiles reads all files from the filesystem', async () => {
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['index.js', 'package.json']);
      return Promise.reject(new Error('not a directory'));
    });
    mockReadFile.mockResolvedValue('// content');

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let fileMap: Record<string, string> = {};
    await act(async () => {
      fileMap = await result.current.collectFiles();
    });

    expect(fileMap['index.js']).toBe('// content');
    expect(fileMap['package.json']).toBe('// content');
  });

  it('collectFiles handles nested directories', async () => {
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['src', 'index.js']);
      if (path === 'src') return Promise.resolve(['main.ts']);
      return Promise.reject(new Error('not a directory'));
    });
    mockReadFile.mockResolvedValue('code');

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let fileMap: Record<string, string> = {};
    await act(async () => {
      fileMap = await result.current.collectFiles();
    });

    expect(fileMap['index.js']).toBe('code');
    expect(fileMap['src/main.ts']).toBe('code');
  });

  it('collectFiles skips unreadable files', async () => {
    mockListFiles.mockImplementation((path: string) => {
      if (path === '.') return Promise.resolve(['bad.js']);
      return Promise.reject(new Error('not a directory'));
    });
    mockReadFile.mockRejectedValue(new Error('cannot read'));

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let fileMap: Record<string, string> = {};
    await act(async () => {
      fileMap = await result.current.collectFiles();
    });

    expect(Object.keys(fileMap)).toHaveLength(0);
  });

  it('loads project files from API when projectId is provided', async () => {
    const files = { 'app.js': 'console.log("loaded")' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files }),
    });

    const { result } = renderHook(() => useWebContainer('proj-123'));

    await waitFor(() => expect(result.current.ready).toBe(true));

    // mountFiles should have been called with the loaded files
    expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-123/files');
    expect(mockMountFiles).toHaveBeenCalled();
    // createStarterFiles should NOT have been called since we loaded from API
    expect(mockCreateStarterFiles).not.toHaveBeenCalled();
  });

  it('falls back to starter files when API load fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useWebContainer('proj-123'));

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Should fall back to starter files
    expect(mockCreateStarterFiles).toHaveBeenCalled();
    expect(mockMountFiles).toHaveBeenCalled();
  });

  it('falls back to starter files when API returns empty files', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: {} }),
    });

    const { result } = renderHook(() => useWebContainer('proj-123'));

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Should fall back to starter files
    expect(mockCreateStarterFiles).toHaveBeenCalled();
  });

  it('falls back to starter files when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useWebContainer('proj-123'));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(mockCreateStarterFiles).toHaveBeenCalled();
  });
});
