import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { NpmClient } from './npm-client';
import type { ResolvedPackage } from './npm-client';

// ---------------------------------------------------------------------------
// Mock fetch + fflate
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

const mockFetch = vi.fn();

// Mock fflate.gunzipSync to pass through data unchanged (tests use raw tar, not gzipped)
vi.mock('fflate', () => ({
  gunzipSync: (data: Uint8Array) => data,
}));

// ---------------------------------------------------------------------------
// Helper: create fake registry metadata
// ---------------------------------------------------------------------------

function fakeRegistryResponse(
  name: string,
  version: string,
  deps: Record<string, string> = {},
  tarball?: string,
) {
  return {
    name,
    'dist-tags': { latest: version },
    versions: {
      [version]: {
        name,
        version,
        dependencies: deps,
        dist: {
          tarball: tarball ?? `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        },
      },
    },
  };
}

/** Build a minimal raw tar archive (no gzip — fflate mock passes through). */
function buildFakeTarball(files: Array<{ name: string; content: string }>): ArrayBuffer {
  const parts: Uint8Array[] = [];
  for (const file of files) {
    const encoded = new TextEncoder().encode(file.content);
    // Header (512 bytes)
    const header = new Uint8Array(512);
    const nameWithPrefix = 'package/' + file.name;
    header.set(new TextEncoder().encode(nameWithPrefix), 0);
    const sizeOctal = encoded.length.toString(8).padStart(11, '0');
    header.set(new TextEncoder().encode(sizeOctal), 124);
    header[156] = '0'.charCodeAt(0); // regular file
    parts.push(header);
    // Data (padded to 512)
    const paddedSize = Math.ceil(encoded.length / 512) * 512;
    const dataBlock = new Uint8Array(paddedSize);
    dataBlock.set(encoded, 0);
    parts.push(dataBlock);
  }
  parts.push(new Uint8Array(1024)); // end of archive
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const archive = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    archive.set(part, offset);
    offset += part.length;
  }
  return archive.buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NpmClient', () => {
  let vfs: VirtualFileSystem;
  let client: NpmClient;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    vfs = new VirtualFileSystem('javascript', '');
    client = new NpmClient(vfs);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── resolvePackage ────────────────────────────────────────────────────

  describe('resolvePackage', () => {
    it('fetches registry metadata for a package', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('lodash', '4.17.21')),
      });
      const pkg = await client.resolvePackage('lodash');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('registry.npmjs.org/lodash'),
        expect.any(Object),
      );
      expect(pkg.name).toBe('lodash');
    });

    it('returns latest version when no version specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('lodash', '4.17.21')),
      });
      const pkg = await client.resolvePackage('lodash');
      expect(pkg.version).toBe('4.17.21');
    });

    it('returns tarball URL from dist field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('lodash', '4.17.21')),
      });
      const pkg = await client.resolvePackage('lodash');
      expect(pkg.tarballUrl).toContain('lodash-4.17.21.tgz');
    });

    it('returns dependency list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(fakeRegistryResponse('express', '4.18.2', { 'body-parser': '^1.20.0' })),
      });
      const pkg = await client.resolvePackage('express');
      expect(pkg.dependencies).toHaveProperty('body-parser');
    });

    it('throws for non-existent package (404)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(client.resolvePackage('nonexistent-pkg-xyz')).rejects.toThrow();
    });

    it('throws for network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      await expect(client.resolvePackage('lodash')).rejects.toThrow('network error');
    });

    it('caches registry metadata to avoid duplicate fetches', async () => {
      const response = fakeRegistryResponse('lodash', '4.17.21');
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(response) });
      await client.resolvePackage('lodash');
      await client.resolvePackage('lodash');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles scoped packages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('@scope/pkg', '1.0.0')),
      });
      const pkg = await client.resolvePackage('@scope/pkg');
      expect(pkg.name).toBe('@scope/pkg');
    });

    it('handles packages with no dependencies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('tiny', '1.0.0')),
      });
      const pkg = await client.resolvePackage('tiny');
      expect(pkg.dependencies).toEqual({});
    });
  });

  // ── resolveDependencyTree ─────────────────────────────────────────────

  describe('resolveDependencyTree', () => {
    it('resolves flat dependencies', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('a', '1.0.0')),
      });
      const tree = await client.resolveDependencyTree('a');
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('a');
    });

    it('resolves transitive dependencies', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('a', '1.0.0', { b: '^1.0.0' })),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('b', '1.0.0')),
        });
      const tree = await client.resolveDependencyTree('a');
      expect(tree).toHaveLength(2);
      expect(tree.map((p) => p.name)).toContain('b');
    });

    it('deduplicates shared dependencies', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('a', '1.0.0', { c: '^1.0.0' })),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('c', '1.0.0')),
        });
      const tree = await client.resolveDependencyTree('a');
      const names = tree.map((p) => p.name);
      const unique = [...new Set(names)];
      expect(names.length).toBe(unique.length);
    });

    it('handles circular dependency references without infinite loop', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('a', '1.0.0', { b: '^1.0.0' })),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('b', '1.0.0', { a: '^1.0.0' })),
        });
      const tree = await client.resolveDependencyTree('a');
      expect(tree.length).toBeLessThanOrEqual(2);
    });

    it('skips devDependencies', async () => {
      const meta = fakeRegistryResponse('a', '1.0.0');
      (meta.versions['1.0.0'] as any).devDependencies = { jest: '^29.0.0' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(meta) });
      const tree = await client.resolveDependencyTree('a');
      expect(tree.map((p) => p.name)).not.toContain('jest');
    });

    it('returns flat list of ResolvedPackage objects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('a', '1.0.0')),
      });
      const tree = await client.resolveDependencyTree('a');
      expect(tree[0]).toHaveProperty('name');
      expect(tree[0]).toHaveProperty('version');
      expect(tree[0]).toHaveProperty('tarballUrl');
      expect(tree[0]).toHaveProperty('dependencies');
    });
  });

  // ── fetchAndExtract ───────────────────────────────────────────────────

  describe('fetchAndExtract', () => {
    const pkg: ResolvedPackage = {
      name: 'test-pkg',
      version: '1.0.0',
      tarballUrl: 'https://registry.npmjs.org/test-pkg/-/test-pkg-1.0.0.tgz',
      dependencies: {},
    };

    it('fetches tarball from URL', async () => {
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'module.exports = {}' }]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(tarball),
      });
      await client.fetchAndExtract(pkg);
      expect(mockFetch).toHaveBeenCalledWith(pkg.tarballUrl);
    });

    it('writes extracted files to VFS under node_modules/<name>/', async () => {
      const tarball = buildFakeTarball([
        { name: 'index.js', content: 'module.exports = {}' },
        { name: 'package.json', content: '{"name":"test-pkg"}' },
      ]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(tarball),
      });
      await client.fetchAndExtract(pkg);
      expect(vfs.readFile('/home/user/node_modules/test-pkg/index.js')).toBe('module.exports = {}');
      expect(vfs.readFile('/home/user/node_modules/test-pkg/package.json')).toBe('{"name":"test-pkg"}');
    });

    it('creates necessary directories in VFS', async () => {
      const tarball = buildFakeTarball([
        { name: 'src/lib/utils.js', content: 'exports.foo = 1' },
      ]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(tarball),
      });
      await client.fetchAndExtract(pkg);
      expect(vfs.readFile('/home/user/node_modules/test-pkg/src/lib/utils.js')).toBe('exports.foo = 1');
    });

    it('throws on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(client.fetchAndExtract(pkg)).rejects.toThrow();
    });
  });

  // ── install ───────────────────────────────────────────────────────────

  describe('install', () => {
    it('resolves package, fetches tarball, extracts to VFS', async () => {
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'ok' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('mypkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });
      await client.install(['mypkg']);
      expect(vfs.readFile('/home/user/node_modules/mypkg/index.js')).toBe('ok');
    });

    it('skips already-installed packages', async () => {
      // Pre-install
      vfs.writeFile('/home/user/node_modules/mypkg/package.json', '{"version":"1.0.0"}');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('mypkg', '1.0.0')),
      });
      await client.install(['mypkg']);
      // Should only fetch registry, not tarball
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('reports progress via callback', async () => {
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'ok' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('mypkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });
      const progressCb = vi.fn();
      const unsub = client.onProgress(progressCb);
      await client.install(['mypkg']);
      unsub();
      expect(progressCb).toHaveBeenCalled();
    });

    it('creates node_modules directory if it does not exist', async () => {
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'ok' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('newpkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });
      await client.install(['newpkg']);
      expect(vfs.exists('/home/user/node_modules')).toBe(true);
    });
  });

  // ── installFromPackageJson ────────────────────────────────────────────

  describe('installFromPackageJson', () => {
    it('reads package.json from VFS and installs deps', async () => {
      vfs.writeFile(
        '/home/user/package.json',
        JSON.stringify({ dependencies: { mypkg: '^1.0.0' } }),
      );
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'ok' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('mypkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });
      await client.installFromPackageJson();
      expect(vfs.readFile('/home/user/node_modules/mypkg/index.js')).toBe('ok');
    });

    it('throws if package.json not found', async () => {
      await expect(client.installFromPackageJson()).rejects.toThrow();
    });

    it('handles empty dependencies object', async () => {
      vfs.writeFile('/home/user/package.json', JSON.stringify({ dependencies: {} }));
      await client.installFromPackageJson();
      // Should not throw, no packages to install
    });
  });

  // ── registry URL ──────────────────────────────────────────────────────

  describe('registry URL', () => {
    it('defaults to https://registry.npmjs.org', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('x', '1.0.0')),
      });
      await client.resolvePackage('x');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/x',
        expect.any(Object),
      );
    });

    it('uses custom registry when configured', async () => {
      const custom = new NpmClient(vfs, { registry: 'https://my-registry.com' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('x', '1.0.0')),
      });
      await custom.resolvePackage('x');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://my-registry.com/x',
        expect.any(Object),
      );
    });
  });

  // ── PackageCache integration ──────────────────────────────────────────

  describe('PackageCache integration', () => {
    function createMockCache() {
      const store = new Map<string, any>();
      return {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, data: ArrayBuffer) => { store.set(key, { data, timestamp: Date.now() }); }),
        has: vi.fn(async (key: string) => store.has(key)),
        clear: vi.fn(async () => store.clear()),
        _store: store,
      };
    }

    it('checks cache before fetching tarball', async () => {
      const cache = createMockCache();
      const tarball = buildFakeTarball([{ name: 'index.js', content: 'cached' }]);
      cache._store.set('cached-pkg@1.0.0', { data: tarball, timestamp: Date.now() });

      const cachedClient = new NpmClient(vfs, { cache: cache as any });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(fakeRegistryResponse('cached-pkg', '1.0.0')),
      });
      // No tarball fetch mock needed — should use cache
      await cachedClient.install(['cached-pkg']);

      expect(cache.get).toHaveBeenCalledWith('cached-pkg@1.0.0');
      // Only 1 fetch (registry metadata), no tarball fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(vfs.readFile('/home/user/node_modules/cached-pkg/index.js')).toBe('cached');
    });

    it('stores tarball in cache after fetching', async () => {
      const cache = createMockCache();
      const cachedClient = new NpmClient(vfs, { cache: cache as any });

      const tarball = buildFakeTarball([{ name: 'index.js', content: 'fresh' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('fresh-pkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });

      await cachedClient.install(['fresh-pkg']);

      expect(cache.set).toHaveBeenCalledWith('fresh-pkg@1.0.0', expect.any(ArrayBuffer));
    });

    it('falls back to network on cache miss', async () => {
      const cache = createMockCache();
      const cachedClient = new NpmClient(vfs, { cache: cache as any });

      const tarball = buildFakeTarball([{ name: 'index.js', content: 'network' }]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fakeRegistryResponse('net-pkg', '1.0.0')),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(tarball),
        });

      await cachedClient.install(['net-pkg']);

      // 2 fetches: registry + tarball
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(vfs.readFile('/home/user/node_modules/net-pkg/index.js')).toBe('network');
    });
  });
});
