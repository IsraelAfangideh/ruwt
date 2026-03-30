import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock quickjs-emscripten (WASM can't run in Node vitest)
// ---------------------------------------------------------------------------

const mockEvalCode = vi.fn().mockReturnValue({ value: undefined, error: undefined });
const mockSetProp = vi.fn();
const mockGetProp = vi.fn();
const mockNewFunction = vi.fn().mockReturnValue({ value: 'fn-handle', dispose: vi.fn() });
const mockNewString = vi.fn().mockImplementation((s: string) => ({ value: s, dispose: vi.fn() }));
const mockNewObject = vi.fn().mockReturnValue({ value: 'obj-handle', dispose: vi.fn() });
const mockDump = vi.fn().mockReturnValue(undefined);
const mockUnwrapResult = vi.fn().mockImplementation((r: any) => r.value);
const mockContextDispose = vi.fn();
const mockRuntimeDispose = vi.fn();
const mockNewNumber = vi.fn().mockImplementation((n: number) => ({ value: n, dispose: vi.fn() }));
const mockNewArray = vi.fn().mockReturnValue({ value: 'arr-handle', dispose: vi.fn() });
const mockNewContext = vi.fn().mockReturnValue({
  evalCode: mockEvalCode,
  setProp: mockSetProp,
  getProp: mockGetProp,
  newFunction: mockNewFunction,
  newString: mockNewString,
  newNumber: mockNewNumber,
  newObject: mockNewObject,
  newArray: mockNewArray,
  dump: mockDump,
  unwrapResult: mockUnwrapResult,
  global: { value: 'global-handle' },
  true: { value: true },
  false: { value: false },
  undefined: { value: undefined },
  dispose: mockContextDispose,
});
const mockNewRuntime = vi.fn().mockReturnValue({
  newContext: mockNewContext,
  setMemoryLimit: vi.fn(),
  setMaxStackSize: vi.fn(),
  dispose: mockRuntimeDispose,
});
const mockGetQuickJS = vi.fn().mockResolvedValue({
  newRuntime: mockNewRuntime,
});

vi.mock('quickjs-emscripten', () => ({
  getQuickJS: () => mockGetQuickJS(),
}));

import {
  initialize,
  evaluate,
  dispose,
  _resetForTesting,
} from './quickjs-engine';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuickJSEngine', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    vfs = new VirtualFileSystem('javascript', '');
  });

  // ── initialize ──────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('loads QuickJS WASM module', async () => {
      await initialize();
      expect(mockGetQuickJS).toHaveBeenCalledTimes(1);
    });

    it('resolves on success', async () => {
      await expect(initialize()).resolves.toBeUndefined();
    });

    it('is idempotent (singleton)', async () => {
      await initialize();
      await initialize();
      expect(mockGetQuickJS).toHaveBeenCalledTimes(1);
    });

    it('rejects when initialization fails', async () => {
      mockGetQuickJS.mockRejectedValueOnce(new Error('wasm failed'));
      await expect(initialize()).rejects.toThrow('wasm failed');
    });
  });

  // ── evaluate ────────────────────────────────────────────────────────────

  describe('evaluate', () => {
    it('throws if not initialized', async () => {
      await expect(evaluate('1+1', vfs)).rejects.toThrow('not initialized');
    });

    it('returns EvalResult with stdout, stderr, exitCode', async () => {
      await initialize();
      const result = await evaluate('console.log("hi")', vfs);
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
    });

    it('returns exitCode 0 on success', async () => {
      await initialize();
      mockEvalCode.mockReturnValueOnce({ value: undefined, error: undefined });
      const result = await evaluate('const x = 1;', vfs);
      expect(result.exitCode).toBe(0);
    });

    it('returns exitCode 1 on error', async () => {
      await initialize();
      mockEvalCode.mockReturnValueOnce({
        value: undefined,
        error: { value: 'err-handle' },
      });
      mockDump.mockReturnValueOnce('ReferenceError: x is not defined');
      const result = await evaluate('x', vfs);
      expect(result.exitCode).toBe(1);
    });

    it('returns error message in stderr on error', async () => {
      await initialize();
      mockEvalCode.mockReturnValueOnce({
        value: undefined,
        error: { value: 'err-handle' },
      });
      mockDump.mockReturnValueOnce('TypeError: not a function');
      const result = await evaluate('null()', vfs);
      expect(result.stderr).toContain('TypeError: not a function');
    });

    it('calls evalCode with the provided code', async () => {
      await initialize();
      await evaluate('const x = 42;', vfs);
      expect(mockEvalCode).toHaveBeenCalledWith('const x = 42;');
    });

    it('creates a new context for each evaluation', async () => {
      await initialize();
      await evaluate('1', vfs);
      await evaluate('2', vfs);
      expect(mockNewContext).toHaveBeenCalledTimes(2);
    });

    it('disposes context after evaluation', async () => {
      await initialize();
      await evaluate('1', vfs);
      expect(mockContextDispose).toHaveBeenCalledTimes(1);
    });

    it('marshals polyfill modules as QuickJS objects, not JSON strings', async () => {
      await initialize();
      await evaluate('const p = require("path")', vfs);
      // require('path') should call newObject (for the module) not just newString
      expect(mockNewObject).toHaveBeenCalled();
    });

    it('marshals functions in polyfill modules via newFunction', async () => {
      await initialize();
      await evaluate('const fs = require("fs")', vfs);
      // fs module has functions like readFileSync — should be marshaled via newFunction
      expect(mockNewFunction).toHaveBeenCalled();
    });
  });

  // ── dispose ─────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('cleans up QuickJS module', async () => {
      await initialize();
      dispose();
      // After dispose, should require re-initialization
    });

    it('allows re-initialization after dispose', async () => {
      await initialize();
      dispose();
      _resetForTesting();
      await initialize();
      expect(mockGetQuickJS).toHaveBeenCalledTimes(2);
    });

    it('does not throw if not initialized', () => {
      expect(() => dispose()).not.toThrow();
    });
  });
});
