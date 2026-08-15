/** Narrow filesystem used by the collector, journal, and desktop UI. */

export interface DirEntry {
  name: string;
  path: string;
  dir: boolean;
}

export interface FsLike {
  home(): Promise<string>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<DirEntry[]>;
}

export function pathSep(home: string): '\\' | '/' {
  return home.includes('\\') ? '\\' : '/';
}

export function joinPath(home: string, ...parts: string[]): string {
  const sep = pathSep(home);
  return [home.replace(/[\\/]+$/, ''), ...parts].join(sep);
}

export function readRoots(home: string): string[] {
  return [
    joinPath(home, '.ruwt'),
    joinPath(home, '.claude'),
    joinPath(home, '.cursor'),
    joinPath(home, '.codex'),
    joinPath(home, 'Library', 'Application Support', 'Cursor'),
    joinPath(home, 'AppData', 'Roaming', 'Cursor'),
    joinPath(home, '.config', 'Cursor'),
  ];
}

export function writeRoot(home: string): string {
  return joinPath(home, '.ruwt');
}

export function isApprovedPath(home: string, target: string, write = false): boolean {
  if (!target || target.split(/[\\/]/).includes('..')) return false;
  const sep = pathSep(home);
  const normalize = (value: string) => value.replace(/[\\/]+/g, sep);
  const resolved = normalize(target);
  const ruwt = normalize(writeRoot(home));
  if (write) return resolved === ruwt || resolved.startsWith(ruwt + sep);
  return readRoots(home).some((root) => {
    const prefix = normalize(root);
    return resolved === prefix || resolved.startsWith(prefix + sep);
  });
}
