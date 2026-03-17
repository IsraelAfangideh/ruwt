import { describe, it, expect } from 'vitest';
import type { RuntimeBackend, FileStat, ProcessHandle, TerminalConnection } from './runtime';

/**
 * Type-level tests for the RuntimeBackend interface.
 * Verifies the interface shape is correct and both 'browser' and 'cloud' modes are valid.
 */

describe('RuntimeBackend interface', () => {
  it('accepts a browser mode backend', () => {
    const backend: RuntimeBackend = {
      mode: 'browser',
      readFile: async () => 'content',
      writeFile: async () => {},
      readdir: async () => ['file.js'],
      mkdir: async () => {},
      rm: async () => {},
      stat: async () => ({ isFile: true, isDirectory: false, size: 100 }),
      spawn: async () => ({ output: new ReadableStream(), exit: Promise.resolve(0) }),
      connectTerminal: () => ({ write: () => {}, resize: () => {}, disconnect: () => {} }),
    };

    expect(backend.mode).toBe('browser');
  });

  it('accepts a cloud mode backend', () => {
    const backend: RuntimeBackend = {
      mode: 'cloud',
      readFile: async () => 'content',
      writeFile: async () => {},
      readdir: async () => ['file.js'],
      mkdir: async () => {},
      rm: async () => {},
      stat: async () => ({ isFile: true, isDirectory: false, size: 100 }),
      spawn: async () => ({ output: new ReadableStream(), exit: Promise.resolve(0) }),
      connectTerminal: () => ({ write: () => {}, resize: () => {}, disconnect: () => {} }),
    };

    expect(backend.mode).toBe('cloud');
  });

  it('FileStat has the expected shape', () => {
    const stat: FileStat = { isFile: true, isDirectory: false, size: 42 };
    expect(stat.isFile).toBe(true);
    expect(stat.isDirectory).toBe(false);
    expect(stat.size).toBe(42);
  });

  it('ProcessHandle has output and exit', async () => {
    const handle: ProcessHandle = {
      output: new ReadableStream(),
      exit: Promise.resolve(0),
    };
    expect(handle.output).toBeInstanceOf(ReadableStream);
    expect(await handle.exit).toBe(0);
  });

  it('TerminalConnection has write, resize, disconnect', () => {
    const conn: TerminalConnection = {
      write: () => {},
      resize: () => {},
      disconnect: () => {},
    };
    expect(typeof conn.write).toBe('function');
    expect(typeof conn.resize).toBe('function');
    expect(typeof conn.disconnect).toBe('function');
  });
});
