/**
 * Persistence layer for the Ruwt Runtime.
 *
 * - PackageCache: IndexedDB cache for npm package tarballs
 * - VfsPersistence: OPFS persistence for VirtualFileSystem state
 */
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { HOME_DIR } from './constants';

// ---------------------------------------------------------------------------
// PackageCache — IndexedDB for npm tarballs
// ---------------------------------------------------------------------------

export interface CacheEntry {
  data: ArrayBuffer;
  timestamp: number;
}

export class PackageCache {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async get(key: string): Promise<CacheEntry | null> {
    return new Promise((resolve) => {
      const tx = this.db.transaction('packages', 'readonly' as any);
      const store = tx.objectStore('packages');
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ?? null);
      };
      req.onerror = /* istanbul ignore next -- @preserve */ () => resolve(null);
    });
  }

  async set(key: string, data: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      const tx = this.db.transaction('packages', 'readwrite' as any);
      const store = tx.objectStore('packages');
      const req = store.put({ data, timestamp: Date.now() }, key);
      req.onsuccess = () => resolve();
      req.onerror = /* istanbul ignore next -- @preserve */ () => resolve();
    });
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  async clear(): Promise<void> {
    return new Promise((resolve) => {
      const tx = this.db.transaction('packages', 'readwrite' as any);
      const store = tx.objectStore('packages');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = /* istanbul ignore next -- @preserve */ () => resolve();
    });
  }
}

// ---------------------------------------------------------------------------
// VfsPersistence — OPFS for VFS state
// ---------------------------------------------------------------------------

interface VfsSnapshot {
  files: Record<string, string>;
  dirs: string[];
  cwd: string;
}

interface VfsPersistenceOptions {
  autoSaveMs?: number;
}

const VFS_FILENAME = 'ruwt-vfs.json';

export class VfsPersistence {
  private vfs: VirtualFileSystem;
  private root: FileSystemDirectoryHandle;
  private autoSaveMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    vfs: VirtualFileSystem,
    root: FileSystemDirectoryHandle,
    options?: VfsPersistenceOptions,
  ) {
    this.vfs = vfs;
    this.root = root;
    this.autoSaveMs = options?.autoSaveMs ?? 30_000;
  }

  /** Serialize VFS state and write to OPFS. */
  async save(): Promise<void> {
    const snapshot = this.serialize();
    const json = JSON.stringify(snapshot);

    try {
      const fileHandle = await this.root.getFileHandle(VFS_FILENAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch {
      // OPFS unavailable — silent failure
    }
  }

  /** Load VFS state from OPFS. Returns true if state was restored. */
  async load(): Promise<boolean> {
    try {
      const fileHandle = await this.root.getFileHandle(VFS_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (!text) return false;

      const snapshot: VfsSnapshot = JSON.parse(text);
      this.deserialize(snapshot);
      return true;
    } catch {
      return false;
    }
  }

  /** Start auto-saving on interval. */
  start(): void {
    this.stop();
    this.timer = setInterval(() => {
      this.save().catch(/* istanbul ignore next -- @preserve */ () => {});
    }, this.autoSaveMs);
  }

  /** Stop auto-saving. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────

  private serialize(): VfsSnapshot {
    const files: Record<string, string> = {};
    const dirs: string[] = [];

    // Walk the VFS to collect all files and directories
    this.walkDir(HOME_DIR, files, dirs);

    return {
      files,
      dirs,
      cwd: this.vfs.getCwd(),
    };
  }

  private walkDir(
    dirPath: string,
    files: Record<string, string>,
    dirs: string[],
  ): void {
    const entries = this.vfs.readdir(dirPath);
    if (!entries) return;

    dirs.push(dirPath);

    for (const entry of entries) {
      const fullPath = dirPath === '/' ? '/' + entry : dirPath + '/' + entry;
      const stat = this.vfs.stat(fullPath);
      if (!stat) continue;

      if (stat.isDirectory) {
        this.walkDir(fullPath, files, dirs);
      } else {
        const content = this.vfs.readFile(fullPath);
        if (content !== null) {
          files[fullPath] = content;
        }
      }
    }
  }

  private deserialize(snapshot: VfsSnapshot): void {
    // Create directories first
    for (const dir of snapshot.dirs) {
      if (!this.vfs.exists(dir)) {
        this.vfs.mkdir(dir);
      }
    }

    // Write files
    for (const [path, content] of Object.entries(snapshot.files)) {
      this.vfs.writeFile(path, content);
    }

    // Restore cwd
    if (snapshot.cwd) {
      this.vfs.setCwd(snapshot.cwd);
    }
  }
}
