/**
 * Unified interface for both Browser Mode and Cloud Mode backends.
 *
 * The IDE uses this abstraction so it doesn't care which backend is active.
 * Switch mid-session if needed (e.g., "this project needs Docker -> upgrade to Cloud Mode").
 */

/** Stats returned by the stat operation. */
export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
}

/** Handle returned by spawn for process management. */
export interface ProcessHandle {
  output: ReadableStream<string>;
  exit: Promise<number>;
}

/** Terminal connection handle for bidirectional PTY I/O. */
export interface TerminalConnection {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  disconnect: () => void;
}

/** Unified interface for both Browser Mode and Cloud Mode backends. */
export interface RuntimeBackend {
  readonly mode: 'browser' | 'cloud';

  // Filesystem
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
  stat(path: string): Promise<FileStat>;

  // Process execution
  spawn(command: string, args?: string[]): Promise<ProcessHandle>;

  // Terminal
  connectTerminal(onData: (data: string) => void): TerminalConnection;
}
