import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock esbuild-wasm (WASM can't run in Node vitest)
// ---------------------------------------------------------------------------

const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockBuild = vi.fn().mockResolvedValue({
  outputFiles: [{ text: 'bundled code', path: 'out.js' }],
  errors: [],
});
const mockTransform = vi.fn().mockResolvedValue({
  code: 'transformed code',
  errors: [],
});
const mockStop = vi.fn();

vi.mock('esbuild-wasm', () => ({
  initialize: (...args: unknown[]) => mockInitialize(...args),
  build: (...args: unknown[]) => mockBuild(...args),
  transform: (...args: unknown[]) => mockTransform(...args),
  stop: (...args: unknown[]) => mockStop(...args),
}));

import {
  initialize,
  transform,
  bundle,
  createVfsPlugin,
  dispose,
  _resetForTesting,
} from './esbuild-bridge';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EsbuildBridge', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    vfs = new VirtualFileSystem('typescript', '');
  });

  // ── initialize ──────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('calls esbuild.initialize with wasmURL and worker false', async () => {
      await initialize();
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({ wasmURL: expect.any(String), worker: false }),
      );
    });

    it('resolves on success', async () => {
      await expect(initialize()).resolves.toBeUndefined();
    });

    it('does not call initialize twice (singleton)', async () => {
      await initialize();
      await initialize();
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent initialize calls', async () => {
      const p1 = initialize();
      const p2 = initialize();
      await Promise.all([p1, p2]);
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('rejects when initialize fails', async () => {
      mockInitialize.mockRejectedValueOnce(new Error('wasm load failed'));
      _resetForTesting();
      await expect(initialize()).rejects.toThrow('wasm load failed');
    });
  });

  // ── transform ───────────────────────────────────────────────────────────

  describe('transform', () => {
    it('throws if not initialized', async () => {
      await expect(transform('const x: number = 1')).rejects.toThrow('not initialized');
    });

    it('transpiles TypeScript to JavaScript', async () => {
      await initialize();
      mockTransform.mockResolvedValueOnce({ code: 'const x = 1;', errors: [] });
      const result = await transform('const x: number = 1', { loader: 'ts' });
      expect(result.code).toBe('const x = 1;');
      expect(result.errors).toEqual([]);
    });

    it('transpiles TSX to JavaScript', async () => {
      await initialize();
      mockTransform.mockResolvedValueOnce({ code: 'React.createElement("div")', errors: [] });
      const result = await transform('<div />', { loader: 'tsx' });
      expect(result.code).toBe('React.createElement("div")');
    });

    it('passes through plain JS unchanged', async () => {
      await initialize();
      mockTransform.mockResolvedValueOnce({ code: 'const x = 1;', errors: [] });
      const result = await transform('const x = 1;');
      expect(result.code).toBe('const x = 1;');
    });

    it('returns errors for invalid syntax', async () => {
      await initialize();
      mockTransform.mockResolvedValueOnce({
        code: '',
        errors: [{ text: 'Unexpected token' }],
      });
      const result = await transform('const = ;', { loader: 'ts' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Unexpected token');
    });

    it('respects custom loader option', async () => {
      await initialize();
      await transform('const x = 1', { loader: 'jsx' });
      expect(mockTransform).toHaveBeenCalledWith(
        'const x = 1',
        expect.objectContaining({ loader: 'jsx' }),
      );
    });
  });

  // ── bundle ──────────────────────────────────────────────────────────────

  describe('bundle', () => {
    it('throws if not initialized', async () => {
      await expect(bundle('/home/user/index.ts', vfs)).rejects.toThrow('not initialized');
    });

    it('calls esbuild.build with correct options', async () => {
      await initialize();
      vfs.writeFile('/home/user/index.ts', 'console.log("hi")');
      await bundle('/home/user/index.ts', vfs);
      expect(mockBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          entryPoints: ['/home/user/index.ts'],
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'browser',
        }),
      );
    });

    it('returns bundled output text', async () => {
      await initialize();
      vfs.writeFile('/home/user/index.ts', 'console.log("hi")');
      const result = await bundle('/home/user/index.ts', vfs);
      expect(result.code).toBe('bundled code');
      expect(result.errors).toEqual([]);
    });

    it('returns error diagnostics on failure', async () => {
      await initialize();
      mockBuild.mockResolvedValueOnce({
        outputFiles: [],
        errors: [{ text: 'Could not resolve "missing-pkg"' }],
      });
      vfs.writeFile('/home/user/index.ts', 'import "missing-pkg"');
      const result = await bundle('/home/user/index.ts', vfs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Could not resolve');
    });

    it('returns empty code when build produces no output files', async () => {
      await initialize();
      mockBuild.mockResolvedValueOnce({ outputFiles: [], errors: [] });
      vfs.writeFile('/home/user/index.ts', '');
      const result = await bundle('/home/user/index.ts', vfs);
      expect(result.code).toBe('');
    });

    it('returns CSS output when present', async () => {
      await initialize();
      mockBuild.mockResolvedValueOnce({
        outputFiles: [
          { text: 'bundled js', path: 'out.js' },
          { text: '.red { color: red }', path: 'out.css' },
        ],
        errors: [],
      });
      vfs.writeFile('/home/user/index.ts', 'import "./style.css"');
      const result = await bundle('/home/user/index.ts', vfs);
      expect(result.code).toBe('bundled js');
      expect(result.css).toBe('.red { color: red }');
    });
  });

  // ── createVfsPlugin ─────────────────────────────────────────────────────

  describe('createVfsPlugin', () => {
    let onResolveCallback: (args: any) => any;
    let onLoadCallback: (args: any) => any;

    beforeEach(() => {
      const plugin = createVfsPlugin(vfs);
      // Extract the callbacks by simulating the build.onResolve / build.onLoad registration
      const mockBuildApi = {
        onResolve: vi.fn((opts: any, cb: any) => {
          onResolveCallback = cb;
        }),
        onLoad: vi.fn((opts: any, cb: any) => {
          onLoadCallback = cb;
        }),
      };
      plugin.setup(mockBuildApi as any);
    });

    describe('onResolve', () => {
      it('resolves absolute paths unchanged', () => {
        const result = onResolveCallback({ path: '/home/user/foo.ts', importer: '' });
        expect(result.path).toBe('/home/user/foo.ts');
      });

      it('resolves relative paths against importer directory', () => {
        const result = onResolveCallback({
          path: './utils',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toMatch(/^\/home\/user\/src\/utils/);
      });

      it('resolves bare specifiers to node_modules', () => {
        vfs.writeFile('/home/user/node_modules/lodash/index.js', 'module.exports = {}');
        const result = onResolveCallback({ path: 'lodash', importer: '/home/user/index.ts' });
        expect(result.path).toContain('node_modules/lodash');
      });

      it('adds .ts extension when bare import has no extension', () => {
        vfs.writeFile('/home/user/src/utils.ts', 'export const x = 1;');
        const result = onResolveCallback({
          path: './utils',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/utils.ts');
      });

      it('adds .js extension when .ts not found', () => {
        vfs.writeFile('/home/user/src/utils.js', 'export const x = 1;');
        const result = onResolveCallback({
          path: './utils',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/utils.js');
      });

      it('adds /index.ts when path is a directory', () => {
        vfs.mkdir('/home/user/src/lib');
        vfs.writeFile('/home/user/src/lib/index.ts', 'export const x = 1;');
        const result = onResolveCallback({
          path: './lib',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/lib/index.ts');
      });

      it('adds /index.js when directory has no index.ts', () => {
        vfs.mkdir('/home/user/src/lib');
        vfs.writeFile('/home/user/src/lib/index.js', 'export const x = 1;');
        const result = onResolveCallback({
          path: './lib',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/lib/index.js');
      });

      it('resolves .tsx extension', () => {
        vfs.writeFile('/home/user/src/App.tsx', 'export default () => <div/>');
        const result = onResolveCallback({
          path: './App',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/App.tsx');
      });

      it('resolves .jsx extension', () => {
        vfs.writeFile('/home/user/src/App.jsx', 'export default () => <div/>');
        const result = onResolveCallback({
          path: './App',
          importer: '/home/user/src/index.ts',
        });
        expect(result.path).toBe('/home/user/src/App.jsx');
      });

      it('returns external for node built-in modules', () => {
        const result = onResolveCallback({ path: 'fs', importer: '/home/user/index.ts' });
        expect(result.external).toBe(true);
      });
    });

    describe('onLoad', () => {
      it('reads content from VFS', () => {
        vfs.writeFile('/home/user/src/utils.ts', 'export const x = 1;');
        const result = onLoadCallback({ path: '/home/user/src/utils.ts' });
        expect(result.contents).toBe('export const x = 1;');
      });

      it('sets loader to ts for .ts files', () => {
        vfs.writeFile('/home/user/foo.ts', 'const x: number = 1;');
        const result = onLoadCallback({ path: '/home/user/foo.ts' });
        expect(result.loader).toBe('ts');
      });

      it('sets loader to tsx for .tsx files', () => {
        vfs.writeFile('/home/user/App.tsx', '<div/>');
        const result = onLoadCallback({ path: '/home/user/App.tsx' });
        expect(result.loader).toBe('tsx');
      });

      it('sets loader to jsx for .jsx files', () => {
        vfs.writeFile('/home/user/App.jsx', '<div/>');
        const result = onLoadCallback({ path: '/home/user/App.jsx' });
        expect(result.loader).toBe('jsx');
      });

      it('sets loader to css for .css files', () => {
        vfs.writeFile('/home/user/style.css', '.red { color: red }');
        const result = onLoadCallback({ path: '/home/user/style.css' });
        expect(result.loader).toBe('css');
      });

      it('sets loader to json for .json files', () => {
        vfs.writeFile('/home/user/data.json', '{"a":1}');
        const result = onLoadCallback({ path: '/home/user/data.json' });
        expect(result.loader).toBe('json');
      });

      it('sets loader to js for .js files', () => {
        vfs.writeFile('/home/user/index.js', 'console.log(1)');
        const result = onLoadCallback({ path: '/home/user/index.js' });
        expect(result.loader).toBe('js');
      });

      it('returns error when file does not exist in VFS', () => {
        const result = onLoadCallback({ path: '/home/user/missing.ts' });
        expect(result.errors).toBeDefined();
        expect(result.errors[0].text).toContain('not found');
      });
    });
  });

  // ── dispose ─────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('calls esbuild.stop if initialized', async () => {
      await initialize();
      dispose();
      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('does not call stop if not initialized', () => {
      dispose();
      expect(mockStop).not.toHaveBeenCalled();
    });

    it('allows re-initialization after dispose', async () => {
      await initialize();
      dispose();
      _resetForTesting();
      await initialize();
      expect(mockInitialize).toHaveBeenCalledTimes(2);
    });
  });
});
