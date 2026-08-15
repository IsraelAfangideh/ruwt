import type { DirEntry, FsLike } from './fs.js';

export class MemoryFs implements FsLike {
  files = new Map<string, string>();

  constructor(private readonly homeDir: string) {}

  async home() { return this.homeDir; }
  async readFile(path: string) {
    const contents = this.files.get(path);
    if (contents === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return contents;
  }
  async writeFile(path: string, contents: string) {
    this.files.set(path, contents);
  }
  async mkdirp(path: string) {
    if (!this.files.has(path)) this.files.set(path.endsWith('/') ? path : `${path}/.keep`, '');
  }
  async exists(path: string) {
    if (this.files.has(path)) return true;
    const prefix = path.endsWith('/') ? path : `${path}/`;
    for (const key of this.files.keys()) if (key === path || key.startsWith(prefix)) return true;
    return false;
  }
  async listDir(path: string): Promise<DirEntry[]> {
    const prefix = path.endsWith('/') ? path : `${path}/`;
    const names = new Map<string, boolean>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const name = rest.split('/')[0];
      if (!name || name === '.keep') continue;
      names.set(name, rest.includes('/'));
    }
    return [...names.entries()].map(([name, dir]) => ({ name, path: `${prefix}${name}`, dir }));
  }
}
