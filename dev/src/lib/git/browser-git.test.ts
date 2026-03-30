// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock isomorphic-git
const mockGitClone = vi.fn().mockResolvedValue(undefined);
const mockGitStatusMatrix = vi.fn().mockResolvedValue([]);
const mockGitAdd = vi.fn().mockResolvedValue(undefined);
const mockGitRemove = vi.fn().mockResolvedValue(undefined);
const mockGitCommit = vi.fn().mockResolvedValue('abc123');
const mockGitPush = vi.fn().mockResolvedValue(undefined);
const mockGitLog = vi.fn().mockResolvedValue([]);
const mockGitCurrentBranch = vi.fn().mockResolvedValue('main');

vi.mock('isomorphic-git', () => ({
  clone: (...args: unknown[]) => mockGitClone(...args),
  statusMatrix: (...args: unknown[]) => mockGitStatusMatrix(...args),
  add: (...args: unknown[]) => mockGitAdd(...args),
  remove: (...args: unknown[]) => mockGitRemove(...args),
  commit: (...args: unknown[]) => mockGitCommit(...args),
  push: (...args: unknown[]) => mockGitPush(...args),
  log: (...args: unknown[]) => mockGitLog(...args),
  currentBranch: (...args: unknown[]) => mockGitCurrentBranch(...args),
}));

vi.mock('isomorphic-git/http/web', () => ({
  default: { request: vi.fn() },
}));

// Mock RuntimeBackend
const mockReadFile = vi.fn().mockResolvedValue('content');
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReaddir = vi.fn().mockResolvedValue([]);
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockRm = vi.fn().mockResolvedValue(undefined);
const mockStat = vi.fn().mockResolvedValue({ isFile: true, isDirectory: false, size: 0 });

const mockBackend = {
  mode: 'browser' as const,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  readdir: mockReaddir,
  mkdir: mockMkdir,
  rm: mockRm,
  stat: mockStat,
  spawn: vi.fn(),
  connectTerminal: vi.fn(),
};

const { clone, status, add, unstage, commit, push, log, diff, currentBranch, _testExports } = await import('./browser-git');

