/**
 * useWebContainer: manages WebContainer lifecycle for the standalone IDE.
 * Boots the container on mount, creates starter files, and exposes a file tree.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getWebContainer,
  mountFiles,
  createStarterFiles,
  listFiles,
} from '@/lib/sandbox/webcontainer';
import type { FileEntry } from './FileTree';

export function useWebContainer() {
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function init() {
      try {
        await getWebContainer();
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
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const tree = await buildFileTree('.');
      setFiles(tree);
    } catch {
      // Swallow — tree might not be ready yet
    }
  }, []);

  return { ready, files, error, refreshFiles };
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
