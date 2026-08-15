import { homedir } from 'node:os';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DirEntry, FsLike } from './fs.js';

export class NodeFs implements FsLike {
  async home() { return homedir(); }
  async readFile(path: string) { return readFile(path, 'utf8'); }
  async writeFile(path: string, contents: string) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, contents, { mode: 0o600 });
  }
  async mkdirp(path: string) { await mkdir(path, { recursive: true, mode: 0o700 }); }
  async exists(path: string) {
    try { await access(path); return true; }
    catch { return false; }
  }
  async listDir(path: string): Promise<DirEntry[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry) => ({ name: entry.name, path: join(path, entry.name), dir: entry.isDirectory() }));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
