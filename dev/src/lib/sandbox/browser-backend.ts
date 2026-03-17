/**
 * Browser Mode backend: implements RuntimeBackend using WebContainer.
 * Delegates all operations to the existing webcontainer.ts wrapper.
 */
import type { RuntimeBackend, FileStat, ProcessHandle, TerminalConnection } from './runtime';
import {
  readFile as wcReadFile,
  writeFile as wcWriteFile,
  listFiles,
  mkdir as wcMkdir,
  deleteFile,
  spawn as wcSpawn,
  spawnWithInput,
} from './webcontainer';

export class BrowserBackend implements RuntimeBackend {
  readonly mode = 'browser' as const;

  async readFile(path: string): Promise<string> {
    return wcReadFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await wcWriteFile(path, content);
  }

  async readdir(path: string): Promise<string[]> {
    return listFiles(path);
  }

  async mkdir(path: string): Promise<void> {
    await wcMkdir(path);
  }

  async rm(path: string): Promise<void> {
    await deleteFile(path);
  }

  async stat(path: string): Promise<FileStat> {
    // WebContainer doesn't have a direct stat. Infer from readdir/readFile.
    try {
      const entries = await listFiles(path);
      if (Array.isArray(entries)) {
        return { isFile: false, isDirectory: true, size: 0 };
      }
    } catch {
      // Not a directory — try reading as file
    }
    try {
      const content = await wcReadFile(path);
      return { isFile: true, isDirectory: false, size: content.length };
    } catch {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
  }

  async spawn(command: string, args: string[] = []): Promise<ProcessHandle> {
    return wcSpawn(command, args);
  }

  connectTerminal(onData: (data: string) => void): TerminalConnection {
    let writer: WritableStreamDefaultWriter<string> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let disposed = false;

    // Start shell asynchronously
    spawnWithInput('jsh').then((proc) => {
      /* istanbul ignore next -- @preserve */
      if (disposed) return;

      writer = proc.input.getWriter();
      reader = proc.output.getReader();

      // Pump output
      (async () => {
        /* istanbul ignore next -- @preserve */
        if (!reader) return;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || disposed) break;
            onData(value);
          }
        } catch {
          // Stream closed
        }
      })();
    }).catch(/* istanbul ignore next -- @preserve */ () => {});

    return {
      write: (data: string) => {
        writer?.write(data).catch(/* istanbul ignore next -- @preserve */ () => {});
      },
      resize: () => {
        // WebContainer doesn't support terminal resize via API
      },
      disconnect: () => {
        disposed = true;
        reader?.cancel().catch(/* istanbul ignore next -- @preserve */ () => {});
        writer?.close().catch(/* istanbul ignore next -- @preserve */ () => {});
      },
    };
  }
}
