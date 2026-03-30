/**
 * Node.js API polyfills backed by VirtualFileSystem.
 *
 * Provides fs, path, events, buffer, process, os, util, assert, url, crypto
 * that work against the in-memory VFS. Used by the QuickJS engine to give
 * user code a Node.js-like environment.
 */
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { HOME_DIR } from './constants';
import pathBrowserify from 'path-browserify';
import EventEmitter from 'events';
import { Buffer } from 'buffer';
import utilModule from 'util';
import assertModule from 'assert';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodePolyfills {
  fs: FsPolyfill;
  path: typeof pathBrowserify;
  process: ProcessPolyfill;
  events: { EventEmitter: typeof EventEmitter };
  buffer: { Buffer: typeof Buffer };
  os: OsPolyfill;
  util: typeof utilModule;
  assert: typeof assertModule;
  url: UrlPolyfill;
  crypto: CryptoPolyfill;
}

interface FsPolyfill {
  readFileSync: (path: string, encoding?: string) => string;
  writeFileSync: (path: string, data: string) => void;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => StatResult;
  unlinkSync: (path: string) => void;
  promises: {
    readFile: (path: string, encoding?: string) => Promise<string>;
    writeFile: (path: string, data: string) => Promise<void>;
  };
}

interface StatResult {
  isFile: () => boolean;
  isDirectory: () => boolean;
  size: number;
}

interface ProcessPolyfill {
  cwd: () => string;
  env: Record<string, string>;
  platform: string;
  version: string;
  argv: string[];
  exit: (code?: number) => void;
  stdout: { write: (data: string) => boolean };
  stderr: { write: (data: string) => boolean };
}

interface OsPolyfill {
  platform: () => string;
  homedir: () => string;
  tmpdir: () => string;
  EOL: string;
}

interface UrlPolyfill {
  URL: typeof URL;
  URLSearchParams: typeof URLSearchParams;
}

interface CryptoPolyfill {
  randomBytes: (size: number) => Buffer;
  createHash: (algorithm: string) => HashInstance;
}

interface HashInstance {
  update: (data: string) => HashInstance;
  digest: (encoding?: string) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEnoent(path: string): Error {
  const err = new Error(`ENOENT: no such file or directory, '${path}'`);
  (err as any).code = 'ENOENT';
  return err;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPolyfills(vfs: VirtualFileSystem): NodePolyfills {
  // ── fs ────────────────────────────────────────────────────────────────

  const fs: FsPolyfill = {
    readFileSync(filePath: string, _encoding?: string): string {
      const content = vfs.readFile(filePath);
      if (content === null) throw createEnoent(filePath);
      return content;
    },

    writeFileSync(filePath: string, data: string): void {
      vfs.writeFile(filePath, data);
    },

    existsSync(filePath: string): boolean {
      return vfs.exists(filePath);
    },

    mkdirSync(dirPath: string, options?: { recursive?: boolean }): void {
      if (options?.recursive) {
        // Build up path segments and create each
        const parts = dirPath.split('/').filter(Boolean);
        let current = '';
        for (const part of parts) {
          current += '/' + part;
          if (!vfs.exists(current)) {
            vfs.mkdir(current);
          }
        }
      } else {
        vfs.mkdir(dirPath);
      }
    },

    readdirSync(dirPath: string): string[] {
      const entries = vfs.readdir(dirPath);
      if (entries === null) throw createEnoent(dirPath);
      return entries;
    },

    statSync(filePath: string): StatResult {
      const stat = vfs.stat(filePath);
      if (stat === null) throw createEnoent(filePath);
      return {
        isFile: () => !stat.isDirectory,
        isDirectory: () => stat.isDirectory,
        size: stat.size,
      };
    },

    unlinkSync(filePath: string): void {
      const removed = vfs.remove(filePath);
      if (!removed) throw createEnoent(filePath);
    },

    promises: {
      async readFile(filePath: string, _encoding?: string): Promise<string> {
        const content = vfs.readFile(filePath);
        if (content === null) throw createEnoent(filePath);
        return content;
      },
      async writeFile(filePath: string, data: string): Promise<void> {
        vfs.writeFile(filePath, data);
      },
    },
  };

  // ── process ───────────────────────────────────────────────────────────

  const processPolyfill: ProcessPolyfill = {
    cwd: () => vfs.getCwd(),
    env: {},
    platform: 'linux',
    version: 'v18.0.0',
    argv: ['node'],
    exit: () => {},
    stdout: { write: () => true },
    stderr: { write: () => true },
  };

  // ── os ────────────────────────────────────────────────────────────────

  const os: OsPolyfill = {
    platform: () => 'linux',
    homedir: () => HOME_DIR,
    tmpdir: () => '/tmp',
    EOL: '\n',
  };

  // ── crypto ────────────────────────────────────────────────────────────

  const crypto: CryptoPolyfill = {
    randomBytes(size: number): Buffer {
      const arr = new Uint8Array(size);
      globalThis.crypto.getRandomValues(arr);
      return Buffer.from(arr);
    },
    createHash(algorithm: string): HashInstance {
      const supported = ['sha256', 'sha-256', 'sha1', 'sha-1', 'md5'];
      if (!supported.includes(algorithm.toLowerCase())) {
        throw new Error(`Hash algorithm "${algorithm}" is not supported in this environment`);
      }
      let buffer = '';
      return {
        update(input: string) {
          buffer += input;
          return this;
        },
        digest(encoding?: string): string {
          // Pure-JS SHA-256 (synchronous, no Web Crypto needed)
          const hash = sha256(buffer);
          if (encoding === 'base64') return btoa(String.fromCharCode(...hash));
          return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
        },
      };
    },
  };

  // ── url ───────────────────────────────────────────────────────────────

  const url: UrlPolyfill = {
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
  };

  return {
    fs,
    path: pathBrowserify,
    process: processPolyfill,
    events: { EventEmitter },
    buffer: { Buffer },
    os,
    util: utilModule,
    assert: assertModule,
    url,
    crypto,
  };
}

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 (synchronous, no Web Crypto dependency)
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256(message: string): Uint8Array {
  const msgBytes = new TextEncoder().encode(message);
  const bitLen = msgBytes.length * 8;

  // Padding: append 1 bit, then zeros, then 64-bit big-endian length
  const padLen = (64 - ((msgBytes.length + 9) % 64)) % 64;
  const padded = new Uint8Array(msgBytes.length + 1 + padLen + 8);
  padded.set(msgBytes);
  padded[msgBytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7)) ^ (rotr(w[i - 15], 18)) ^ (w[i - 15] >>> 3);
      const s1 = (rotr(w[i - 2], 17)) ^ (rotr(w[i - 2], 19)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6)) ^ (rotr(e, 11)) ^ (rotr(e, 25));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = (rotr(a, 2)) ^ (rotr(a, 13)) ^ (rotr(a, 22));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
  return result;
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}
