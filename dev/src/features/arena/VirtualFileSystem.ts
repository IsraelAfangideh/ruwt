/**
 * In-memory virtual filesystem synced with Monaco editor.
 * Supports a primary solution file and basic file operations.
 */

type ChangeListener = (path: string, type: 'write' | 'delete') => void;

interface FileStat {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

const LANG_EXTENSIONS: Record<string, string> = {
  javascript: 'solution.js',
  typescript: 'solution.ts',
  python: 'solution.py',
  java: 'Solution.java',
  c: 'solution.c',
  cpp: 'solution.cpp',
  go: 'solution.go',
  rust: 'solution.rs',
};

export class VirtualFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();
  private listeners: ChangeListener[] = [];
  private cwd = '/home/user';
  readonly solutionFilename: string;
  readonly solutionPath: string;

  constructor(language: string, initialCode: string) {
    this.solutionFilename = LANG_EXTENSIONS[language] || 'solution.js';
    this.solutionPath = `/home/user/${this.solutionFilename}`;

    // Bootstrap directories
    this.dirs.add('/');
    this.dirs.add('/home');
    this.dirs.add('/home/user');

    // Write initial solution file
    this.files.set(this.solutionPath, initialCode);
  }

  /* ── Path handling ── */

  resolve(relativePath: string): string {
    if (relativePath.startsWith('/')) return this.normalize(relativePath);
    return this.normalize(`${this.cwd}/${relativePath}`);
  }

  private normalize(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { resolved.pop(); continue; }
      resolved.push(part);
    }
    return '/' + resolved.join('/');
  }

  getCwd(): string { return this.cwd; }

  setCwd(path: string): boolean {
    const abs = this.resolve(path);
    if (!this.dirs.has(abs)) return false;
    this.cwd = abs;
    return true;
  }

  getShortCwd(): string {
    if (this.cwd === '/home/user') return '~';
    if (this.cwd.startsWith('/home/user/')) return '~/' + this.cwd.slice('/home/user/'.length);
    return this.cwd;
  }

  /* ── File operations ── */

  readFile(path: string): string | null {
    const abs = this.resolve(path);
    return this.files.get(abs) ?? null;
  }

  writeFile(path: string, content: string): void {
    const abs = this.resolve(path);
    // Ensure parent dirs exist
    const parts = abs.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      this.dirs.add('/' + parts.slice(0, i).join('/'));
    }
    this.files.set(abs, content);
    this.notify(abs, 'write');
  }

  exists(path: string): boolean {
    const abs = this.resolve(path);
    return this.files.has(abs) || this.dirs.has(abs);
  }

  stat(path: string): FileStat | null {
    const abs = this.resolve(path);
    if (this.dirs.has(abs)) {
      return { name: abs.split('/').pop() || '/', isDirectory: true, size: 0, modified: Date.now() };
    }
    const content = this.files.get(abs);
    if (content != null) {
      /* istanbul ignore next -- @preserve */
      return { name: abs.split('/').pop() || '', isDirectory: false, size: content.length, modified: Date.now() };
    }
    return null;
  }

  remove(path: string): boolean {
    const abs = this.resolve(path);
    if (this.files.has(abs)) {
      this.files.delete(abs);
      this.notify(abs, 'delete');
      return true;
    }
    // Remove empty directory
    if (this.dirs.has(abs) && abs !== '/' && abs !== '/home' && abs !== '/home/user') {
      // Check if dir has children
      const prefix = abs + '/';
      for (const f of this.files.keys()) {
        if (f.startsWith(prefix)) return false;
      }
      for (const d of this.dirs) {
        if (d !== abs && d.startsWith(prefix)) return false;
      }
      this.dirs.delete(abs);
      return true;
    }
    return false;
  }

  rename(oldPath: string, newPath: string): boolean {
    const absOld = this.resolve(oldPath);
    const absNew = this.resolve(newPath);
    const content = this.files.get(absOld);
    if (content == null) return false;
    this.files.delete(absOld);
    this.files.set(absNew, content);
    this.notify(absOld, 'delete');
    this.notify(absNew, 'write');
    return true;
  }

  copy(srcPath: string, destPath: string): boolean {
    const content = this.readFile(srcPath);
    if (content == null) return false;
    this.writeFile(destPath, content);
    return true;
  }

  /* ── Directory operations ── */

  mkdir(path: string): boolean {
    const abs = this.resolve(path);
    if (this.dirs.has(abs)) return false;
    // Ensure parent exists
    const parent = abs.split('/').slice(0, -1).join('/') || '/';
    if (!this.dirs.has(parent)) return false;
    this.dirs.add(abs);
    return true;
  }

  readdir(path: string): string[] | null {
    const abs = this.resolve(path);
    if (!this.dirs.has(abs)) return null;
    const prefix = abs === '/' ? '/' : abs + '/';
    const entries = new Set<string>();
    // Subdirectories
    for (const d of this.dirs) {
      if (d === abs) continue;
      if (d.startsWith(prefix)) {
        const rest = d.slice(prefix.length);
        const name = rest.split('/')[0];
        /* istanbul ignore next -- @preserve */
        if (name) entries.add(name);
      }
    }
    // Files
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        if (!rest.includes('/')) entries.add(rest);
      }
    }
    return Array.from(entries).sort();
  }

  listDetailed(path: string): FileStat[] | null {
    const names = this.readdir(path);
    if (!names) return null;
    const abs = this.resolve(path);
    const prefix = abs === '/' ? '/' : abs + '/';
    return names.map((name) => {
      const fullPath = prefix + name;
      if (this.dirs.has(fullPath)) {
        return { name, isDirectory: true, size: 0, modified: Date.now() };
      }
      /* istanbul ignore next -- @preserve */
      const content = this.files.get(fullPath) ?? '';
      return { name, isDirectory: false, size: content.length, modified: Date.now() };
    });
  }

  /* ── Solution helpers ── */

  getSolutionCode(): string {
    return this.files.get(this.solutionPath) ?? '';
  }

  setSolutionCode(code: string): void {
    this.writeFile(this.solutionPath, code);
  }

  /* ── Events ── */

  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(path: string, type: 'write' | 'delete') {
    for (const l of this.listeners) {
      try { l(path, type); } catch { /* ignore listener errors */ }
    }
  }
}
