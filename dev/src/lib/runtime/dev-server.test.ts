import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { DevServer } from './dev-server';

// ---------------------------------------------------------------------------
// Mock esbuild-bridge
// ---------------------------------------------------------------------------

const mockBundle = vi.fn().mockResolvedValue({
  code: 'console.log("bundled")',
  css: undefined,
  errors: [],
});
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('./esbuild-bridge', () => ({
  initialize: (...args: unknown[]) => mockInitialize(...args),
  bundle: (...args: unknown[]) => mockBundle(...args),
}));

// ---------------------------------------------------------------------------
// Mock browser APIs (navigator.serviceWorker, caches)
// ---------------------------------------------------------------------------

const mockSwRegister = vi.fn().mockResolvedValue({ active: true });
const mockSwUnregister = vi.fn().mockResolvedValue(true);
const mockGetRegistrations = vi.fn().mockResolvedValue([]);

const mockCachePut = vi.fn().mockResolvedValue(undefined);
const mockCacheDelete = vi.fn().mockResolvedValue(true);
const mockCacheOpen = vi.fn().mockResolvedValue({
  put: mockCachePut,
  delete: mockCacheDelete,
});
const mockCachesDelete = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  vi.clearAllMocks();

  // navigator.serviceWorker
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        register: mockSwRegister,
        getRegistrations: mockGetRegistrations,
      },
    },
    writable: true,
    configurable: true,
  });

  // caches API
  Object.defineProperty(globalThis, 'caches', {
    value: {
      open: mockCacheOpen,
      delete: mockCachesDelete,
    },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DevServer', () => {
  let vfs: VirtualFileSystem;
  let server: DevServer;

  beforeEach(() => {
    vfs = new VirtualFileSystem('typescript', '');
    vfs.writeFile('/home/user/index.tsx', 'console.log("app")');
    server = new DevServer(vfs);
  });

  describe('constructor', () => {
    it('accepts a VFS', () => {
      expect(server).toBeDefined();
    });

    it('defaults port to 3000', () => {
      expect(server.getPreviewUrl()).toContain('3000');
    });
  });

  describe('start', () => {
    it('registers the service worker', async () => {
      await server.start();
      expect(mockSwRegister).toHaveBeenCalledWith(
        expect.stringContaining('sw-runtime.js'),
        expect.any(Object),
      );
    });

    it('bundles the entry point with esbuild', async () => {
      await server.start({ entry: '/home/user/index.tsx' });
      expect(mockBundle).toHaveBeenCalledWith('/home/user/index.tsx', vfs);
    });

    it('writes bundled output to cache', async () => {
      await server.start();
      expect(mockCachePut).toHaveBeenCalled();
    });

    it('generates index.html in cache', async () => {
      await server.start();
      // Should put at least index.html and the bundle js
      const putCalls = mockCachePut.mock.calls;
      const urls = putCalls.map((c: any) => {
        const req = c[0];
        return typeof req === 'string' ? req : req.url;
      });
      expect(urls.some((u: string) => u.includes('index.html'))).toBe(true);
    });

    it('returns the preview URL', async () => {
      const url = await server.start();
      expect(url).toContain('3000');
    });

    it('uses custom port when specified', async () => {
      const customServer = new DevServer(vfs, { port: 8080 });
      const url = await customServer.start();
      expect(url).toContain('8080');
    });

    it('uses custom entry point when specified', async () => {
      vfs.writeFile('/home/user/main.ts', 'export default 1');
      await server.start({ entry: '/home/user/main.ts' });
      expect(mockBundle).toHaveBeenCalledWith('/home/user/main.ts', vfs);
    });
  });

  describe('rebuild', () => {
    it('re-bundles the entry point', async () => {
      await server.start();
      mockBundle.mockClear();
      await server.rebuild();
      expect(mockBundle).toHaveBeenCalledTimes(1);
    });

    it('updates cache with new bundle', async () => {
      await server.start();
      mockCachePut.mockClear();
      await server.rebuild();
      expect(mockCachePut).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('deletes the preview cache', async () => {
      await server.start();
      await server.stop();
      expect(mockCachesDelete).toHaveBeenCalled();
    });
  });

  describe('watch', () => {
    it('subscribes to VFS onChange events', async () => {
      await server.start();
      const unsub = server.watch();
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('triggers rebuild on file change', async () => {
      await server.start();
      mockBundle.mockClear();
      const unsub = server.watch();
      // Simulate file change
      vfs.writeFile('/home/user/index.tsx', 'updated code');
      // Debounce — wait a tick
      await new Promise((r) => setTimeout(r, 350));
      expect(mockBundle).toHaveBeenCalled();
      unsub();
    });

    it('ignores changes to node_modules', async () => {
      await server.start();
      mockBundle.mockClear();
      const unsub = server.watch();
      vfs.writeFile('/home/user/node_modules/pkg/index.js', 'x');
      await new Promise((r) => setTimeout(r, 350));
      expect(mockBundle).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('getPreviewUrl', () => {
    it('returns URL with the configured port', () => {
      const s = new DevServer(vfs, { port: 5173 });
      expect(s.getPreviewUrl()).toContain('5173');
    });
  });
});
