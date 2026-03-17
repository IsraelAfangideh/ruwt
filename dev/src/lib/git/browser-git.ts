/**
 * browser-git.ts: isomorphic-git wrapper that works with WebContainer's filesystem.
 *
 * Creates a thin adapter bridging WebContainer's fs API to the PromiseFsClient
 * interface that isomorphic-git expects. Exposes clone, status, add, commit,
 * push, log, diff, and currentBranch operations.
 */
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { getWebContainer } from '@/lib/sandbox/webcontainer';
import type { WebContainer } from '@webcontainer/api';

// ── Types ──────────────────────────────────────────────────────────────

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'unmodified';

export interface GitStatusEntry {
  filepath: string;
  status: GitFileStatus;
}

export interface GitLogEntry {
  oid: string;
  message: string;
  author: { name: string; email: string; timestamp: number };
}

export interface CloneOptions {
  token?: string;
  onProgress?: (phase: string, loaded: number, total: number) => void;
}

export interface PushOptions {
  token?: string;
}

/** Stat-like result returned by probeStat */
interface StatResult {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
  mode: number;
  size: number;
  mtimeMs: number;
}

// ── Module-level cached fs adapter ─────────────────────────────────────

/** Cached adapter — rebuilt only when the container instance changes. */
let _cachedAdapter: ReturnType<typeof buildFsAdapter> | null = null;
let _cachedContainer: WebContainer | null = null;

function getCachedFsAdapter(container: WebContainer) {
  if (_cachedContainer === container && _cachedAdapter) return _cachedAdapter;
  _cachedAdapter = buildFsAdapter(container);
  _cachedContainer = container;
  return _cachedAdapter;
}

// ── WebContainer fs adapter ────────────────────────────────────────────

/**
 * Build a PromiseFsClient adapter for isomorphic-git from a WebContainer.
 *
 * WebContainer's fs lacks stat/lstat, so we probe with readFile (file-first)
 * and readdir (directory) to synthesise stat-like objects.
 *
 * Includes a stat cache that is invalidated on writes, unlinks, mkdirs, and rmdirs.
 * Uses a write-tracking map for stable mtimeMs values so isomorphic-git's
 * change detection cache works correctly.
 */
function buildFsAdapter(container: WebContainer) {
  /** Stat cache — keyed by path, invalidated on mutating operations */
  const statCache = new Map<string, StatResult>();

  /**
   * Write-tracking map: path -> monotonic counter.
   * Incremented on each write so isomorphic-git sees mtime changes.
   */
  const writeTimes = new Map<string, number>();
  let writeCounter = 1;

  /** Get a stable mtimeMs for a path. Returns 1 for never-written paths. */
  const getMtimeMs = (path: string): number => writeTimes.get(path) ?? 1;

  /** Invalidate stat cache for a path and its parent directory. */
  const invalidateStat = (path: string) => {
    statCache.delete(path);
    // Also invalidate parent directory since its listing may have changed
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash > 0) statCache.delete(path.slice(0, lastSlash));
    else statCache.delete('.');
  };

  const fs = {
    promises: {
      readFile: async (path: string, opts?: { encoding?: string } | string) => {
        const encoding = typeof opts === 'string' ? opts : opts?.encoding;
        if (encoding === 'utf8' || encoding === 'utf-8') {
          return container.fs.readFile(path, 'utf-8');
        }
        // isomorphic-git often reads without encoding (wants Uint8Array)
        return container.fs.readFile(path);
      },

      writeFile: async (path: string, data: string | Uint8Array, opts?: { mode?: number } | string) => {
        // WebContainer.fs.writeFile accepts string or Uint8Array
        const _opts = opts; // keep TS happy about unused
        void _opts;
        await container.fs.writeFile(path, data as string);
        invalidateStat(path);
        writeTimes.set(path, ++writeCounter);
      },

      unlink: async (path: string) => {
        await container.fs.rm(path);
        invalidateStat(path);
        writeTimes.delete(path);
      },

      readdir: async (path: string) => {
        return container.fs.readdir(path);
      },

      mkdir: async (path: string, opts?: { recursive?: boolean }) => {
        if (opts?.recursive) {
          await container.fs.mkdir(path, { recursive: true });
        } else {
          await container.fs.mkdir(path);
        }
        invalidateStat(path);
      },

      rmdir: async (path: string) => {
        await container.fs.rm(path, { recursive: true });
        invalidateStat(path);
      },

      /**
       * stat: isomorphic-git needs isFile(), isDirectory(), isSymbolicLink(),
       * mode, size, and mtimeMs. We probe file-first, then directory.
       */
      stat: async (path: string) => {
        return probeStat(container, path, statCache, getMtimeMs);
      },

      lstat: async (path: string) => {
        // WebContainer has no symlinks, so lstat === stat
        return probeStat(container, path, statCache, getMtimeMs);
      },

      readlink: async (path: string) => {
        // WebContainer doesn't support symlinks; throw ENOENT-like error
        const _path = path;
        void _path;
        throw Object.assign(new Error('readlink not supported'), { code: 'ENOENT' });
      },

      symlink: async (target: string, path: string) => {
        // no-op: WebContainer doesn't support symlinks
        const _t = target;
        const _p = path;
        void _t;
        void _p;
      },

      chmod: async (path: string, mode: number) => {
        // no-op: WebContainer doesn't support chmod
        const _p = path;
        const _m = mode;
        void _p;
        void _m;
      },
    },
  };
  return fs;
}

/**
 * Probe a path to determine if it's a file or directory and return
 * a stat-like object that isomorphic-git can use.
 *
 * Probes file-first (readFile existence check) since most paths are files,
 * avoiding the cost of a readdir exception on the common path.
 * Returns size: 0 for files — isomorphic-git doesn't use size for most operations.
 * Uses a stable mtimeMs from the write-tracking map.
 */
