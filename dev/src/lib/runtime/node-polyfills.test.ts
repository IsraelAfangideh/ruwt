import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { createPolyfills } from './node-polyfills';
import type { NodePolyfills } from './node-polyfills';

describe('NodePolyfills', () => {
  let vfs: VirtualFileSystem;
  let polyfills: NodePolyfills;

  beforeEach(() => {
    vfs = new VirtualFileSystem('javascript', '');
    polyfills = createPolyfills(vfs);
  });

  // ── createPolyfills ─────────────────────────────────────────────────────

  describe('createPolyfills', () => {
    it('returns object with all expected keys', () => {
      expect(polyfills).toHaveProperty('fs');
      expect(polyfills).toHaveProperty('path');
      expect(polyfills).toHaveProperty('process');
      expect(polyfills).toHaveProperty('events');
      expect(polyfills).toHaveProperty('buffer');
      expect(polyfills).toHaveProperty('os');
      expect(polyfills).toHaveProperty('util');
      expect(polyfills).toHaveProperty('assert');
      expect(polyfills).toHaveProperty('url');
      expect(polyfills).toHaveProperty('crypto');
    });
  });

  // ── fs polyfill ─────────────────────────────────────────────────────────

  describe('fs polyfill', () => {
    describe('readFileSync', () => {
      it('reads from VFS and returns string', () => {
        vfs.writeFile('/home/user/test.txt', 'hello');
        expect(polyfills.fs.readFileSync('/home/user/test.txt', 'utf-8')).toBe('hello');
      });

      it('throws ENOENT for missing files', () => {
        expect(() => polyfills.fs.readFileSync('/missing.txt', 'utf-8')).toThrow();
        try {
          polyfills.fs.readFileSync('/missing.txt', 'utf-8');
        } catch (e: any) {
          expect(e.code).toBe('ENOENT');
        }
      });

      it('returns string when encoding is utf-8', () => {
        vfs.writeFile('/home/user/file.txt', 'data');
        const result = polyfills.fs.readFileSync('/home/user/file.txt', 'utf-8');
        expect(typeof result).toBe('string');
      });
    });

    describe('writeFileSync', () => {
      it('writes to VFS', () => {
        polyfills.fs.writeFileSync('/home/user/out.txt', 'written');
        expect(vfs.readFile('/home/user/out.txt')).toBe('written');
      });

      it('creates parent directories', () => {
        polyfills.fs.writeFileSync('/home/user/deep/nested/file.txt', 'data');
        expect(vfs.readFile('/home/user/deep/nested/file.txt')).toBe('data');
      });
    });

    describe('existsSync', () => {
      it('returns true for existing file', () => {
        vfs.writeFile('/home/user/exists.txt', 'yes');
        expect(polyfills.fs.existsSync('/home/user/exists.txt')).toBe(true);
      });

      it('returns false for missing file', () => {
        expect(polyfills.fs.existsSync('/nope.txt')).toBe(false);
      });
    });

    describe('mkdirSync', () => {
      it('creates directory in VFS', () => {
        polyfills.fs.mkdirSync('/home/user/newdir');
        expect(vfs.exists('/home/user/newdir')).toBe(true);
      });

      it('with recursive option creates nested dirs', () => {
        polyfills.fs.mkdirSync('/home/user/a/b/c', { recursive: true });
        expect(vfs.exists('/home/user/a/b/c')).toBe(true);
      });
    });

    describe('readdirSync', () => {
      it('lists directory contents from VFS', () => {
        vfs.writeFile('/home/user/a.txt', 'a');
        vfs.writeFile('/home/user/b.txt', 'b');
        const entries = polyfills.fs.readdirSync('/home/user');
        expect(entries).toContain('a.txt');
        expect(entries).toContain('b.txt');
      });

      it('throws ENOENT for missing directory', () => {
        expect(() => polyfills.fs.readdirSync('/nonexistent')).toThrow();
        try {
          polyfills.fs.readdirSync('/nonexistent');
        } catch (e: any) {
          expect(e.code).toBe('ENOENT');
        }
      });
    });

    describe('statSync', () => {
      it('returns stat for file', () => {
        vfs.writeFile('/home/user/f.txt', 'content');
        const stat = polyfills.fs.statSync('/home/user/f.txt');
        expect(stat.isFile()).toBe(true);
        expect(stat.isDirectory()).toBe(false);
        expect(stat.size).toBe(7);
      });

      it('returns stat for directory', () => {
        vfs.mkdir('/home/user/mydir');
        const stat = polyfills.fs.statSync('/home/user/mydir');
        expect(stat.isFile()).toBe(false);
        expect(stat.isDirectory()).toBe(true);
      });

      it('throws ENOENT for missing path', () => {
        expect(() => polyfills.fs.statSync('/nope')).toThrow();
        try {
          polyfills.fs.statSync('/nope');
        } catch (e: any) {
          expect(e.code).toBe('ENOENT');
        }
      });
    });

    describe('unlinkSync', () => {
      it('removes file from VFS', () => {
        vfs.writeFile('/home/user/del.txt', 'gone');
        polyfills.fs.unlinkSync('/home/user/del.txt');
        expect(vfs.exists('/home/user/del.txt')).toBe(false);
      });

      it('throws ENOENT for missing file', () => {
        expect(() => polyfills.fs.unlinkSync('/nope.txt')).toThrow();
        try {
          polyfills.fs.unlinkSync('/nope.txt');
        } catch (e: any) {
          expect(e.code).toBe('ENOENT');
        }
      });
    });

    describe('promises', () => {
      it('readFile returns file content', async () => {
        vfs.writeFile('/home/user/async.txt', 'async data');
        const result = await polyfills.fs.promises.readFile('/home/user/async.txt', 'utf-8');
        expect(result).toBe('async data');
      });

      it('writeFile writes to VFS', async () => {
        await polyfills.fs.promises.writeFile('/home/user/async-out.txt', 'async written');
        expect(vfs.readFile('/home/user/async-out.txt')).toBe('async written');
      });
    });
  });

  // ── path polyfill ───────────────────────────────────────────────────────

  describe('path polyfill', () => {
    it('join combines path segments', () => {
      expect(polyfills.path.join('/home', 'user', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('dirname returns parent directory', () => {
      expect(polyfills.path.dirname('/home/user/file.txt')).toBe('/home/user');
    });

    it('basename returns filename', () => {
      expect(polyfills.path.basename('/home/user/file.txt')).toBe('file.txt');
    });

    it('extname returns extension', () => {
      expect(polyfills.path.extname('/home/user/file.txt')).toBe('.txt');
    });

    it('sep is /', () => {
      expect(polyfills.path.sep).toBe('/');
    });

    it('parse returns parsed path object', () => {
      const parsed = polyfills.path.parse('/home/user/file.txt');
      expect(parsed.root).toBe('/');
      expect(parsed.base).toBe('file.txt');
      expect(parsed.name).toBe('file');
      expect(parsed.ext).toBe('.txt');
    });
  });

  // ── process polyfill ────────────────────────────────────────────────────

  describe('process polyfill', () => {
    it('cwd returns VFS cwd', () => {
      expect(polyfills.process.cwd()).toBe(vfs.getCwd());
    });

    it('env is an object', () => {
      expect(typeof polyfills.process.env).toBe('object');
    });

    it('platform is "linux"', () => {
      expect(polyfills.process.platform).toBe('linux');
    });

    it('version starts with "v"', () => {
      expect(polyfills.process.version).toMatch(/^v/);
    });

    it('argv is an array', () => {
      expect(Array.isArray(polyfills.process.argv)).toBe(true);
    });

    it('stdout.write is a function', () => {
      expect(typeof polyfills.process.stdout.write).toBe('function');
    });

    it('stderr.write is a function', () => {
      expect(typeof polyfills.process.stderr.write).toBe('function');
    });

    it('exit is a function', () => {
      expect(typeof polyfills.process.exit).toBe('function');
    });
  });

  // ── os polyfill ─────────────────────────────────────────────────────────

  describe('os polyfill', () => {
    it('platform returns "linux"', () => {
      expect(polyfills.os.platform()).toBe('linux');
    });

    it('homedir returns /home/user', () => {
      expect(polyfills.os.homedir()).toBe('/home/user');
    });

    it('tmpdir returns /tmp', () => {
      expect(polyfills.os.tmpdir()).toBe('/tmp');
    });

    it('EOL is \\n', () => {
      expect(polyfills.os.EOL).toBe('\n');
    });
  });

  // ── buffer polyfill ─────────────────────────────────────────────────────

  describe('buffer polyfill', () => {
    it('Buffer.from creates buffer from string', () => {
      const buf = polyfills.buffer.Buffer.from('hello');
      expect(buf).toBeDefined();
      expect(buf.length).toBeGreaterThan(0);
    });

    it('Buffer.alloc creates zero-filled buffer', () => {
      const buf = polyfills.buffer.Buffer.alloc(10);
      expect(buf.length).toBe(10);
    });

    it('buffer.toString returns string', () => {
      const buf = polyfills.buffer.Buffer.from('test');
      expect(buf.toString()).toBe('test');
    });
  });

  // ── events polyfill ─────────────────────────────────────────────────────

  describe('events polyfill', () => {
    it('EventEmitter can add and emit events', () => {
      const emitter = new polyfills.events.EventEmitter();
      let called = false;
      emitter.on('test', () => { called = true; });
      emitter.emit('test');
      expect(called).toBe(true);
    });

    it('EventEmitter.on returns this for chaining', () => {
      const emitter = new polyfills.events.EventEmitter();
      const result = emitter.on('test', () => {});
      expect(result).toBe(emitter);
    });

    it('EventEmitter.removeListener removes handler', () => {
      const emitter = new polyfills.events.EventEmitter();
      let count = 0;
      const handler = () => { count++; };
      emitter.on('test', handler);
      emitter.emit('test');
      emitter.removeListener('test', handler);
      emitter.emit('test');
      expect(count).toBe(1);
    });
  });

  // ── crypto polyfill ─────────────────────────────────────────────────────

  describe('crypto polyfill', () => {
    it('randomBytes returns buffer of requested size', () => {
      const buf = polyfills.crypto.randomBytes(16);
      expect(buf.length).toBe(16);
    });

    it('createHash is a function', () => {
      expect(typeof polyfills.crypto.createHash).toBe('function');
    });

    it('createHash("sha256") produces correct 64-char hex digest', () => {
      const hash = polyfills.crypto.createHash('sha256').update('hello').digest('hex');
      // Known SHA-256 of "hello"
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('createHash produces consistent output for same input', () => {
      const h1 = polyfills.crypto.createHash('sha256').update('test').digest('hex');
      const h2 = polyfills.crypto.createHash('sha256').update('test').digest('hex');
      expect(h1).toBe(h2);
    });

    it('createHash produces different output for different input', () => {
      const h1 = polyfills.crypto.createHash('sha256').update('a').digest('hex');
      const h2 = polyfills.crypto.createHash('sha256').update('b').digest('hex');
      expect(h1).not.toBe(h2);
    });

    it('createHash update is chainable', () => {
      const hash = polyfills.crypto.createHash('sha256');
      const result = hash.update('hello');
      expect(result).toBe(hash);
    });

    it('createHash throws for unsupported algorithm', () => {
      expect(() => polyfills.crypto.createHash('blake2b')).toThrow('not supported');
    });

    it('createHash supports base64 encoding', () => {
      const hash = polyfills.crypto.createHash('sha256').update('hello').digest('base64');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  // ── url polyfill ────────────────────────────────────────────────────────

  describe('url polyfill', () => {
    it('URL constructor parses URLs', () => {
      const u = new polyfills.url.URL('https://example.com/path?q=1');
      expect(u.hostname).toBe('example.com');
      expect(u.pathname).toBe('/path');
    });

    it('URLSearchParams works', () => {
      const params = new polyfills.url.URLSearchParams('a=1&b=2');
      expect(params.get('a')).toBe('1');
      expect(params.get('b')).toBe('2');
    });
  });

  // ── util polyfill ───────────────────────────────────────────────────────

  describe('util polyfill', () => {
    it('promisify is a function', () => {
      expect(typeof polyfills.util.promisify).toBe('function');
    });
  });

  // ── assert polyfill ─────────────────────────────────────────────────────

  describe('assert polyfill', () => {
    it('assert does not throw for truthy value', () => {
      expect(() => polyfills.assert(true)).not.toThrow();
    });

    it('assert throws for falsy value', () => {
      expect(() => polyfills.assert(false)).toThrow();
    });

    it('assert.strictEqual does not throw for equal values', () => {
      expect(() => polyfills.assert.strictEqual(1, 1)).not.toThrow();
    });

    it('assert.strictEqual throws for unequal values', () => {
      expect(() => polyfills.assert.strictEqual(1, 2)).toThrow();
    });
  });
});
