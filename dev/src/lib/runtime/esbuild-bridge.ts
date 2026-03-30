/**
 * esbuild-wasm bridge for the Ruwt Runtime.
 *
 * Wraps esbuild-wasm to provide in-browser TypeScript/JSX transpilation
 * and bundling, using VirtualFileSystem as the source for an esbuild plugin.
 */
import * as esbuild from 'esbuild-wasm';
import type { Plugin as EsbuildPlugin } from 'esbuild-wasm';
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { HOME_DIR, NODE_MODULES_DIR } from './constants';

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let initialized = false;
let initializing: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Node built-in modules (mark as external)
// ---------------------------------------------------------------------------

const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'events', 'stream', 'buffer', 'crypto', 'http',
  'https', 'net', 'tls', 'url', 'util', 'assert', 'child_process',
  'worker_threads', 'vm', 'querystring', 'zlib', 'dgram', 'dns',
  'cluster', 'readline', 'tty', 'process', 'perf_hooks', 'async_hooks',
  'string_decoder', 'timers', 'console',
]);

// ---------------------------------------------------------------------------
// Extension resolution order
// ---------------------------------------------------------------------------

const EXTENSION_ORDER = ['.ts', '.tsx', '.js', '.jsx'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TransformOptions {
  loader?: esbuild.Loader;
}

export interface TransformResult {
  code: string;
  errors: string[];
}

export interface BundleResult {
  code: string;
  css?: string;
  errors: string[];
}

/** Initialize esbuild-wasm. Singleton — safe to call multiple times. */
export async function initialize(): Promise<void> {
  if (initialized) return;
  if (initializing) return initializing;

  initializing = esbuild
    .initialize({
      wasmURL: '/esbuild.wasm',
      worker: false,
    })
    .then(() => {
      initialized = true;
      initializing = null;
    })
    .catch((err) => {
      initializing = null;
      throw err;
    });

  return initializing;
}

/** Transform a single file (transpile TS/JSX → JS). */
export async function transform(
  code: string,
  options?: TransformOptions,
): Promise<TransformResult> {
  if (!initialized) throw new Error('esbuild not initialized');

  try {
    const result = await esbuild.transform(code, {
      loader: options?.loader ?? 'js',
    });

    return {
      code: result.code,
      errors: [],
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'errors' in err) {
      const failure = err as { errors: Array<{ text: string }> };
      return { code: '', errors: failure.errors.map((e) => e.text) };
    }
    throw err;
  }
}

/** Bundle an entry point, resolving imports from VirtualFileSystem. */
export async function bundle(
  entryPoint: string,
  vfs: VirtualFileSystem,
): Promise<BundleResult> {
  if (!initialized) throw new Error('esbuild not initialized');

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    plugins: [createVfsPlugin(vfs)],
  });

  const jsFile = result.outputFiles?.find((f) => !f.path.endsWith('.css'));
  const cssFile = result.outputFiles?.find((f) => f.path.endsWith('.css'));

  return {
    code: jsFile?.text ?? '',
    css: cssFile?.text,
    errors: result.errors.map((e) => e.text),
  };
}

/** Create an esbuild plugin that resolves and loads files from VFS. */
export function createVfsPlugin(vfs: VirtualFileSystem): EsbuildPlugin {
  const moduleCache = new Map<string, string>();

  return {
    name: 'ruwt-vfs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const importPath = args.path;

        if (NODE_BUILTINS.has(importPath)) {
          return { path: importPath, external: true };
        }

        if (importPath.startsWith('/')) {
          return { path: importPath, namespace: 'vfs' };
        }

        if (importPath.startsWith('.')) {
          const dir = args.importer
            ? args.importer.substring(0, args.importer.lastIndexOf('/'))
            : HOME_DIR;
          const resolved = resolvePath(vfs, dir + '/' + importPath);
          return { path: resolved, namespace: 'vfs' };
        }

        // Bare specifiers — cache to avoid re-parsing package.json
        if (moduleCache.has(importPath)) {
          return { path: moduleCache.get(importPath)!, namespace: 'vfs' };
        }
        const resolved = resolveNodeModule(vfs, importPath);
        moduleCache.set(importPath, resolved);
        return { path: resolved, namespace: 'vfs' };
      });

      // Load files from VFS
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
        const content = vfs.readFile(args.path);
        if (content === null) {
          return {
            errors: [{ text: `File not found in VFS: ${args.path}` }],
          };
        }
        return {
          contents: content,
          loader: loaderForPath(args.path),
        };
      });
    },
  };
}

/** Clean up esbuild resources. */
export function dispose(): void {
  if (initialized) {
    esbuild.stop();
    initialized = false;
  }
}

/** Reset singleton state — only for testing. */
export function _resetForTesting(): void {
  initialized = false;
  initializing = null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize and resolve a path, trying extension fallbacks. */
function resolvePath(vfs: VirtualFileSystem, rawPath: string): string {
  // Normalize double slashes, dots, etc.
  const normalized = normalizePath(rawPath);

  // Exact match
  if (vfs.exists(normalized) && !isDirectory(vfs, normalized)) {
    return normalized;
  }

  // Try extensions
  for (const ext of EXTENSION_ORDER) {
    if (vfs.exists(normalized + ext)) {
      return normalized + ext;
    }
  }

  // Try as directory with index file
  for (const ext of EXTENSION_ORDER) {
    const indexPath = normalized + '/index' + ext;
    if (vfs.exists(indexPath)) {
      return indexPath;
    }
  }

  // Return as-is — esbuild will report the error via onLoad
  return normalized;
}

/** Resolve a bare specifier (e.g., "lodash") to node_modules. */
function resolveNodeModule(vfs: VirtualFileSystem, name: string): string {
  const base = NODE_MODULES_DIR + '/' + name;

  // Check for package.json main field
  const pkgJsonPath = base + '/package.json';
  const pkgJson = vfs.readFile(pkgJsonPath);
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      const main = pkg.module || pkg.main || 'index.js';
      const mainPath = base + '/' + main;
      const resolved = resolvePath(vfs, mainPath);
      if (vfs.exists(resolved)) return resolved;
    } catch {
      // Invalid JSON — fall through
    }
  }

  // Try direct index resolution
  return resolvePath(vfs, base);
}

/** Infer the esbuild loader from a file extension. */
function loaderForPath(path: string): esbuild.Loader {
  const ext = path.substring(path.lastIndexOf('.'));
  switch (ext) {
    case '.ts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.jsx':
      return 'jsx';
    case '.css':
      return 'css';
    case '.json':
      return 'json';
    default:
      return 'js';
  }
}

/** Simple path normalization (resolve . and .., collapse //) */
function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return '/' + stack.join('/');
}

/** Check if a path is a directory in VFS. */
function isDirectory(vfs: VirtualFileSystem, path: string): boolean {
  const stat = vfs.stat(path);
  return stat !== null && stat.isDirectory;
}
