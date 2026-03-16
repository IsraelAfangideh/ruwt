import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @webcontainer/api — vi.hoisted ensures these are available when
// vi.mock's factory runs (since vi.mock is hoisted to the top of the file).
// ---------------------------------------------------------------------------

const { mockFs, mockProcess, mockContainer } = vi.hoisted(() => {
  const mockFs = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('file-content'),
    readdir: vi.fn().mockResolvedValue(['index.js', 'package.json']),
    rm: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };

  const mockProcess = {
    output: 'mock-output-stream' as unknown as ReadableStream<string>,
    input: 'mock-input-stream' as unknown as WritableStream<string>,
    exit: Promise.resolve(0),
    kill: vi.fn(),
    resize: vi.fn(),
  };

  const mockContainer = {
    fs: mockFs,
    mount: vi.fn().mockResolvedValue(undefined),
    spawn: vi.fn().mockResolvedValue(mockProcess),
  };

  return { mockFs, mockProcess, mockContainer };
});

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue(mockContainer),
  },
}));

import {
  getWebContainer,
  mountFiles,
  writeFile,
  readFile,
  deleteFile,
  listFiles,
  mkdir,
  spawn,
  spawnWithInput,
  createStarterFiles,
  _resetForTesting,
} from './webcontainer';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('webcontainer wrapper', () => {
  beforeEach(() => {
    _resetForTesting();
    vi.clearAllMocks();
  });

  // ── Singleton boot ──────────────────────────────────────────────────

  describe('getWebContainer', () => {
    it('boots once and returns the same instance', async () => {
      const { WebContainer } = await import('@webcontainer/api');

      const a = await getWebContainer();
      const b = await getWebContainer();

      expect(a).toBe(b);
      expect(WebContainer.boot).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent boot calls', async () => {
      const { WebContainer } = await import('@webcontainer/api');

      const [a, b] = await Promise.all([getWebContainer(), getWebContainer()]);

      expect(a).toBe(b);
      expect(WebContainer.boot).toHaveBeenCalledTimes(1);
    });
  });

  // ── File operations ─────────────────────────────────────────────────

  describe('mountFiles', () => {
    it('delegates to container.mount', async () => {
      const tree = { 'foo.js': { file: { contents: 'x' } } };
      await mountFiles(tree);
      expect(mockContainer.mount).toHaveBeenCalledWith(tree);
    });
  });

  describe('writeFile + readFile round-trip', () => {
    it('writes then reads the same path', async () => {
      await writeFile('index.js', 'console.log("hi")');
      expect(mockFs.writeFile).toHaveBeenCalledWith('index.js', 'console.log("hi")');

      const content = await readFile('index.js');
      expect(mockFs.readFile).toHaveBeenCalledWith('index.js', 'utf-8');
      expect(content).toBe('file-content');
    });
  });

  describe('deleteFile', () => {
    it('delegates to container.fs.rm', async () => {
      await deleteFile('old.js');
      expect(mockFs.rm).toHaveBeenCalledWith('old.js');
    });
  });

  describe('listFiles', () => {
    it('returns directory entries', async () => {
      const entries = await listFiles('.');
      expect(mockFs.readdir).toHaveBeenCalledWith('.');
      expect(entries).toEqual(['index.js', 'package.json']);
    });

    it('defaults to current directory', async () => {
      await listFiles();
      expect(mockFs.readdir).toHaveBeenCalledWith('.');
    });
  });

  describe('mkdir', () => {
    it('creates directory recursively', async () => {
      await mkdir('src/lib');
      expect(mockFs.mkdir).toHaveBeenCalledWith('src/lib', { recursive: true });
    });
  });

  // ── Process spawning ────────────────────────────────────────────────

  describe('spawn', () => {
    it('returns output stream and exit promise', async () => {
      const result = await spawn('node', ['test.js']);

      expect(mockContainer.spawn).toHaveBeenCalledWith('node', ['test.js']);
      expect(result.output).toBe(mockProcess.output);
      expect(result.exit).toBe(mockProcess.exit);
    });

    it('defaults to empty args', async () => {
      await spawn('ls');
      expect(mockContainer.spawn).toHaveBeenCalledWith('ls', []);
    });
  });

  describe('spawnWithInput', () => {
    it('returns output, input, and exit', async () => {
      const result = await spawnWithInput('sh');

      expect(mockContainer.spawn).toHaveBeenCalledWith('sh', []);
      expect(result.output).toBe(mockProcess.output);
      expect(result.input).toBe(mockProcess.input);
      expect(result.exit).toBe(mockProcess.exit);
    });
  });

  // ── Starter files ───────────────────────────────────────────────────

  describe('createStarterFiles', () => {
    it('returns correct file tree structure', () => {
      const tree = createStarterFiles();

      expect(tree).toHaveProperty('package.json');
      expect(tree).toHaveProperty('index.js');

      const pkgNode = tree['package.json'] as { file: { contents: string } };
      const pkg = JSON.parse(pkgNode.file.contents);
      expect(pkg.name).toBe('ruwt-project');
      expect(pkg.type).toBe('module');
      expect(pkg.scripts.start).toBe('node index.js');
      expect(pkg.scripts.test).toBe('node test.js');
    });

    it('uses default code when no starterCode provided', () => {
      const tree = createStarterFiles();
      const indexNode = tree['index.js'] as { file: { contents: string } };
      expect(indexNode.file.contents).toContain('Welcome to Ruwt IDE');
    });

    it('uses custom starterCode when provided', () => {
      const tree = createStarterFiles('const x = 42;');
      const indexNode = tree['index.js'] as { file: { contents: string } };
      expect(indexNode.file.contents).toBe('const x = 42;');
    });
  });

  // ── Reset ───────────────────────────────────────────────────────────

  describe('_resetForTesting', () => {
    it('allows re-boot after reset', async () => {
      const { WebContainer } = await import('@webcontainer/api');

      await getWebContainer();
      expect(WebContainer.boot).toHaveBeenCalledTimes(1);

      _resetForTesting();
      await getWebContainer();
      expect(WebContainer.boot).toHaveBeenCalledTimes(2);
    });
  });
});
