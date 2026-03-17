import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the webcontainer module
// ---------------------------------------------------------------------------

const mockReadFile = vi.fn().mockResolvedValue('file content');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockListFiles = vi.fn().mockResolvedValue(['index.js']);
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockSpawn = vi.fn().mockResolvedValue({
  output: 'mock-stream' as unknown as ReadableStream<string>,
  exit: Promise.resolve(0),
});
const mockSpawnWithInput = vi.fn().mockResolvedValue({
  output: {
    getReader: () => ({
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
    }),
  },
  input: {
    getWriter: () => ({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
  exit: Promise.resolve(0),
});

vi.mock('./webcontainer', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  listFiles: (...args: unknown[]) => mockListFiles(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  spawn: (...args: unknown[]) => mockSpawn(...args),
  spawnWithInput: (...args: unknown[]) => mockSpawnWithInput(...args),
}));

import { BrowserBackend } from './browser-backend';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowserBackend', () => {
  let backend: BrowserBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    backend = new BrowserBackend();
  });

  it('has mode "browser"', () => {
    expect(backend.mode).toBe('browser');
  });

  describe('readFile', () => {
    it('delegates to webcontainer readFile', async () => {
      const result = await backend.readFile('index.js');
      expect(mockReadFile).toHaveBeenCalledWith('index.js');
      expect(result).toBe('file content');
    });
  });

  describe('writeFile', () => {
    it('delegates to webcontainer writeFile', async () => {
      await backend.writeFile('index.js', 'new code');
      expect(mockWriteFile).toHaveBeenCalledWith('index.js', 'new code');
    });
  });

  describe('readdir', () => {
    it('delegates to webcontainer listFiles', async () => {
      const result = await backend.readdir('.');
      expect(mockListFiles).toHaveBeenCalledWith('.');
      expect(result).toEqual(['index.js']);
    });
  });

  describe('mkdir', () => {
    it('delegates to webcontainer mkdir', async () => {
      await backend.mkdir('src/lib');
      expect(mockMkdir).toHaveBeenCalledWith('src/lib');
    });
  });

  describe('rm', () => {
    it('delegates to webcontainer deleteFile', async () => {
      await backend.rm('old.js');
      expect(mockDeleteFile).toHaveBeenCalledWith('old.js');
    });
  });

  describe('stat', () => {
    it('returns directory stat when listFiles succeeds', async () => {
      mockListFiles.mockResolvedValueOnce(['a.js', 'b.js']);
      const result = await backend.stat('src');
      expect(result).toEqual({ isFile: false, isDirectory: true, size: 0 });
    });

    it('returns file stat when listFiles fails but readFile succeeds', async () => {
      mockListFiles.mockRejectedValueOnce(new Error('not a dir'));
      mockReadFile.mockResolvedValueOnce('hello world');
      const result = await backend.stat('index.js');
      expect(result).toEqual({ isFile: true, isDirectory: false, size: 11 });
    });

    it('throws when neither listFiles nor readFile succeeds', async () => {
      mockListFiles.mockRejectedValueOnce(new Error('not a dir'));
      mockReadFile.mockRejectedValueOnce(new Error('not a file'));
      await expect(backend.stat('nonexistent')).rejects.toThrow('ENOENT');
    });
  });

  describe('spawn', () => {
    it('delegates to webcontainer spawn', async () => {
      const result = await backend.spawn('node', ['test.js']);
      expect(mockSpawn).toHaveBeenCalledWith('node', ['test.js']);
      expect(result.exit).toBeDefined();
    });

    it('defaults to empty args', async () => {
      await backend.spawn('ls');
      expect(mockSpawn).toHaveBeenCalledWith('ls', []);
    });
  });

  describe('connectTerminal', () => {
    it('returns a terminal connection with write, resize, disconnect', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      expect(typeof conn.write).toBe('function');
      expect(typeof conn.resize).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
    });

    it('write does not throw before shell is ready', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      // Writer is not available until shell spawns (async), so write should be safe
      expect(() => conn.write('test')).not.toThrow();
    });

    it('disconnect does not throw', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      expect(() => conn.disconnect()).not.toThrow();
    });

    it('resize does not throw (no-op in WebContainer)', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      expect(() => conn.resize(120, 40)).not.toThrow();
    });

    it('spawns jsh shell', async () => {
      const onData = vi.fn();
      backend.connectTerminal(onData);
      // Wait for async spawn
      await new Promise((r) => setTimeout(r, 10));
      expect(mockSpawnWithInput).toHaveBeenCalledWith('jsh');
    });
  });
});