async function probeStat(
  container: WebContainer,
  path: string,
  cache: Map<string, StatResult>,
  getMtimeMs: (p: string) => number,
) {
  const cached = cache.get(path);
  if (cached) return cached;

  // Try readFile first — most paths are files, avoids readdir exception cost
  try {
    await container.fs.readFile(path);
    const result: StatResult = {
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      mode: 0o100644,
      size: 0,
      mtimeMs: getMtimeMs(path),
    };
    cache.set(path, result);
    return result;
  } catch {
    // Not a file — check if it's a directory below
  }

  // Try readdir — if it succeeds, it's a directory
  try {
    await container.fs.readdir(path);
    const result: StatResult = {
      isFile: () => false,
      isDirectory: () => true,
      isSymbolicLink: () => false,
      mode: 0o40755,
      size: 0,
      mtimeMs: getMtimeMs(path),
    };
    cache.set(path, result);
    return result;
  } catch {
    // Path doesn't exist — throw ENOENT
    throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), {
      code: 'ENOENT',
    });
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/** Clone a remote repo into the WebContainer filesystem. */
export async function clone(
  url: string,
  dir: string,
  options: CloneOptions = {},
): Promise<void> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);

  const authOptions = options.token
    ? { onAuth: () => ({ username: options.token!, password: 'x-oauth-basic' }) }
    : {};

  const progressOptions = options.onProgress
    ? {
        onProgress: (evt: { phase: string; loaded: number; total: number }) => {
          options.onProgress!(evt.phase, evt.loaded, evt.total);
        },
      }
    : {};

  await git.clone({
    fs,
    http,
    dir,
    url,
    singleBranch: true,
    depth: 1,
    ...authOptions,
    ...progressOptions,
  });
}

/**
 * Get per-file git status for the working directory.
 * Returns only files that differ from HEAD (modified, added, deleted, untracked).
 */
export async function status(dir: string): Promise<GitStatusEntry[]> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);

  const matrix = await git.statusMatrix({ fs, dir });
  const results: GitStatusEntry[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    const entry = mapStatusRow(filepath as string, head as number, workdir as number, stage as number);
    if (entry) results.push(entry);
  }

  return results;
}

/** Stage a file for commit. */
export async function add(dir: string, filepath: string): Promise<void> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);
  await git.add({ fs, dir, filepath });
}

/** Unstage a file (remove from the index). */
export async function unstage(dir: string, filepath: string): Promise<void> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);
  await git.remove({ fs, dir, filepath });
}

/** Create a commit with the staged changes. */
export async function commit(
  dir: string,
  message: string,
  author: { name: string; email: string },
): Promise<string> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);
  return git.commit({ fs, dir, message, author });
}

/** Push the current branch to the remote. */
export async function push(dir: string, options: PushOptions = {}): Promise<void> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);

  const authOptions = options.token
    ? { onAuth: () => ({ username: options.token!, password: 'x-oauth-basic' }) }
    : {};

  await git.push({
    fs,
    http,
    dir,
    ...authOptions,
  });
}

/** Return recent commit log entries. */
export async function log(dir: string, depth: number = 10): Promise<GitLogEntry[]> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);

  const commits = await git.log({ fs, dir, depth });
  return commits.map((c) => ({
    oid: c.oid,
    message: c.commit.message,
    author: {
      name: c.commit.author.name,
      email: c.commit.author.email,
      timestamp: c.commit.author.timestamp,
    },
  }));
}

/**
 * Show which files have unstaged changes (diff between workdir and stage).
 * Returns files with their change status.
 */
export async function diff(dir: string): Promise<GitStatusEntry[]> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);

  const matrix = await git.statusMatrix({ fs, dir });
  const results: GitStatusEntry[] = [];

  for (const [filepath, _head, workdir, stage] of matrix) {
    // workdir !== stage means there are unstaged changes
    if (workdir !== stage) {
      const fileStatus = workdir === 0 ? 'deleted' : stage === 0 ? 'untracked' : 'modified';
      results.push({ filepath: filepath as string, status: fileStatus });
    }
  }

  return results;
}

/** Get the current branch name. */
export async function currentBranch(dir: string): Promise<string | null> {
  const container = await getWebContainer();
  const fs = getCachedFsAdapter(container);
  const branch = await git.currentBranch({ fs, dir });
  return branch ?? null;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Map a statusMatrix row to a GitStatusEntry.
 * statusMatrix columns: [filepath, HEAD, WORKDIR, STAGE]
 * Values: 0 = absent, 1 = present/unmodified, 2 = modified
 *
 * Returns null for unmodified files.
 */
function mapStatusRow(
  filepath: string,
  head: number,
  workdir: number,
  _stage: number,
): GitStatusEntry | null {
  // Unmodified: same in HEAD, workdir, and stage
  if (head === 1 && workdir === 1) return null;

  // New file (not in HEAD, present in workdir)
  if (head === 0 && workdir === 2) return { filepath, status: 'added' };

  // Deleted (in HEAD, absent from workdir)
  if (head === 1 && workdir === 0) return { filepath, status: 'deleted' };

  // Modified (in HEAD, changed in workdir)
  if (head === 1 && workdir === 2) return { filepath, status: 'modified' };

  // Catch-all for other non-trivial statuses
  if (workdir !== head) return { filepath, status: 'untracked' };

  return null;
}

/** Exported for testing only */
export const _testExports = {
  buildFsAdapter,
  probeStat,
  mapStatusRow,
  /** Reset the module-level cached adapter (for test isolation) */
  resetCachedAdapter: () => {
    _cachedAdapter = null;
    _cachedContainer = null;
  },
};
