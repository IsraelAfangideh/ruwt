/**
 * useRuntime: manages Ruwt Runtime lifecycle for the standalone IDE.
 * Drop-in replacement for useWebContainer — same API, different engine.
 * Uses RuwtBackend (VirtualFS + QuickJS + esbuild-wasm) instead of WebContainer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { RuwtBackend } from '@/lib/sandbox/ruwt-backend';
import { HOME_DIR } from '@/lib/runtime/constants';
import type { FileEntry } from './FileTree';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTO_SAVE_INTERVAL = 30_000;

export function useRuntime(projectId?: string) {
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const cancelledRef = useRef(false);
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentProjectIdRef = useRef<string | undefined>(projectId);
  const backendRef = useRef<RuwtBackend | null>(null);

  currentProjectIdRef.current = projectId;

  // Lazily create backend (stable across renders)
  if (!backendRef.current) {
    backendRef.current = new RuwtBackend();
  }
  const backend = backendRef.current;

  useEffect(() => {
    cancelledRef.current = false;

    async function init() {
      try {
        await backend.initialize();

        const vfs = backend.getVfs();

        // If we have a projectId, try to load files from the API
        if (projectId) {
          const loaded = await loadProjectFiles(projectId, vfs);
          if (loaded && !cancelledRef.current) {
            const tree = buildFileTree(vfs, HOME_DIR);
            setFiles(tree);
            setReady(true);
            return;
          }
        }

        // No projectId or load failed — mount starter files
        vfs.writeFile(`${HOME_DIR}/package.json`, JSON.stringify({
          name: 'ruwt-project',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node index.js', test: 'node test.js' },
        }, null, 2));
        vfs.writeFile(`${HOME_DIR}/index.js`, '// Welcome to Ruwt IDE\n// Start coding or clone a repo\n\nconsole.log(\'Hello, world!\');\n');

        if (!cancelledRef.current) {
          const tree = buildFileTree(vfs, HOME_DIR);
          setFiles(tree);
          setReady(true);
        }
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to initialize runtime');
        }
      }
    }

    init();

    return () => {
      cancelledRef.current = true;
    };
  }, [projectId, backend]);

  // Auto-save timer
  useEffect(() => {
    if (!ready) return;

    autoSaveTimerRef.current = setInterval(() => {
      if (dirtyRef.current && currentProjectIdRef.current) {
        saveProject(currentProjectIdRef.current);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFiles = useCallback(async () => {
    try {
      const tree = buildFileTree(backend.getVfs(), HOME_DIR);
      setFiles(tree);
    } catch {
      // VFS not ready yet
    }
  }, [backend]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus((prev) => prev === 'saved' ? 'idle' : prev);
  }, []);

  const collectFiles = useCallback((dirPath: string = HOME_DIR): Record<string, string> => {
    const result: Record<string, string> = {};
    const vfs = backend.getVfs();
    collectFilesFromVfs(vfs, dirPath, HOME_DIR, result);
    return result;
  }, [backend]);

  const saveProject = useCallback(async (pid: string) => {
    try {
      setSaveStatus('saving');
      const fileMap = collectFiles();

      const res = await fetch(`/api/projects/${pid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileMap }),
      });

      if (!res.ok) {
        setSaveStatus('error');
        return false;
      }

      dirtyRef.current = false;
      setSaveStatus('saved');
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  }, [collectFiles]);

  return { ready, files, error, refreshFiles, saveStatus, markDirty, saveProject, collectFiles, backend };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface VFS {
  readdir: (path: string) => string[] | null;
  stat: (path: string) => { isDirectory: boolean; size: number; name: string } | null;
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string) => void;
}

async function loadProjectFiles(projectId: string, vfs: VFS): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/files`);
    if (!res.ok) return false;
    const data = await res.json() as { files: Record<string, string> };
    if (!data.files || Object.keys(data.files).length === 0) return false;

    for (const [path, content] of Object.entries(data.files)) {
      vfs.writeFile(`${HOME_DIR}/${path}`, content);
    }
    return true;
  } catch {
    return false;
  }
}

function buildFileTree(vfs: VFS, dirPath: string, relativeBase: string = HOME_DIR): FileEntry[] {
  const entries = vfs.readdir(dirPath);
  if (!entries) return [];

  const result: FileEntry[] = [];

  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;

    const fullPath = dirPath + '/' + name;
    const relativePath = fullPath.startsWith(relativeBase + '/')
      ? fullPath.substring(relativeBase.length + 1)
      : fullPath;

    const stat = vfs.stat(fullPath);
    if (!stat) continue;

    if (stat.isDirectory) {
      const children = buildFileTree(vfs, fullPath, relativeBase);
      result.push({ name, path: relativePath, type: 'directory', children });
    } else {
      result.push({ name, path: relativePath, type: 'file' });
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

function collectFilesFromVfs(
  vfs: VFS,
  dirPath: string,
  basePath: string,
  result: Record<string, string>,
): void {
  const entries = vfs.readdir(dirPath);
  if (!entries) return;

  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const fullPath = dirPath + '/' + name;
    const relativePath = fullPath.startsWith(basePath + '/')
      ? fullPath.substring(basePath.length + 1)
      : fullPath;

    const stat = vfs.stat(fullPath);
    if (!stat) continue;

    if (stat.isDirectory) {
      collectFilesFromVfs(vfs, fullPath, basePath, result);
    } else {
      const content = vfs.readFile(fullPath);
      if (content !== null) {
        result[relativePath] = content;
      }
    }
  }
}
