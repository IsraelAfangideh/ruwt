/**
 * useWebContainer: manages WebContainer lifecycle for the standalone IDE.
 * Boots the container on mount, creates starter files, and exposes a file tree.
 * Includes save/load integration for project persistence via R2.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getWebContainer,
  mountFiles,
  createStarterFiles,
  listFiles,
  readFile,
} from '@/lib/sandbox/webcontainer';
import type { FileSystemTree } from '@webcontainer/api';
import type { FileEntry } from './FileTree';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

export function useWebContainer(projectId?: string) {
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const cancelledRef = useRef(false);
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentProjectIdRef = useRef<string | undefined>(projectId);

  // Keep the ref in sync
  currentProjectIdRef.current = projectId;

  useEffect(() => {
    cancelledRef.current = false;

    async function init() {
      try {
        await getWebContainer();

        // If we have a projectId, try to load files from the API
        if (projectId) {
          const loaded = await loadProjectFiles(projectId);
          if (loaded && !cancelledRef.current) {
            const tree = await buildFileTree('.');
            setFiles(tree);
            setReady(true);
            return;
          }
        }

        // No projectId or load failed — mount starter files
        const starterFiles = createStarterFiles();
        await mountFiles(starterFiles);
        const tree = await buildFileTree('.');
        if (!cancelledRef.current) {
          setFiles(tree);
          setReady(true);
        }
      } catch (err: unknown) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to boot WebContainer');
        }
      }
    }

    init();

    return () => {
      cancelledRef.current = true;
    };
  }, [projectId]);

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
      const tree = await buildFileTree('.');
      setFiles(tree);
    } catch {
      // Swallow — tree might not be ready yet
    }
  }, []);

  /** Mark files as changed (for auto-save) */
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus((prev) => prev === 'saved' ? 'idle' : prev);
  }, []);

  /** Collect all files from the WebContainer filesystem into a flat map */
  const collectFiles = useCallback(async (dirPath: string = '.'): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    const entries = await listFiles(dirPath);

    for (const name of entries) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const fullPath = dirPath === '.' ? name : `${dirPath}/${name}`;

      try {
        const children = await listFiles(fullPath);
        if (Array.isArray(children)) {
          // It's a directory — recurse
          const nested = await collectFiles(fullPath);
          Object.assign(result, nested);
        } else {
          const content = await readFile(fullPath);
          result[fullPath] = content;
        }
      } catch {
        // It's a file
        try {
          const content = await readFile(fullPath);
          result[fullPath] = content;
        } catch {
          // Skip files that can't be read
        }
      }
    }

    return result;
  }, []);

  /** Save all project files to the API */
  const saveProject = useCallback(async (pid: string) => {
    try {
      setSaveStatus('saving');
      const fileMap = await collectFiles();

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

  return { ready, files, error, refreshFiles, saveStatus, markDirty, saveProject, collectFiles };
}

/**
 * Load project files from the API into the WebContainer.
 * Returns true if files were loaded successfully.
 */
async function loadProjectFiles(projectId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${projectId}/files`);
    if (!res.ok) return false;
    const data = await res.json() as { files: Record<string, string> };
    if (!data.files || Object.keys(data.files).length === 0) return false;

    // Mount files into WebContainer
    const tree = buildFileSystemTree(data.files);
    await mountFiles(tree);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a flat { path: content } map into a WebContainer FileSystemTree.
 * Handles nested directories by creating intermediate directory entries.
 */
function buildFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    let current: any = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir]) {
        current[dir] = { directory: {} };
      }
      current = current[dir].directory;
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents: content } };
  }

  return tree;
}

/**
 * Recursively build a FileEntry tree from the WebContainer filesystem.
 * Uses try/catch on listFiles to distinguish files from directories:
 * readdir on a file path throws, readdir on a directory returns entries.
 */
async function buildFileTree(dirPath: string): Promise<FileEntry[]> {
  const entries = await listFiles(dirPath);
  const result: FileEntry[] = [];

  for (const name of entries) {
    // Skip node_modules and hidden files
    if (name === 'node_modules' || name.startsWith('.')) continue;

    const fullPath = dirPath === '.' ? name : `${dirPath}/${name}`;

    try {
      const children = await listFiles(fullPath);
      // If listFiles succeeds without throwing, it's a directory
      // However, an empty array could be either an empty dir or a file
      // that didn't throw — only recurse if we got an array back
      if (Array.isArray(children)) {
        const dirChildren = await buildFileTree(fullPath);
        result.push({ name, path: fullPath, type: 'directory', children: dirChildren });
      } else {
        result.push({ name, path: fullPath, type: 'file' });
      }
    } catch {
      // readdir on a file path throws — it's a file
      result.push({ name, path: fullPath, type: 'file' });
    }
  }

  // Sort: directories first, then files, alphabetical within each group
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}
