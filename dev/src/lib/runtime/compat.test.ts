/**
 * Compatibility tests for the Ruwt Runtime.
 *
 * Exercises the full stack: VFS + esbuild bridge + QuickJS engine +
 * npm client + Node polyfills + tar parser working together.
 * All external calls (fetch, WASM) are mocked — these test the
 * integration between our own modules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { createPolyfills } from './node-polyfills';
import { parseTar } from './tar';
import { NpmClient } from './npm-client';

// ---------------------------------------------------------------------------
// Mock esbuild-wasm (WASM can't run in Node)
// ---------------------------------------------------------------------------

vi.mock('esbuild-wasm', () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  build: vi.fn().mockImplementation(async (opts: any) => {
    // Simulate bundling by reading the entry point via the plugin
    let code = '';
    if (opts.plugins?.[0]) {
      const plugin = opts.plugins[0];
      const mockBuild = {
        onResolve: vi.fn((_filter: any, cb: any) => {
          // Store the resolver for later use
          (mockBuild as any)._resolver = cb;
        }),
        onLoad: vi.fn((_filter: any, cb: any) => {
          (mockBuild as any)._loader = cb;
        }),
      };
      plugin.setup(mockBuild);
      // Load the entry point
      const loaded = (mockBuild as any)._loader?.({ path: opts.entryPoints[0] });
      code = loaded?.contents ?? '';
    }
    return {
      outputFiles: [{ text: code || 'bundled output', path: 'out.js' }],
      errors: [],
    };
  }),
  transform: vi.fn().mockImplementation(async (code: string, _opts: any) => ({
    code: code, // Pass through for testing
    errors: [],
  })),
  stop: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock quickjs-emscripten
// ---------------------------------------------------------------------------

vi.mock('quickjs-emscripten', () => ({
  getQuickJS: vi.fn().mockResolvedValue({
    newRuntime: () => ({
      newContext: () => {
        return {
          evalCode: vi.fn().mockImplementation((_code: string) => {
            return { value: undefined, error: undefined };
          }),
          setProp: vi.fn(),
          getProp: vi.fn(),
          newFunction: vi.fn().mockReturnValue({ dispose: vi.fn() }),
          newString: vi.fn().mockImplementation((s: string) => ({ value: s, dispose: vi.fn() })),
          newObject: vi.fn().mockReturnValue({ dispose: vi.fn() }),
          dump: vi.fn().mockReturnValue(undefined),
          unwrapResult: vi.fn(),
          global: { value: 'global' },
          dispose: vi.fn(),
        };
      },
      setMemoryLimit: vi.fn(),
      setMaxStackSize: vi.fn(),
      dispose: vi.fn(),
    }),
  }),
}));

// Mock fflate
vi.mock('fflate', () => ({
  gunzipSync: (data: Uint8Array) => data,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

function fakeRegistry(name: string, version: string, deps: Record<string, string> = {}) {
  return {
    name,
    'dist-tags': { latest: version },
    versions: {
      [version]: {
        name,
        version,
        dependencies: deps,
        dist: { tarball: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz` },
      },
    },
  };
}

function buildFakeTarball(files: Array<{ name: string; content: string }>): ArrayBuffer {
  const parts: Uint8Array[] = [];
  for (const file of files) {
    const encoded = new TextEncoder().encode(file.content);
    const header = new Uint8Array(512);
    const nameWithPrefix = 'package/' + file.name;
    header.set(new TextEncoder().encode(nameWithPrefix), 0);
    const sizeOctal = encoded.length.toString(8).padStart(11, '0');
    header.set(new TextEncoder().encode(sizeOctal), 124);
    header[156] = '0'.charCodeAt(0);
    parts.push(header);
    const paddedSize = Math.ceil(encoded.length / 512) * 512;
    const dataBlock = new Uint8Array(paddedSize);
    dataBlock.set(encoded, 0);
    parts.push(dataBlock);
  }
  parts.push(new Uint8Array(1024));
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const archive = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) { archive.set(part, offset); offset += part.length; }
  return archive.buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Compatibility', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    vfs = new VirtualFileSystem('javascript', '');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Package resolution ────────────────────────────────────────────────

  describe('package resolution', () => {
    const packages = [
      'lodash', 'axios', 'chalk', 'commander', 'express',
      'react', 'react-dom', 'uuid', 'dayjs', 'zod',
      'debug', 'minimist', 'rimraf', 'semver', 'glob',
      'yargs', 'inquirer', 'dotenv', 'cors', 'morgan',
    ];

    it.each(packages)('resolves %s without error', async (pkg) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistry(pkg, '1.0.0')),
      });
      const client = new NpmClient(vfs);
      const resolved = await client.resolvePackage(pkg);
      expect(resolved.name).toBe(pkg);
      expect(resolved.version).toBe('1.0.0');
      expect(resolved.tarballUrl).toBeTruthy();
    });
  });

  // ── Tar parsing ───────────────────────────────────────────────────────

  describe('tar parsing edge cases', () => {
    it('handles package with nested directories', () => {
      const archive = new Uint8Array(buildFakeTarball([
        { name: 'lib/index.js', content: 'exports.main = true;' },
        { name: 'lib/utils/helper.js', content: 'exports.help = true;' },
        { name: 'package.json', content: '{"name":"nested","main":"lib/index.js"}' },
      ]));
      const files = parseTar(archive);
      expect(files).toHaveLength(3);
      expect(files[0].name).toBe('lib/index.js');
      expect(files[1].name).toBe('lib/utils/helper.js');
    });

    it('handles package with README and LICENSE', () => {
      const archive = new Uint8Array(buildFakeTarball([
        { name: 'index.js', content: 'module.exports = {}' },
        { name: 'README.md', content: '# Hello' },
        { name: 'LICENSE', content: 'MIT' },
        { name: 'package.json', content: '{}' },
      ]));
      const files = parseTar(archive);
      expect(files).toHaveLength(4);
    });

    it('handles minified JavaScript content', () => {
      const minified = 'var a=function(b){return b*2};module.exports=a;';
      const archive = new Uint8Array(buildFakeTarball([
        { name: 'index.js', content: minified },
      ]));
      const files = parseTar(archive);
      expect(files[0].content).toBe(minified);
    });
  });

  // ── Node polyfills ────────────────────────────────────────────────────

  describe('Node polyfills integration', () => {
    it('fs reads/writes round-trip correctly', () => {
      const polyfills = createPolyfills(vfs);
      polyfills.fs.writeFileSync('/home/user/round-trip.txt', 'hello world');
      const content = polyfills.fs.readFileSync('/home/user/round-trip.txt', 'utf-8');
      expect(content).toBe('hello world');
    });

    it('fs mkdir + writeFile + readdirSync flow', () => {
      const polyfills = createPolyfills(vfs);
      polyfills.fs.mkdirSync('/home/user/src', { recursive: true });
      polyfills.fs.writeFileSync('/home/user/src/a.ts', 'const a = 1;');
      polyfills.fs.writeFileSync('/home/user/src/b.ts', 'const b = 2;');
      const entries = polyfills.fs.readdirSync('/home/user/src');
      expect(entries).toContain('a.ts');
      expect(entries).toContain('b.ts');
    });

    it('path.join + path.dirname work together', () => {
      const polyfills = createPolyfills(vfs);
      const full = polyfills.path.join('/home', 'user', 'src', 'index.ts');
      const dir = polyfills.path.dirname(full);
      expect(dir).toBe('/home/user/src');
    });

    it('path.resolve works relative to VFS cwd', () => {
      const polyfills = createPolyfills(vfs);
      const resolved = polyfills.path.resolve('src', 'index.ts');
      expect(resolved).toContain('src/index.ts');
    });

    it('Buffer.from + toString round-trip', () => {
      const polyfills = createPolyfills(vfs);
      const buf = polyfills.buffer.Buffer.from('test data');
      expect(buf.toString()).toBe('test data');
    });

    it('EventEmitter emit + on pattern', () => {
      const polyfills = createPolyfills(vfs);
      const ee = new polyfills.events.EventEmitter();
      const results: string[] = [];
      ee.on('data', (msg: string) => results.push(msg));
      ee.emit('data', 'hello');
      ee.emit('data', 'world');
      expect(results).toEqual(['hello', 'world']);
    });

    it('process.cwd matches VFS cwd', () => {
      const polyfills = createPolyfills(vfs);
      expect(polyfills.process.cwd()).toBe(vfs.getCwd());
      vfs.mkdir('/home/user/src');
      vfs.setCwd('/home/user/src');
      expect(polyfills.process.cwd()).toBe('/home/user/src');
    });

    it('crypto.randomBytes returns unique values', () => {
      const polyfills = createPolyfills(vfs);
      const a = polyfills.crypto.randomBytes(16);
      const b = polyfills.crypto.randomBytes(16);
      expect(a.length).toBe(16);
      expect(b.length).toBe(16);
      // Extremely unlikely to be equal
      expect(a.toString('hex')).not.toBe(b.toString('hex'));
    });

    it('assert.strictEqual passes for equal, throws for unequal', () => {
      const polyfills = createPolyfills(vfs);
      expect(() => polyfills.assert.strictEqual(42, 42)).not.toThrow();
      expect(() => polyfills.assert.strictEqual(1, 2)).toThrow();
    });

    it('URL parsing works', () => {
      const polyfills = createPolyfills(vfs);
      const url = new polyfills.url.URL('https://api.example.com/v1/users?page=2');
      expect(url.hostname).toBe('api.example.com');
      expect(url.pathname).toBe('/v1/users');
      expect(url.searchParams.get('page')).toBe('2');
    });
  });

  // ── npm install → VFS integration ─────────────────────────────────────

  describe('npm install → VFS integration', () => {
    it('install writes files to correct paths in VFS', async () => {
      const tarball = buildFakeTarball([
        { name: 'index.js', content: 'module.exports = { add: (a,b) => a+b };' },
        { name: 'package.json', content: '{"name":"math-lib","version":"1.0.0","main":"index.js"}' },
      ]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('math-lib', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });

      const client = new NpmClient(vfs);
      await client.install(['math-lib']);

      expect(vfs.readFile('/home/user/node_modules/math-lib/index.js')).toContain('add');
      expect(vfs.readFile('/home/user/node_modules/math-lib/package.json')).toContain('math-lib');
    });

    it('install with transitive deps writes all packages', async () => {
      const tarballA = buildFakeTarball([
        { name: 'index.js', content: 'require("dep-b")' },
        { name: 'package.json', content: '{"name":"dep-a","version":"1.0.0"}' },
      ]);
      const tarballB = buildFakeTarball([
        { name: 'index.js', content: 'module.exports = "b"' },
        { name: 'package.json', content: '{"name":"dep-b","version":"1.0.0"}' },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('dep-a', '1.0.0', { 'dep-b': '^1.0.0' })),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('dep-b', '1.0.0')),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(tarballA) })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(tarballB) });

      const client = new NpmClient(vfs);
      await client.install(['dep-a']);

      expect(vfs.exists('/home/user/node_modules/dep-a/index.js')).toBe(true);
      expect(vfs.exists('/home/user/node_modules/dep-b/index.js')).toBe(true);
    });

    it('installFromPackageJson reads deps and installs them', async () => {
      vfs.writeFile('/home/user/package.json', JSON.stringify({
        name: 'my-project',
        dependencies: { 'my-dep': '^1.0.0' },
      }));

      const tarball = buildFakeTarball([
        { name: 'index.js', content: 'module.exports = 42' },
        { name: 'package.json', content: '{"name":"my-dep","version":"1.0.0"}' },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('my-dep', '1.0.0')),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(tarball) });

      const client = new NpmClient(vfs);
      await client.installFromPackageJson();

      expect(vfs.readFile('/home/user/node_modules/my-dep/index.js')).toBe('module.exports = 42');
    });
  });

  // ── esbuild VFS plugin ────────────────────────────────────────────────

  describe('esbuild VFS plugin', () => {
    it('plugin resolves and loads files from VFS', async () => {
      const { createVfsPlugin } = await import('./esbuild-bridge');
      vfs.writeFile('/home/user/src/utils.ts', 'export const add = (a:number, b:number) => a + b;');

      const plugin = createVfsPlugin(vfs);
      let resolvedPath = '';
      let loadedContent = '';

      const mockBuildApi = {
        onResolve: vi.fn((_opts: any, cb: any) => {
          const result = cb({ path: './utils', importer: '/home/user/src/index.ts' });
          resolvedPath = result.path;
        }),
        onLoad: vi.fn((_opts: any, cb: any) => {
          if (resolvedPath) {
            const result = cb({ path: resolvedPath });
            loadedContent = result.contents;
          }
        }),
      };

      plugin.setup(mockBuildApi as any);

      expect(resolvedPath).toBe('/home/user/src/utils.ts');
      expect(loadedContent).toContain('export const add');
    });

    it('plugin returns error for missing file', async () => {
      const { createVfsPlugin } = await import('./esbuild-bridge');
      const plugin = createVfsPlugin(vfs);

      let loadResult: any;
      const mockBuildApi = {
        onResolve: vi.fn(),
        onLoad: vi.fn((_opts: any, cb: any) => {
          loadResult = cb({ path: '/home/user/nonexistent.ts' });
        }),
      };
      plugin.setup(mockBuildApi as any);

      expect(loadResult.errors).toBeDefined();
      expect(loadResult.errors[0].text).toContain('not found');
    });

    it('plugin resolves node_modules packages', async () => {
      const { createVfsPlugin } = await import('./esbuild-bridge');
      vfs.writeFile('/home/user/node_modules/my-lib/index.js', 'module.exports = {}');
      vfs.writeFile('/home/user/node_modules/my-lib/package.json', '{"main":"index.js"}');

      const plugin = createVfsPlugin(vfs);
      let resolvedPath = '';

      const mockBuildApi = {
        onResolve: vi.fn((_opts: any, cb: any) => {
          const result = cb({ path: 'my-lib', importer: '/home/user/index.ts' });
          resolvedPath = result.path;
        }),
        onLoad: vi.fn(),
      };
      plugin.setup(mockBuildApi as any);

      expect(resolvedPath).toContain('node_modules/my-lib');
    });
  });

  // ── Full stack: npm install → esbuild resolve → VFS read ─────────────

  describe('full stack: install → resolve → read', () => {
    it('installed package is resolvable by esbuild plugin', async () => {
      // Install a fake package
      const tarball = buildFakeTarball([
        { name: 'index.js', content: 'export function greet() { return "hello"; }' },
        { name: 'package.json', content: '{"name":"greet-lib","version":"1.0.0","main":"index.js"}' },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('greet-lib', '1.0.0')),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(tarball) });

      const client = new NpmClient(vfs);
      await client.install(['greet-lib']);

      // Now use esbuild plugin to resolve it
      const { createVfsPlugin } = await import('./esbuild-bridge');
      const plugin = createVfsPlugin(vfs);

      let resolvedPath = '';
      let loadedContent = '';

      const mockBuildApi = {
        onResolve: vi.fn((_opts: any, cb: any) => {
          const result = cb({ path: 'greet-lib', importer: '/home/user/index.ts' });
          resolvedPath = result.path;
        }),
        onLoad: vi.fn((_opts: any, cb: any) => {
          if (resolvedPath) {
            const result = cb({ path: resolvedPath });
            loadedContent = result?.contents ?? '';
          }
        }),
      };
      plugin.setup(mockBuildApi as any);

      expect(resolvedPath).toContain('greet-lib');
      expect(loadedContent).toContain('greet');
    });

    it('project with package.json → install → files available in VFS', async () => {
      // Setup project
      vfs.writeFile('/home/user/package.json', JSON.stringify({
        name: 'test-project',
        dependencies: { 'util-pkg': '^1.0.0' },
      }));
      vfs.writeFile('/home/user/index.js', 'const u = require("util-pkg"); console.log(u.version);');

      const tarball = buildFakeTarball([
        { name: 'index.js', content: 'module.exports = { version: "1.0.0" };' },
        { name: 'package.json', content: '{"name":"util-pkg","version":"1.0.0","main":"index.js"}' },
      ]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistry('util-pkg', '1.0.0')),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(tarball) });

      const client = new NpmClient(vfs);
      await client.installFromPackageJson();

      // Verify full project state
      expect(vfs.readFile('/home/user/index.js')).toContain('require("util-pkg")');
      expect(vfs.readFile('/home/user/node_modules/util-pkg/index.js')).toContain('version');
      expect(vfs.readFile('/home/user/node_modules/util-pkg/package.json')).toContain('util-pkg');
    });
  });

  // ── Polyfills + VFS combined scenarios ────────────────────────────────

  describe('polyfills + VFS combined', () => {
    it('fs.writeFileSync + fs.readFileSync + fs.statSync chain', () => {
      const p = createPolyfills(vfs);
      p.fs.writeFileSync('/home/user/chain.txt', 'chained data');
      const content = p.fs.readFileSync('/home/user/chain.txt', 'utf-8');
      const stat = p.fs.statSync('/home/user/chain.txt');
      expect(content).toBe('chained data');
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBe(12);
    });

    it('fs.mkdirSync recursive + nested file creation', () => {
      const p = createPolyfills(vfs);
      p.fs.mkdirSync('/home/user/deep/nested/dir', { recursive: true });
      p.fs.writeFileSync('/home/user/deep/nested/dir/file.js', 'nested');
      expect(p.fs.existsSync('/home/user/deep/nested/dir/file.js')).toBe(true);
      const entries = p.fs.readdirSync('/home/user/deep/nested/dir');
      expect(entries).toContain('file.js');
    });

    it('fs.unlinkSync removes file, existsSync confirms', () => {
      const p = createPolyfills(vfs);
      p.fs.writeFileSync('/home/user/temp.txt', 'temp');
      expect(p.fs.existsSync('/home/user/temp.txt')).toBe(true);
      p.fs.unlinkSync('/home/user/temp.txt');
      expect(p.fs.existsSync('/home/user/temp.txt')).toBe(false);
    });

    it('fs.promises round-trip', async () => {
      const p = createPolyfills(vfs);
      await p.fs.promises.writeFile('/home/user/async.txt', 'async content');
      const content = await p.fs.promises.readFile('/home/user/async.txt', 'utf-8');
      expect(content).toBe('async content');
    });
  });
});
