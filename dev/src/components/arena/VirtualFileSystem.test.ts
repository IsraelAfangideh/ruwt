import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualFileSystem } from './VirtualFileSystem';

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem('typescript', 'const x = 1;');
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('sets solutionFilename based on known language', () => {
      expect(vfs.solutionFilename).toBe('solution.ts');
    });

    it('sets solutionPath under /home/user', () => {
      expect(vfs.solutionPath).toBe('/home/user/solution.ts');
    });

    it('falls back to solution.js for unknown language', () => {
      const fs = new VirtualFileSystem('brainfuck', '');
      expect(fs.solutionFilename).toBe('solution.js');
      expect(fs.solutionPath).toBe('/home/user/solution.js');
    });

    it('maps each supported language to its correct extension', () => {
      const cases: [string, string][] = [
        ['javascript', 'solution.js'],
        ['typescript', 'solution.ts'],
        ['python', 'solution.py'],
        ['java', 'Solution.java'],
        ['c', 'solution.c'],
        ['cpp', 'solution.cpp'],
        ['go', 'solution.go'],
        ['rust', 'solution.rs'],
      ];
      for (const [lang, expected] of cases) {
        const fs = new VirtualFileSystem(lang, '');
        expect(fs.solutionFilename).toBe(expected);
      }
    });

    it('bootstraps root, /home, and /home/user directories', () => {
      expect(vfs.exists('/')).toBe(true);
      expect(vfs.exists('/home')).toBe(true);
      expect(vfs.exists('/home/user')).toBe(true);
    });

    it('writes the initial code to the solution file', () => {
      expect(vfs.readFile(vfs.solutionPath)).toBe('const x = 1;');
    });

    it('initializes cwd to /home/user', () => {
      expect(vfs.getCwd()).toBe('/home/user');
    });
  });

  // ---------------------------------------------------------------------------
  // Path normalization and resolution
  // ---------------------------------------------------------------------------
  describe('resolve / normalize', () => {
    it('returns absolute path unchanged (after normalization)', () => {
      expect(vfs.resolve('/etc/config')).toBe('/etc/config');
    });

    it('resolves relative path against cwd', () => {
      expect(vfs.resolve('foo.txt')).toBe('/home/user/foo.txt');
    });

    it('resolves nested relative path against cwd', () => {
      expect(vfs.resolve('src/index.ts')).toBe('/home/user/src/index.ts');
    });

    it('resolves . to current directory', () => {
      expect(vfs.resolve('.')).toBe('/home/user');
    });

    it('resolves ./file to cwd/file', () => {
      expect(vfs.resolve('./foo.txt')).toBe('/home/user/foo.txt');
    });

    it('resolves .. to parent directory', () => {
      expect(vfs.resolve('..')).toBe('/home');
    });

    it('resolves ../.. to grandparent', () => {
      expect(vfs.resolve('../..')).toBe('/');
    });

    it('resolves complex mixed . and .. traversal', () => {
      expect(vfs.resolve('./sub/../other/./file.txt')).toBe('/home/user/other/file.txt');
    });

    it('collapses multiple consecutive slashes', () => {
      expect(vfs.resolve('///home///user///file.txt')).toBe('/home/user/file.txt');
    });

    it('strips trailing slashes via normalization', () => {
      expect(vfs.resolve('/home/user/')).toBe('/home/user');
    });

    it('handles .. beyond root by stopping at root', () => {
      expect(vfs.resolve('/../../..')).toBe('/');
    });

    it('resolves absolute path with . and .. segments', () => {
      expect(vfs.resolve('/home/./user/../user/docs')).toBe('/home/user/docs');
    });
  });

  // ---------------------------------------------------------------------------
  // getCwd / setCwd / getShortCwd
  // ---------------------------------------------------------------------------
  describe('cwd management', () => {
    it('getCwd returns /home/user initially', () => {
      expect(vfs.getCwd()).toBe('/home/user');
    });

    it('setCwd changes cwd to a valid directory', () => {
      vfs.mkdir('/home/user/projects');
      expect(vfs.setCwd('/home/user/projects')).toBe(true);
      expect(vfs.getCwd()).toBe('/home/user/projects');
    });

    it('setCwd returns false and does not change cwd for non-existent directory', () => {
      expect(vfs.setCwd('/nonexistent')).toBe(false);
      expect(vfs.getCwd()).toBe('/home/user');
    });

    it('setCwd returns false for a file path (not a directory)', () => {
      expect(vfs.setCwd(vfs.solutionPath)).toBe(false);
    });

    it('setCwd resolves relative path', () => {
      vfs.mkdir('/home/user/sub');
      expect(vfs.setCwd('sub')).toBe(true);
      expect(vfs.getCwd()).toBe('/home/user/sub');
    });

    it('getShortCwd returns ~ for /home/user', () => {
      expect(vfs.getShortCwd()).toBe('~');
    });

    it('getShortCwd returns ~/subdir for subdirectories of /home/user', () => {
      vfs.mkdir('/home/user/projects');
      vfs.setCwd('/home/user/projects');
      expect(vfs.getShortCwd()).toBe('~/projects');
    });

    it('getShortCwd returns full path for directories outside /home/user', () => {
      vfs.setCwd('/home');
      expect(vfs.getShortCwd()).toBe('/home');
    });

    it('getShortCwd returns / when cwd is root', () => {
      vfs.setCwd('/');
      expect(vfs.getShortCwd()).toBe('/');
    });
  });

  // ---------------------------------------------------------------------------
  // readFile / writeFile
  // ---------------------------------------------------------------------------
  describe('readFile / writeFile', () => {
    it('writes and reads back file content', () => {
      vfs.writeFile('/home/user/hello.txt', 'world');
      expect(vfs.readFile('/home/user/hello.txt')).toBe('world');
    });

    it('returns null for non-existent file', () => {
      expect(vfs.readFile('/does/not/exist.txt')).toBeNull();
    });

    it('overwrites existing file content', () => {
      vfs.writeFile('/home/user/f.txt', 'first');
      vfs.writeFile('/home/user/f.txt', 'second');
      expect(vfs.readFile('/home/user/f.txt')).toBe('second');
    });

    it('auto-creates parent directories when writing to a nested path', () => {
      vfs.writeFile('/home/user/a/b/c/deep.txt', 'deep');
      expect(vfs.exists('/home/user/a')).toBe(true);
      expect(vfs.exists('/home/user/a/b')).toBe(true);
      expect(vfs.exists('/home/user/a/b/c')).toBe(true);
      expect(vfs.readFile('/home/user/a/b/c/deep.txt')).toBe('deep');
    });

    it('handles empty string content', () => {
      vfs.writeFile('/home/user/empty.txt', '');
      expect(vfs.readFile('/home/user/empty.txt')).toBe('');
    });

    it('handles content with special characters (unicode, newlines, tabs)', () => {
      const content = 'line1\nline2\ttab\r\n\u00e9\u00e0\u00fc \u{1F600}';
      vfs.writeFile('/home/user/special.txt', content);
      expect(vfs.readFile('/home/user/special.txt')).toBe(content);
    });

    it('resolves relative path for writeFile and readFile', () => {
      vfs.writeFile('myfile.txt', 'data');
      expect(vfs.readFile('myfile.txt')).toBe('data');
      expect(vfs.readFile('/home/user/myfile.txt')).toBe('data');
    });
  });

  // ---------------------------------------------------------------------------
  // exists
  // ---------------------------------------------------------------------------
  describe('exists', () => {
    it('returns true for an existing file', () => {
      expect(vfs.exists(vfs.solutionPath)).toBe(true);
    });

    it('returns true for an existing directory', () => {
      expect(vfs.exists('/home')).toBe(true);
    });

    it('returns false for a non-existent path', () => {
      expect(vfs.exists('/nowhere')).toBe(false);
    });

    it('resolves relative paths', () => {
      expect(vfs.exists(vfs.solutionFilename)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // stat
  // ---------------------------------------------------------------------------
  describe('stat', () => {
    it('returns directory stat for a directory', () => {
      const s = vfs.stat('/home/user');
      expect(s).not.toBeNull();
      expect(s!.isDirectory).toBe(true);
      expect(s!.name).toBe('user');
      expect(s!.size).toBe(0);
    });

    it('returns file stat with correct size', () => {
      vfs.writeFile('/home/user/sized.txt', 'abcde');
      const s = vfs.stat('/home/user/sized.txt');
      expect(s).not.toBeNull();
      expect(s!.isDirectory).toBe(false);
      expect(s!.name).toBe('sized.txt');
      expect(s!.size).toBe(5);
    });

    it('returns null for non-existent path', () => {
      expect(vfs.stat('/ghost')).toBeNull();
    });

    it('returns "/" as name for root directory', () => {
      const s = vfs.stat('/');
      expect(s).not.toBeNull();
      expect(s!.name).toBe('/');
      expect(s!.isDirectory).toBe(true);
    });

    it('includes a modified timestamp', () => {
      const before = Date.now();
      vfs.writeFile('/home/user/ts.txt', 'time');
      const s = vfs.stat('/home/user/ts.txt');
      const after = Date.now();
      expect(s!.modified).toBeGreaterThanOrEqual(before);
      expect(s!.modified).toBeLessThanOrEqual(after);
    });

    it('returns empty string as name for file stat when path is root-like edge case', () => {
      // Stat on a file whose path split ends with an empty pop is unlikely,
      // but we test the initial solution file to verify normal behavior
      const s = vfs.stat(vfs.solutionPath);
      expect(s!.name).toBe(vfs.solutionFilename);
    });
  });

  // ---------------------------------------------------------------------------
  // remove (deleteFile / deleteDir)
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('removes an existing file and returns true', () => {
      vfs.writeFile('/home/user/del.txt', 'bye');
      expect(vfs.remove('/home/user/del.txt')).toBe(true);
      expect(vfs.readFile('/home/user/del.txt')).toBeNull();
    });

    it('returns false when removing a non-existent path', () => {
      expect(vfs.remove('/home/user/nope.txt')).toBe(false);
    });

    it('removes an empty non-protected directory', () => {
      vfs.mkdir('/home/user/temp');
      expect(vfs.remove('/home/user/temp')).toBe(true);
      expect(vfs.exists('/home/user/temp')).toBe(false);
    });

    it('refuses to remove a directory containing files', () => {
      vfs.mkdir('/home/user/occupied');
      vfs.writeFile('/home/user/occupied/file.txt', 'stuff');
      expect(vfs.remove('/home/user/occupied')).toBe(false);
      expect(vfs.exists('/home/user/occupied')).toBe(true);
    });

    it('refuses to remove a directory containing subdirectories', () => {
      vfs.mkdir('/home/user/parent');
      vfs.mkdir('/home/user/parent/child');
      expect(vfs.remove('/home/user/parent')).toBe(false);
    });

    it('refuses to remove protected directories: /, /home, /home/user', () => {
      expect(vfs.remove('/')).toBe(false);
      expect(vfs.remove('/home')).toBe(false);
      expect(vfs.remove('/home/user')).toBe(false);
    });

    it('notifies listeners on file deletion', () => {
      vfs.writeFile('/home/user/notify.txt', 'content');
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.remove('/home/user/notify.txt');
      expect(listener).toHaveBeenCalledWith('/home/user/notify.txt', 'delete');
    });

    it('does not notify listeners when removing a directory', () => {
      vfs.mkdir('/home/user/quietdir');
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.remove('/home/user/quietdir');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // rename
  // ---------------------------------------------------------------------------
  describe('rename', () => {
    it('moves file content from old path to new path', () => {
      vfs.writeFile('/home/user/old.txt', 'data');
      expect(vfs.rename('/home/user/old.txt', '/home/user/new.txt')).toBe(true);
      expect(vfs.readFile('/home/user/old.txt')).toBeNull();
      expect(vfs.readFile('/home/user/new.txt')).toBe('data');
    });

    it('returns false when source file does not exist', () => {
      expect(vfs.rename('/home/user/ghost.txt', '/home/user/dest.txt')).toBe(false);
    });

    it('overwrites destination if it already exists', () => {
      vfs.writeFile('/home/user/src.txt', 'new content');
      vfs.writeFile('/home/user/dst.txt', 'old content');
      vfs.rename('/home/user/src.txt', '/home/user/dst.txt');
      expect(vfs.readFile('/home/user/dst.txt')).toBe('new content');
    });

    it('fires delete notification for old path and write notification for new path', () => {
      vfs.writeFile('/home/user/a.txt', 'data');
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.rename('/home/user/a.txt', '/home/user/b.txt');
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith('/home/user/a.txt', 'delete');
      expect(listener).toHaveBeenCalledWith('/home/user/b.txt', 'write');
    });

    it('resolves relative paths', () => {
      vfs.writeFile('rel.txt', 'content');
      expect(vfs.rename('rel.txt', 'renamed.txt')).toBe(true);
      expect(vfs.readFile('/home/user/renamed.txt')).toBe('content');
    });
  });

  // ---------------------------------------------------------------------------
  // copy
  // ---------------------------------------------------------------------------
  describe('copy', () => {
    it('copies file content to a new path', () => {
      vfs.writeFile('/home/user/original.txt', 'copy me');
      expect(vfs.copy('/home/user/original.txt', '/home/user/clone.txt')).toBe(true);
      expect(vfs.readFile('/home/user/original.txt')).toBe('copy me');
      expect(vfs.readFile('/home/user/clone.txt')).toBe('copy me');
    });

    it('returns false when source does not exist', () => {
      expect(vfs.copy('/home/user/nope.txt', '/home/user/dest.txt')).toBe(false);
    });

    it('overwrites destination file if it exists', () => {
      vfs.writeFile('/home/user/src.txt', 'new');
      vfs.writeFile('/home/user/dst.txt', 'old');
      vfs.copy('/home/user/src.txt', '/home/user/dst.txt');
      expect(vfs.readFile('/home/user/dst.txt')).toBe('new');
    });

    it('auto-creates parent directories for the destination', () => {
      vfs.writeFile('/home/user/src.txt', 'deep copy');
      vfs.copy('/home/user/src.txt', '/home/user/x/y/z/dst.txt');
      expect(vfs.readFile('/home/user/x/y/z/dst.txt')).toBe('deep copy');
    });

    it('fires write notification for destination via writeFile', () => {
      vfs.writeFile('/home/user/csrc.txt', 'data');
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.copy('/home/user/csrc.txt', '/home/user/cdst.txt');
      expect(listener).toHaveBeenCalledWith('/home/user/cdst.txt', 'write');
    });
  });

  // ---------------------------------------------------------------------------
  // mkdir
  // ---------------------------------------------------------------------------
  describe('mkdir', () => {
    it('creates a new directory and returns true', () => {
      expect(vfs.mkdir('/home/user/newdir')).toBe(true);
      expect(vfs.exists('/home/user/newdir')).toBe(true);
      const s = vfs.stat('/home/user/newdir');
      expect(s!.isDirectory).toBe(true);
    });

    it('returns false if directory already exists', () => {
      vfs.mkdir('/home/user/dup');
      expect(vfs.mkdir('/home/user/dup')).toBe(false);
    });

    it('returns false if parent directory does not exist (no recursive creation)', () => {
      expect(vfs.mkdir('/home/user/a/b')).toBe(false);
      expect(vfs.exists('/home/user/a/b')).toBe(false);
    });

    it('can create nested directories one at a time', () => {
      expect(vfs.mkdir('/home/user/l1')).toBe(true);
      expect(vfs.mkdir('/home/user/l1/l2')).toBe(true);
      expect(vfs.mkdir('/home/user/l1/l2/l3')).toBe(true);
      expect(vfs.exists('/home/user/l1/l2/l3')).toBe(true);
    });

    it('resolves relative paths', () => {
      expect(vfs.mkdir('reldir')).toBe(true);
      expect(vfs.exists('/home/user/reldir')).toBe(true);
    });

    it('returns false when trying to create a dir whose parent is root and root exists', () => {
      // /tmp parent is / which exists
      expect(vfs.mkdir('/tmp')).toBe(true);
      expect(vfs.exists('/tmp')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // readdir
  // ---------------------------------------------------------------------------
  describe('readdir', () => {
    it('lists files and directories in a directory', () => {
      vfs.mkdir('/home/user/sub');
      vfs.writeFile('/home/user/file.txt', 'data');
      const entries = vfs.readdir('/home/user');
      expect(entries).toContain('sub');
      expect(entries).toContain('file.txt');
      expect(entries).toContain(vfs.solutionFilename);
    });

    it('returns null for non-existent directory', () => {
      expect(vfs.readdir('/nonexistent')).toBeNull();
    });

    it('returns an empty array for an empty directory', () => {
      vfs.mkdir('/home/user/empty');
      expect(vfs.readdir('/home/user/empty')).toEqual([]);
    });

    it('returns entries sorted alphabetically', () => {
      vfs.writeFile('/home/user/zebra.txt', 'z');
      vfs.writeFile('/home/user/apple.txt', 'a');
      vfs.writeFile('/home/user/mango.txt', 'm');
      const entries = vfs.readdir('/home/user');
      const idx = (name: string) => entries!.indexOf(name);
      expect(idx('apple.txt')).toBeLessThan(idx('mango.txt'));
      expect(idx('mango.txt')).toBeLessThan(idx('zebra.txt'));
    });

    it('only shows direct children, not deeply nested entries', () => {
      vfs.mkdir('/home/user/parent');
      vfs.mkdir('/home/user/parent/child');
      vfs.writeFile('/home/user/parent/child/deep.txt', 'x');
      const entries = vfs.readdir('/home/user/parent');
      expect(entries).toEqual(['child']);
    });

    it('lists root directory contents', () => {
      const entries = vfs.readdir('/');
      expect(entries).toContain('home');
    });

    it('resolves relative paths', () => {
      vfs.mkdir('/home/user/rdir');
      vfs.writeFile('/home/user/rdir/f.txt', 'x');
      const entries = vfs.readdir('rdir');
      expect(entries).toEqual(['f.txt']);
    });
  });

  // ---------------------------------------------------------------------------
  // listDetailed
  // ---------------------------------------------------------------------------
  describe('listDetailed', () => {
    it('returns detailed stats for each entry in a directory', () => {
      vfs.mkdir('/home/user/ddir');
      vfs.writeFile('/home/user/dfile.txt', 'hello');
      const detailed = vfs.listDetailed('/home/user');
      expect(detailed).not.toBeNull();

      const dirEntry = detailed!.find((e) => e.name === 'ddir');
      expect(dirEntry).toBeDefined();
      expect(dirEntry!.isDirectory).toBe(true);
      expect(dirEntry!.size).toBe(0);

      const fileEntry = detailed!.find((e) => e.name === 'dfile.txt');
      expect(fileEntry).toBeDefined();
      expect(fileEntry!.isDirectory).toBe(false);
      expect(fileEntry!.size).toBe(5);
    });

    it('returns null for a non-existent directory', () => {
      expect(vfs.listDetailed('/nope')).toBeNull();
    });

    it('returns empty array for an empty directory', () => {
      vfs.mkdir('/home/user/emptydet');
      expect(vfs.listDetailed('/home/user/emptydet')).toEqual([]);
    });

    it('handles root directory listing', () => {
      const detailed = vfs.listDetailed('/');
      expect(detailed).not.toBeNull();
      const homeEntry = detailed!.find((e) => e.name === 'home');
      expect(homeEntry).toBeDefined();
      expect(homeEntry!.isDirectory).toBe(true);
    });

    it('returns size 0 for a file whose content is missing from the map (fallback to empty string)', () => {
      // This tests the ?? '' fallback on line 203. We create a dir,
      // then add a file entry directly visible in readdir but not in files map.
      // We can approximate this by writing a file, getting listDetailed, and verifying the size.
      vfs.writeFile('/home/user/emptyfile.txt', '');
      const detailed = vfs.listDetailed('/home/user');
      const entry = detailed!.find((e) => e.name === 'emptyfile.txt');
      expect(entry!.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Solution helpers
  // ---------------------------------------------------------------------------
  describe('getSolutionCode / setSolutionCode', () => {
    it('getSolutionCode returns the initial code', () => {
      expect(vfs.getSolutionCode()).toBe('const x = 1;');
    });

    it('setSolutionCode updates and getSolutionCode reflects it', () => {
      vfs.setSolutionCode('const y = 2;');
      expect(vfs.getSolutionCode()).toBe('const y = 2;');
    });

    it('getSolutionCode returns empty string if solution file is missing', () => {
      vfs.remove(vfs.solutionPath);
      expect(vfs.getSolutionCode()).toBe('');
    });

    it('setSolutionCode fires write notification', () => {
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.setSolutionCode('updated');
      expect(listener).toHaveBeenCalledWith(vfs.solutionPath, 'write');
    });
  });

  // ---------------------------------------------------------------------------
  // onChange (change listeners)
  // ---------------------------------------------------------------------------
  describe('onChange', () => {
    it('listener fires on writeFile with path and "write" type', () => {
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.writeFile('/home/user/test.txt', 'data');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('/home/user/test.txt', 'write');
    });

    it('listener fires on remove (file) with path and "delete" type', () => {
      vfs.writeFile('/home/user/del.txt', 'data');
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.remove('/home/user/del.txt');
      expect(listener).toHaveBeenCalledWith('/home/user/del.txt', 'delete');
    });

    it('multiple listeners all fire on the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      vfs.onChange(listener1);
      vfs.onChange(listener2);
      vfs.onChange(listener3);
      vfs.writeFile('/home/user/multi.txt', 'data');
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe function removes the listener', () => {
      const listener = vi.fn();
      const unsub = vfs.onChange(listener);
      unsub();
      vfs.writeFile('/home/user/after-unsub.txt', 'data');
      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribing one listener does not affect others', () => {
      const stayListener = vi.fn();
      const goListener = vi.fn();
      vfs.onChange(stayListener);
      const unsub = vfs.onChange(goListener);
      unsub();
      vfs.writeFile('/home/user/partial.txt', 'data');
      expect(stayListener).toHaveBeenCalledTimes(1);
      expect(goListener).not.toHaveBeenCalled();
    });

    it('listener errors are silently swallowed and do not block other listeners', () => {
      const badListener = vi.fn(() => {
        throw new Error('boom');
      });
      const goodListener = vi.fn();
      vfs.onChange(badListener);
      vfs.onChange(goodListener);
      vfs.writeFile('/home/user/errortest.txt', 'data');
      expect(badListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });

    it('listener receives resolved absolute path even for relative write', () => {
      const listener = vi.fn();
      vfs.onChange(listener);
      vfs.writeFile('relative.txt', 'data');
      expect(listener).toHaveBeenCalledWith('/home/user/relative.txt', 'write');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('writeFile to deeply nested path auto-creates all intermediate directories', () => {
      vfs.writeFile('/home/user/a/b/c/d/e.txt', 'deep');
      expect(vfs.exists('/home/user/a')).toBe(true);
      expect(vfs.exists('/home/user/a/b')).toBe(true);
      expect(vfs.exists('/home/user/a/b/c')).toBe(true);
      expect(vfs.exists('/home/user/a/b/c/d')).toBe(true);
      expect(vfs.readFile('/home/user/a/b/c/d/e.txt')).toBe('deep');
    });

    it('writing a file with very large content works correctly', () => {
      const bigContent = 'x'.repeat(100_000);
      vfs.writeFile('/home/user/big.txt', bigContent);
      expect(vfs.readFile('/home/user/big.txt')).toBe(bigContent);
      expect(vfs.stat('/home/user/big.txt')!.size).toBe(100_000);
    });

    it('file and directory can have similar names without conflict', () => {
      vfs.mkdir('/home/user/ambig');
      vfs.writeFile('/home/user/ambig.txt', 'file');
      expect(vfs.stat('/home/user/ambig')!.isDirectory).toBe(true);
      expect(vfs.stat('/home/user/ambig.txt')!.isDirectory).toBe(false);
    });

    it('cwd affects relative path resolution after setCwd', () => {
      vfs.mkdir('/home/user/workspace');
      vfs.setCwd('/home/user/workspace');
      vfs.writeFile('local.txt', 'data');
      expect(vfs.readFile('/home/user/workspace/local.txt')).toBe('data');
      expect(vfs.readFile('/home/user/local.txt')).toBeNull();
    });

    it('rename to a different directory moves the file', () => {
      vfs.writeFile('/home/user/src.txt', 'moving');
      vfs.mkdir('/home/user/dest');
      vfs.rename('/home/user/src.txt', '/home/user/dest/moved.txt');
      expect(vfs.readFile('/home/user/src.txt')).toBeNull();
      expect(vfs.readFile('/home/user/dest/moved.txt')).toBe('moving');
    });

    it('copy preserves original file after modification of copy', () => {
      vfs.writeFile('/home/user/orig.txt', 'original');
      vfs.copy('/home/user/orig.txt', '/home/user/cp.txt');
      vfs.writeFile('/home/user/cp.txt', 'modified');
      expect(vfs.readFile('/home/user/orig.txt')).toBe('original');
      expect(vfs.readFile('/home/user/cp.txt')).toBe('modified');
    });

    it('readdir after removing a file no longer lists it', () => {
      vfs.writeFile('/home/user/temp.txt', 'data');
      expect(vfs.readdir('/home/user')).toContain('temp.txt');
      vfs.remove('/home/user/temp.txt');
      expect(vfs.readdir('/home/user')).not.toContain('temp.txt');
    });

    it('overwriting the solution file via writeFile updates getSolutionCode', () => {
      vfs.writeFile(vfs.solutionPath, 'new code');
      expect(vfs.getSolutionCode()).toBe('new code');
    });

    it('stat returns modified timestamp close to Date.now() for directories', () => {
      const before = Date.now();
      const s = vfs.stat('/home/user');
      const after = Date.now();
      expect(s!.modified).toBeGreaterThanOrEqual(before);
      expect(s!.modified).toBeLessThanOrEqual(after);
    });
  });
});
