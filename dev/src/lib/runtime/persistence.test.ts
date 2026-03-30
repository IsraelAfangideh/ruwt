import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { PackageCache, VfsPersistence } from './persistence';

// ---------------------------------------------------------------------------
// Mock IndexedDB
// ---------------------------------------------------------------------------

function createMockIDB() {
  const store = new Map<string, any>();
  const mockTransaction = {
    objectStore: () => ({
      get: vi.fn((key: string) => {
        const req = { result: store.get(key), onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      put: vi.fn((value: any, key: string) => {
        store.set(key, value);
        const req = { onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      delete: vi.fn((key: string) => {
        store.delete(key);
        const req = { onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      clear: vi.fn(() => {
        store.clear();
        const req = { onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      getAll: vi.fn(() => {
        const req = { result: [...store.values()], onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      getAllKeys: vi.fn(() => {
        const req = { result: [...store.keys()], onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      count: vi.fn(() => {
        const req = { result: store.size, onsuccess: null as any, onerror: null as any };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
    }),
  };
  const mockDb = {
    transaction: vi.fn(() => mockTransaction),
    close: vi.fn(),
  };
  return { store, mockDb, mockTransaction };
}

// ---------------------------------------------------------------------------
// Mock OPFS (navigator.storage.getDirectory)
// ---------------------------------------------------------------------------

function createMockOPFS() {
  const files = new Map<string, string>();
  const mockWritable = {
    write: vi.fn((data: string) => { files.set('current', data); }),
    close: vi.fn(),
  };
  const mockFileHandle = {
    createWritable: vi.fn().mockResolvedValue(mockWritable),
    getFile: vi.fn().mockImplementation(() =>
      Promise.resolve({
        text: () => Promise.resolve(files.get('current') ?? ''),
      }),
    ),
  };
  const mockRoot = {
    getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
  };
  return { files, mockRoot, mockFileHandle, mockWritable };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PackageCache', () => {
  let cache: PackageCache;
  let mockIDB: ReturnType<typeof createMockIDB>;

  beforeEach(() => {
    mockIDB = createMockIDB();
    cache = new PackageCache(mockIDB.mockDb as any);
  });

  it('stores data by key', async () => {
    const data = new ArrayBuffer(8);
    await cache.set('lodash@4.17.21', data);
    expect(mockIDB.store.has('lodash@4.17.21')).toBe(true);
  });

  it('retrieves cached data', async () => {
    const data = new ArrayBuffer(8);
    await cache.set('lodash@4.17.21', data);
    const result = await cache.get('lodash@4.17.21');
    expect(result).toBeDefined();
    expect(result!.data).toBe(data);
  });

  it('returns null for cache miss', async () => {
    const result = await cache.get('nonexistent@1.0.0');
    expect(result).toBeNull();
  });

  it('has returns true for cached packages', async () => {
    await cache.set('pkg@1.0.0', new ArrayBuffer(4));
    expect(await cache.has('pkg@1.0.0')).toBe(true);
  });

  it('has returns false for uncached packages', async () => {
    expect(await cache.has('nope@0.0.0')).toBe(false);
  });

  it('clear removes all entries', async () => {
    await cache.set('a@1', new ArrayBuffer(1));
    await cache.set('b@1', new ArrayBuffer(1));
    await cache.clear();
    expect(mockIDB.store.size).toBe(0);
  });
});

describe('VfsPersistence', () => {
  let vfs: VirtualFileSystem;
  let persistence: VfsPersistence;
  let mockOpfs: ReturnType<typeof createMockOPFS>;

  beforeEach(() => {
    vfs = new VirtualFileSystem('javascript', '');
    mockOpfs = createMockOPFS();
    persistence = new VfsPersistence(vfs, mockOpfs.mockRoot as any);
  });

  it('serializes VFS state to JSON', async () => {
    vfs.writeFile('/home/user/index.js', 'hello');
    await persistence.save();
    expect(mockOpfs.mockWritable.write).toHaveBeenCalledWith(
      expect.stringContaining('index.js'),
    );
  });

  it('writes serialized state to OPFS', async () => {
    vfs.writeFile('/home/user/test.js', 'code');
    await persistence.save();
    expect(mockOpfs.mockFileHandle.createWritable).toHaveBeenCalled();
    expect(mockOpfs.mockWritable.close).toHaveBeenCalled();
  });

  it('reads state from OPFS', async () => {
    // Pre-populate OPFS
    const state = JSON.stringify({
      files: { '/home/user/restored.js': 'restored code' },
      dirs: ['/home/user'],
      cwd: '/home/user',
    });
    mockOpfs.files.set('current', state);

    const loaded = await persistence.load();
    expect(loaded).toBe(true);
  });

  it('deserializes state back into VFS', async () => {
    const state = JSON.stringify({
      files: { '/home/user/restored.js': 'restored code' },
      dirs: ['/home/user'],
      cwd: '/home/user',
    });
    mockOpfs.files.set('current', state);

    await persistence.load();
    expect(vfs.readFile('/home/user/restored.js')).toBe('restored code');
  });

  it('handles empty VFS', async () => {
    await persistence.save();
    expect(mockOpfs.mockWritable.write).toHaveBeenCalled();
    const written = mockOpfs.mockWritable.write.mock.calls[0][0];
    const parsed = JSON.parse(written);
    expect(parsed.files).toBeDefined();
  });

  it('returns false when no saved state exists', async () => {
    mockOpfs.mockFileHandle.getFile.mockResolvedValueOnce({
      text: () => Promise.resolve(''),
    });
    const loaded = await persistence.load();
    expect(loaded).toBe(false);
  });

  it('handles OPFS unavailability gracefully', async () => {
    mockOpfs.mockRoot.getFileHandle.mockRejectedValueOnce(new Error('OPFS not available'));
    const loaded = await persistence.load();
    expect(loaded).toBe(false);
  });

  it('auto-saves at configurable interval', async () => {
    vi.useFakeTimers();
    const autoPersistence = new VfsPersistence(vfs, mockOpfs.mockRoot as any, { autoSaveMs: 1000 });
    autoPersistence.start();
    vfs.writeFile('/home/user/auto.js', 'auto');
    await vi.advanceTimersByTimeAsync(1100);
    expect(mockOpfs.mockWritable.write).toHaveBeenCalled();
    autoPersistence.stop();
    vi.useRealTimers();
  });

  it('stop cancels auto-save timer', () => {
    vi.useFakeTimers();
    const autoPersistence = new VfsPersistence(vfs, mockOpfs.mockRoot as any, { autoSaveMs: 1000 });
    autoPersistence.start();
    autoPersistence.stop();
    vfs.writeFile('/home/user/x.js', 'x');
    vi.advanceTimersByTime(2000);
    expect(mockOpfs.mockWritable.write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