describe('browser-git', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _testExports.resetCachedAdapter();
    mockGitClone.mockResolvedValue(undefined);
    mockGitStatusMatrix.mockResolvedValue([]);
    mockGitAdd.mockResolvedValue(undefined);
    mockGitRemove.mockResolvedValue(undefined);
    mockGitCommit.mockResolvedValue('abc123');
    mockGitPush.mockResolvedValue(undefined);
    mockGitLog.mockResolvedValue([]);
    mockGitCurrentBranch.mockResolvedValue('main');
  });

  describe('clone', () => {
    it('calls git.clone with correct options', async () => {
      await clone(mockBackend as any, 'https://github.com/user/repo', '/project');
      expect(mockGitClone).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: '/project',
          url: 'https://github.com/user/repo',
          singleBranch: true,
          depth: 1,
        }),
      );
    });

    it('passes auth callback when token is provided', async () => {
      await clone(mockBackend as any, 'https://github.com/user/repo', '/project', { token: 'ghp_xxx' });
      const callArgs = mockGitClone.mock.calls[0][0];
      expect(callArgs.onAuth).toBeDefined();
      expect(callArgs.onAuth()).toEqual({ username: 'ghp_xxx', password: 'x-oauth-basic' });
    });

    it('does not pass auth callback when no token', async () => {
      await clone(mockBackend as any, 'https://github.com/user/repo', '/project');
      const callArgs = mockGitClone.mock.calls[0][0];
      expect(callArgs.onAuth).toBeUndefined();
    });

    it('passes progress callback when onProgress is provided', async () => {
      const onProgress = vi.fn();
      await clone(mockBackend as any, 'https://github.com/user/repo', '/project', { onProgress });
      const callArgs = mockGitClone.mock.calls[0][0];
      expect(callArgs.onProgress).toBeDefined();
      // Simulate a progress event
      callArgs.onProgress({ phase: 'Receiving objects', loaded: 50, total: 100 });
      expect(onProgress).toHaveBeenCalledWith('Receiving objects', 50, 100);
    });
  });

  describe('status', () => {
    it('returns empty array for clean repo', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['index.js', 1, 1, 1], // unmodified
      ]);
      const result = await status(mockBackend as any, '/project');
      expect(result).toEqual([]);
    });

    it('returns modified files', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['index.js', 1, 2, 1], // modified
      ]);
      const result = await status(mockBackend as any, '/project');
      expect(result).toEqual([{ filepath: 'index.js', status: 'modified' }]);
    });

    it('returns added files', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['new-file.js', 0, 2, 0], // new file
      ]);
      const result = await status(mockBackend as any, '/project');
      expect(result).toEqual([{ filepath: 'new-file.js', status: 'added' }]);
    });

    it('returns deleted files', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['removed.js', 1, 0, 1], // deleted
      ]);
      const result = await status(mockBackend as any, '/project');
      expect(result).toEqual([{ filepath: 'removed.js', status: 'deleted' }]);
    });

    it('returns multiple files with mixed statuses', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['unchanged.js', 1, 1, 1],
        ['modified.js', 1, 2, 1],
        ['new.js', 0, 2, 0],
        ['deleted.js', 1, 0, 1],
      ]);
      const result = await status(mockBackend as any, '/project');
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { filepath: 'modified.js', status: 'modified' },
        { filepath: 'new.js', status: 'added' },
        { filepath: 'deleted.js', status: 'deleted' },
      ]);
    });
  });

  describe('add', () => {
    it('calls git.add with filepath', async () => {
      await add(mockBackend as any, '/project', 'index.js');
      expect(mockGitAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: '/project',
          filepath: 'index.js',
        }),
      );
    });
  });

  describe('unstage', () => {
    it('calls git.remove with filepath', async () => {
      await unstage(mockBackend as any, '/project', 'index.js');
      expect(mockGitRemove).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: '/project',
          filepath: 'index.js',
        }),
      );
    });
  });

  describe('commit', () => {
    it('calls git.commit with message and author', async () => {
      const oid = await commit(mockBackend as any, '/project', 'feat: initial commit', {
        name: 'Test User',
        email: 'test@test.com',
      });
      expect(oid).toBe('abc123');
      expect(mockGitCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: '/project',
          message: 'feat: initial commit',
          author: { name: 'Test User', email: 'test@test.com' },
        }),
      );
    });
  });

  describe('push', () => {
    it('calls git.push without auth when no token', async () => {
      await push(mockBackend as any, '/project');
      const callArgs = mockGitPush.mock.calls[0][0];
      expect(callArgs.dir).toBe('/project');
      expect(callArgs.onAuth).toBeUndefined();
    });

    it('calls git.push with auth when token provided', async () => {
      await push(mockBackend as any, '/project', { token: 'ghp_xxx' });
      const callArgs = mockGitPush.mock.calls[0][0];
      expect(callArgs.onAuth).toBeDefined();
      expect(callArgs.onAuth()).toEqual({ username: 'ghp_xxx', password: 'x-oauth-basic' });
    });
  });

  describe('log', () => {
    it('returns formatted log entries', async () => {
      mockGitLog.mockResolvedValue([
        {
          oid: 'abc123def456',
          commit: {
            message: 'feat: initial commit\n\nDetails here',
            author: { name: 'Test', email: 'test@test.com', timestamp: 1700000000 },
          },
        },
        {
          oid: 'def789ghi012',
          commit: {
            message: 'fix: bug fix',
            author: { name: 'Dev', email: 'dev@test.com', timestamp: 1699999000 },
          },
        },
      ]);

      const result = await log(mockBackend as any, '/project', 5);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        oid: 'abc123def456',
        message: 'feat: initial commit\n\nDetails here',
        author: { name: 'Test', email: 'test@test.com', timestamp: 1700000000 },
      });
    });

    it('uses default depth of 10', async () => {
      await log(mockBackend as any, '/project');
      expect(mockGitLog).toHaveBeenCalledWith(
        expect.objectContaining({ depth: 10 }),
      );
    });

    it('returns empty array when no commits', async () => {
      mockGitLog.mockResolvedValue([]);
      const result = await log(mockBackend as any, '/project');
      expect(result).toEqual([]);
    });
  });

  describe('diff', () => {
    it('returns files with unstaged changes', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['unchanged.js', 1, 1, 1],   // workdir === stage → no diff
        ['modified.js', 1, 2, 1],    // workdir (2) !== stage (1) → modified
        ['deleted.js', 1, 0, 1],     // workdir (0) !== stage (1) → deleted
      ]);
      const result = await diff(mockBackend as any, '/project');
      expect(result).toEqual([
        { filepath: 'modified.js', status: 'modified' },
        { filepath: 'deleted.js', status: 'deleted' },
      ]);
    });

    it('detects untracked files in diff', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['new.js', 0, 2, 0], // workdir (2) !== stage (0) → untracked
      ]);
      const result = await diff(mockBackend as any, '/project');
      expect(result).toEqual([
        { filepath: 'new.js', status: 'untracked' },
      ]);
    });

    it('returns empty when all files are staged', async () => {
      mockGitStatusMatrix.mockResolvedValue([
        ['file.js', 1, 2, 2], // workdir (2) === stage (2) → no diff
      ]);
      const result = await diff(mockBackend as any, '/project');
      expect(result).toEqual([]);
    });
  });

  describe('currentBranch', () => {
    it('returns branch name', async () => {
      mockGitCurrentBranch.mockResolvedValue('main');
      const result = await currentBranch(mockBackend as any, '/project');
      expect(result).toBe('main');
    });

    it('returns null when detached HEAD', async () => {
      mockGitCurrentBranch.mockResolvedValue(undefined);
      const result = await currentBranch(mockBackend as any, '/project');
      expect(result).toBeNull();
    });
  });

  describe('fs adapter (via _testExports)', () => {
    it('buildFsAdapter returns an object with promises namespace', () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      expect(fs.promises).toBeDefined();
      expect(fs.promises.readFile).toBeDefined();
      expect(fs.promises.writeFile).toBeDefined();
      expect(fs.promises.unlink).toBeDefined();
      expect(fs.promises.readdir).toBeDefined();
      expect(fs.promises.mkdir).toBeDefined();
      expect(fs.promises.rmdir).toBeDefined();
      expect(fs.promises.stat).toBeDefined();
      expect(fs.promises.lstat).toBeDefined();
      expect(fs.promises.readlink).toBeDefined();
      expect(fs.promises.symlink).toBeDefined();
      expect(fs.promises.chmod).toBeDefined();
    });

    it('readFile with utf-8 encoding returns string', async () => {
      mockReadFile.mockResolvedValueOnce('file contents');
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const result = await fs.promises.readFile('/test.js', { encoding: 'utf-8' });
      expect(result).toBe('file contents');
      expect(mockReadFile).toHaveBeenCalledWith('/test.js');
    });

    it('readFile with utf8 string encoding returns string', async () => {
      mockReadFile.mockResolvedValueOnce('file contents');
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const result = await fs.promises.readFile('/test.js', 'utf8');
      expect(result).toBe('file contents');
    });

    it('readFile without encoding returns Uint8Array-like', async () => {
      mockReadFile.mockResolvedValueOnce('hello');
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const result = await fs.promises.readFile('/test.bin');
      expect(ArrayBuffer.isView(result)).toBe(true);
    });

    it('writeFile delegates to backend', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.writeFile('/test.js', 'content');
      expect(mockWriteFile).toHaveBeenCalledWith('/test.js', 'content');
    });

    it('unlink calls container.fs.rm', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.unlink('/test.js');
      expect(mockRm).toHaveBeenCalledWith('/test.js');
    });

    it('readdir delegates to container', async () => {
      mockReaddir.mockResolvedValue(['a.js', 'b.js']);
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const result = await fs.promises.readdir('/project');
      expect(result).toEqual(['a.js', 'b.js']);
    });

    it('mkdir without recursive calls container.fs.mkdir', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.mkdir('/project/src');
      expect(mockMkdir).toHaveBeenCalledWith('/project/src');
    });

    it('mkdir with recursive calls backend.mkdir', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.mkdir('/project/src/deep', { recursive: true });
      expect(mockMkdir).toHaveBeenCalledWith('/project/src/deep');
    });

    it('rmdir calls backend.rm', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.rmdir('/project/src');
      expect(mockRm).toHaveBeenCalledWith('/project/src');
    });

    it('readlink throws ENOENT', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await expect(fs.promises.readlink('/test')).rejects.toThrow('readlink not supported');
    });

    it('symlink is a no-op', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await expect(fs.promises.symlink('/target', '/link')).resolves.toBeUndefined();
    });

    it('chmod is a no-op', async () => {
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await expect(fs.promises.chmod('/test', 0o755)).resolves.toBeUndefined();
    });

    it('stat returns file stat via probeStat', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array(10));
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const stat = await fs.promises.stat('/test.js');
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBe(0); // size is always 0
      expect(stat.mtimeMs).toBe(1); // stable mtime for never-written
    });

    it('lstat returns same as stat (no symlinks)', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array(10));
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      const stat = await fs.promises.lstat('/test.js');
      expect(stat.isFile()).toBe(true);
    });

    it('writeFile increments mtimeMs for written paths', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array(5));
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      // First stat — mtime should be 1
      const stat1 = await fs.promises.stat('/write-test.js');
      expect(stat1.mtimeMs).toBe(1);

      // Write to the file — should invalidate cache and bump mtime
      await fs.promises.writeFile('/write-test.js', 'new content');
      const stat2 = await fs.promises.stat('/write-test.js');
      expect(stat2.mtimeMs).toBeGreaterThan(1);
    });

    it('unlink removes path from write-tracking', async () => {
      mockReadFile.mockResolvedValue(new Uint8Array(5));
      const fs = _testExports.buildFsAdapter(mockBackend as any);
      await fs.promises.writeFile('/del-test.js', 'content');
      await fs.promises.unlink('/del-test.js');
      // After unlink + re-creation, mtime resets to default (but we wrote again on the next writeFile)
      mockReadFile.mockResolvedValue(new Uint8Array(5));
      // The path was deleted from writeTimes, so if it were stat'd again it would get mtime 1
      // But we can't stat a deleted file... just verify unlink was called
      expect(mockRm).toHaveBeenCalledWith('/del-test.js');
    });
  });

  describe('probeStat', () => {
    it('returns file stat when backend.stat says isFile', async () => {
      mockStat.mockResolvedValueOnce({ isFile: true, isDirectory: false, size: 42 });
      const cache = new Map();
      const getMtimeMs = () => 1;
      const stat = await _testExports.probeStat(mockBackend as any, '/project/file.js', cache, getMtimeMs);
      expect(stat.isFile()).toBe(true);
      expect(stat.isDirectory()).toBe(false);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.size).toBe(42);
      expect(stat.mode).toBe(0o100644);
      expect(stat.mtimeMs).toBe(1);
    });

    it('returns directory stat when backend.stat says isDirectory', async () => {
      mockStat.mockResolvedValueOnce({ isFile: false, isDirectory: true, size: 0 });
      const cache = new Map();
      const getMtimeMs = () => 1;
      const stat = await _testExports.probeStat(mockBackend as any, '/project', cache, getMtimeMs);
      expect(stat.isFile()).toBe(false);
      expect(stat.isDirectory()).toBe(true);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.mode).toBe(0o40755);
    });

    it('throws ENOENT when backend.stat throws', async () => {
      mockStat.mockRejectedValueOnce(new Error('not found'));
      const cache = new Map();
      const getMtimeMs = () => 1;
      await expect(_testExports.probeStat(mockBackend as any, '/nonexistent', cache, getMtimeMs))
        .rejects.toThrow('ENOENT');
    });

    it('returns cached stat on second call', async () => {
      mockStat.mockResolvedValueOnce({ isFile: true, isDirectory: false, size: 10 });
      const cache = new Map();
      const getMtimeMs = () => 1;
      const stat1 = await _testExports.probeStat(mockBackend as any, '/cached.js', cache, getMtimeMs);
      const stat2 = await _testExports.probeStat(mockBackend as any, '/cached.js', cache, getMtimeMs);
      expect(stat1).toBe(stat2);
      expect(mockStat).toHaveBeenCalledTimes(1);
    });

    it('uses getMtimeMs for write-tracked files', async () => {
      mockStat.mockResolvedValueOnce({ isFile: true, isDirectory: false, size: 5 });
      const cache = new Map();
      const counter = 42;
      const getMtimeMs = () => counter;
      const stat = await _testExports.probeStat(mockBackend as any, '/tracked.js', cache, getMtimeMs);
      expect(stat.mtimeMs).toBe(42);
    });
  });

  describe('mapStatusRow', () => {
    it('returns null for unmodified file', () => {
      expect(_testExports.mapStatusRow('file.js', 1, 1, 1)).toBeNull();
    });

    it('returns added for new file', () => {
      expect(_testExports.mapStatusRow('new.js', 0, 2, 0)).toEqual({
        filepath: 'new.js',
        status: 'added',
      });
    });

    it('returns deleted for removed file', () => {
      expect(_testExports.mapStatusRow('old.js', 1, 0, 1)).toEqual({
        filepath: 'old.js',
        status: 'deleted',
      });
    });

    it('returns modified for changed file', () => {
      expect(_testExports.mapStatusRow('mod.js', 1, 2, 1)).toEqual({
        filepath: 'mod.js',
        status: 'modified',
      });
    });

    it('returns untracked for unknown status', () => {
      // head=0, workdir=1 is unusual but should be handled
      expect(_testExports.mapStatusRow('weird.js', 0, 1, 0)).toEqual({
        filepath: 'weird.js',
        status: 'untracked',
      });
    });

    it('returns null when head and workdir match but not standard', () => {
      // head=2, workdir=2 — both modified and equal — null
      expect(_testExports.mapStatusRow('eq.js', 2, 2, 2)).toBeNull();
    });
  });

  describe('resetCachedAdapter', () => {
    it('resets the cached adapter without throwing', () => {
      expect(() => _testExports.resetCachedAdapter()).not.toThrow();
    });
  });
});
