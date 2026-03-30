import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock runtime modules (WASM can't run in Node vitest)
// ---------------------------------------------------------------------------

const mockEsbuildInit = vi.fn().mockResolvedValue(undefined);
const mockEsbuildBundle = vi.fn().mockResolvedValue({ code: 'bundled', errors: [] });
const mockEsbuildDispose = vi.fn();

vi.mock('@/lib/runtime/esbuild-bridge', () => ({
  initialize: (...args: unknown[]) => mockEsbuildInit(...args),
  bundle: (...args: unknown[]) => mockEsbuildBundle(...args),
  dispose: (...args: unknown[]) => mockEsbuildDispose(...args),
}));

const mockQuickjsInit = vi.fn().mockResolvedValue(undefined);
const mockQuickjsEval = vi.fn().mockResolvedValue({ stdout: 'output', stderr: '', exitCode: 0 });
const mockQuickjsDispose = vi.fn();

vi.mock('@/lib/runtime/quickjs-engine', () => ({
  initialize: (...args: unknown[]) => mockQuickjsInit(...args),
  evaluate: (...args: unknown[]) => mockQuickjsEval(...args),
  dispose: (...args: unknown[]) => mockQuickjsDispose(...args),
}));

vi.mock('@/lib/runtime/npm-client', () => {
  class MockNpmClient {
    install = vi.fn().mockResolvedValue(undefined);
    installFromPackageJson = vi.fn().mockResolvedValue(undefined);
    onProgress = vi.fn().mockReturnValue(() => {});
  }
  return { NpmClient: MockNpmClient };
});

import { RuwtBackend } from './ruwt-backend';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RuwtBackend', () => {
  let backend: RuwtBackend;

  beforeEach(() => {
    vi.clearAllMocks();
    backend = new RuwtBackend();
  });

  it('has mode "browser"', () => {
    expect(backend.mode).toBe('browser');
  });

  // ── Filesystem ────────────────────────────────────────────────────────

  describe('readFile', () => {
    it('reads from VirtualFileSystem', async () => {
      backend.getVfs().writeFile('/home/user/test.txt', 'hello');
      const content = await backend.readFile('/home/user/test.txt');
      expect(content).toBe('hello');
    });

    it('throws ENOENT for missing files', async () => {
      await expect(backend.readFile('/missing.txt')).rejects.toThrow('ENOENT');
    });
  });

  describe('writeFile', () => {
    it('writes to VirtualFileSystem', async () => {
      await backend.writeFile('/home/user/out.txt', 'data');
      expect(backend.getVfs().readFile('/home/user/out.txt')).toBe('data');
    });
  });

  describe('readdir', () => {
    it('lists from VirtualFileSystem', async () => {
      backend.getVfs().writeFile('/home/user/a.txt', 'a');
      backend.getVfs().writeFile('/home/user/b.txt', 'b');
      const entries = await backend.readdir('/home/user');
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
    });

    it('throws ENOENT for missing directory', async () => {
      await expect(backend.readdir('/nonexistent')).rejects.toThrow('ENOENT');
    });
  });

  describe('mkdir', () => {
    it('creates directory in VirtualFileSystem', async () => {
      await backend.mkdir('/home/user/newdir');
      expect(backend.getVfs().exists('/home/user/newdir')).toBe(true);
    });
  });

  describe('rm', () => {
    it('removes from VirtualFileSystem', async () => {
      backend.getVfs().writeFile('/home/user/del.txt', 'x');
      await backend.rm('/home/user/del.txt');
      expect(backend.getVfs().exists('/home/user/del.txt')).toBe(false);
    });
  });

  describe('stat', () => {
    it('returns file stat', async () => {
      backend.getVfs().writeFile('/home/user/f.txt', 'content');
      const stat = await backend.stat('/home/user/f.txt');
      expect(stat.isFile).toBe(true);
      expect(stat.isDirectory).toBe(false);
      expect(stat.size).toBe(7);
    });

    it('returns directory stat', async () => {
      backend.getVfs().mkdir('/home/user/mydir');
      const stat = await backend.stat('/home/user/mydir');
      expect(stat.isFile).toBe(false);
      expect(stat.isDirectory).toBe(true);
    });

    it('throws ENOENT for missing path', async () => {
      await expect(backend.stat('/nope')).rejects.toThrow('ENOENT');
    });
  });

  // ── spawn ─────────────────────────────────────────────────────────────

  describe('spawn', () => {
    it('routes "node" commands to QuickJS engine', async () => {
      backend.getVfs().writeFile('/home/user/index.js', 'console.log(1)');
      const handle = await backend.spawn('node', ['index.js']);
      const reader = handle.output.getReader();
      const { value } = await reader.read();
      expect(value).toContain('output');
      const code = await handle.exit;
      expect(code).toBe(0);
    });

    it('returns ProcessHandle with output stream and exit promise', async () => {
      backend.getVfs().writeFile('/home/user/x.js', '1');
      const handle = await backend.spawn('node', ['x.js']);
      expect(handle.output).toBeInstanceOf(ReadableStream);
      expect(handle.exit).toBeInstanceOf(Promise);
    });

    it('returns non-zero exit code on failure', async () => {
      mockQuickjsEval.mockResolvedValueOnce({ stdout: '', stderr: 'err', exitCode: 1 });
      backend.getVfs().writeFile('/home/user/bad.js', 'throw 1');
      const handle = await backend.spawn('node', ['bad.js']);
      const code = await handle.exit;
      expect(code).toBe(1);
    });

    it('handles unknown commands with error', async () => {
      const handle = await backend.spawn('unknown-cmd');
      const reader = handle.output.getReader();
      const { value } = await reader.read();
      expect(value).toContain('not found');
      const code = await handle.exit;
      expect(code).toBe(127);
    });
  });

  // ── connectTerminal ───────────────────────────────────────────────────

  describe('connectTerminal', () => {
    it('returns TerminalConnection with write, resize, disconnect', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      expect(typeof conn.write).toBe('function');
      expect(typeof conn.resize).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
    });

    it('disconnect does not throw', () => {
      const onData = vi.fn();
      const conn = backend.connectTerminal(onData);
      expect(() => conn.disconnect()).not.toThrow();
    });

    it('sends initial prompt to onData', async () => {
      const onData = vi.fn();
      backend.connectTerminal(onData);
      // Shell writes prompt on creation
      await new Promise((r) => setTimeout(r, 50));
      expect(onData).toHaveBeenCalled();
    });
  });

  // ── initialize ────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes esbuild and QuickJS', async () => {
      await backend.initialize();
      expect(mockEsbuildInit).toHaveBeenCalled();
      expect(mockQuickjsInit).toHaveBeenCalled();
    });
  });

  // ── getVfs ────────────────────────────────────────────────────────────

  describe('getVfs', () => {
    it('returns the internal VirtualFileSystem', () => {
      const vfs = backend.getVfs();
      expect(vfs).toBeDefined();
      expect(typeof vfs.readFile).toBe('function');
    });
  });
});
