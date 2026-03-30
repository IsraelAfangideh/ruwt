/**
 * QuickJS WASM engine for the Ruwt Runtime.
 *
 * Wraps quickjs-emscripten to evaluate JavaScript code in the browser
 * with Node.js-like globals (require, process, Buffer, console) backed
 * by the polyfill layer.
 */
import { getQuickJS } from 'quickjs-emscripten';
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { createPolyfills } from './node-polyfills';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let quickjs: any = null;
let initializing: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialize the QuickJS WASM module. Singleton — safe to call multiple times. */
export async function initialize(): Promise<void> {
  if (quickjs) return;
  if (initializing) return initializing;

  initializing = getQuickJS()
    .then((mod) => {
      quickjs = mod;
      initializing = null;
    })
    .catch((err) => {
      initializing = null;
      throw err;
    });

  return initializing;
}

/** Evaluate JavaScript code with Node.js-like globals. */
export async function evaluate(code: string, vfs: VirtualFileSystem): Promise<EvalResult> {
  if (!quickjs) throw new Error('QuickJS not initialized');

  let stdout = '';
  let stderr = '';

  const polyfills = createPolyfills(vfs);

  // Create a fresh runtime and context for isolation
  const runtime = quickjs.newRuntime();
  const context = runtime.newContext();

  try {
    // Inject console.log/error that capture to buffers
    const consoleObj = context.newObject();
    const logFn = context.newFunction('log', (...args: any[]) => {
      const parts = args.map((a: any) => {
        const val = context.dump(a);
        return typeof val === 'string' ? val : JSON.stringify(val);
      });
      stdout += parts.join(' ') + '\n';
    });
    const errorFn = context.newFunction('error', (...args: any[]) => {
      const parts = args.map((a: any) => {
        const val = context.dump(a);
        return typeof val === 'string' ? val : JSON.stringify(val);
      });
      stderr += parts.join(' ') + '\n';
    });
    context.setProp(consoleObj, 'log', logFn);
    context.setProp(consoleObj, 'error', errorFn);
    context.setProp(context.global, 'console', consoleObj);
    logFn.dispose();
    errorFn.dispose();
    consoleObj.dispose();

    // Inject require — marshals polyfill modules into QuickJS objects
    const requireFn = context.newFunction('require', (moduleNameHandle: any) => {
      const moduleName = context.dump(moduleNameHandle);
      const mod = (polyfills as any)[moduleName];
      if (mod) return marshalToQuickJS(context, mod);
      const filePath = vfs.resolve(moduleName);
      const content = vfs.readFile(filePath);
      if (content !== null) return context.newString(content);
      throw new Error(`Cannot find module '${moduleName}'`);
    });
    context.setProp(context.global, 'require', requireFn);
    requireFn.dispose();

    // Evaluate
    const result = context.evalCode(code);

    if (result.error) {
      const errMsg = context.dump(result.error);
      if (typeof result.error.dispose === 'function') result.error.dispose();
      stderr += String(errMsg) + '\n';
      return { stdout, stderr: stderr.trimEnd(), exitCode: 1 };
    }

    if (result.value && typeof result.value.dispose === 'function') {
      result.value.dispose();
    }

    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode: 0 };
  } finally {
    context.dispose();
    runtime.dispose();
  }
}

/** Clean up QuickJS resources. */
export function dispose(): void {
  quickjs = null;
}

/** Reset singleton state — only for testing. */
export function _resetForTesting(): void {
  quickjs = null;
  initializing = null;
}

// ---------------------------------------------------------------------------
// Marshaling: convert JS values into QuickJS handles
// ---------------------------------------------------------------------------

/** Recursively convert a JS value into a QuickJS handle. */
function marshalToQuickJS(context: any, value: unknown, depth = 0): any {
  // Prevent infinite recursion on circular references
  if (depth > 8) return context.undefined;

  if (value === null || value === undefined) return context.undefined;

  switch (typeof value) {
    case 'string':
      return context.newString(value);
    case 'number':
      return context.newNumber(value);
    case 'boolean':
      return value ? context.true : context.false;
    case 'function': {
      const fn = context.newFunction(value.name || 'anonymous', (...args: any[]) => {
        const jsArgs = args.map((a: any) => context.dump(a));
        const result = (value as (...a: unknown[]) => unknown)(...jsArgs);
        return marshalToQuickJS(context, result, depth + 1);
      });
      return fn;
    }
    case 'object': {
      if (Array.isArray(value)) {
        const arr = context.newArray();
        for (let i = 0; i < value.length; i++) {
          const elem = marshalToQuickJS(context, value[i], depth + 1);
          context.setProp(arr, i, elem);
          if (typeof elem.dispose === 'function') elem.dispose();
        }
        return arr;
      }
      const obj = context.newObject();
      for (const [key, val] of Object.entries(value)) {
        const handle = marshalToQuickJS(context, val, depth + 1);
        context.setProp(obj, key, handle);
        if (typeof handle.dispose === 'function') handle.dispose();
      }
      return obj;
    }
    default:
      return context.undefined;
  }
}
