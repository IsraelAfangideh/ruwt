/**
 * Ruwt Runtime backend — implements RuntimeBackend using VirtualFileSystem,
 * QuickJS engine, and npm client instead of WebContainer.
 *
 * Drop-in replacement for BrowserBackend. The IDE doesn't know or care
 * which backend is active — same interface, different engine.
 */
import type { RuntimeBackend, FileStat, ProcessHandle, TerminalConnection } from './runtime';
import { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import { VirtualShell } from '@/features/shared-ide/VirtualShell';
import type { ShellCallbacks, RuntimeCallbacks } from '@/features/shared-ide/VirtualShell';
import { initialize as initEsbuild } from '@/lib/runtime/esbuild-bridge';
import { initialize as initQuickJS, evaluate as quickjsEval } from '@/lib/runtime/quickjs-engine';
import { NpmClient } from '@/lib/runtime/npm-client';
import { createEnoent } from '@/lib/runtime/node-polyfills';

export class RuwtBackend implements RuntimeBackend {
  readonly mode = 'browser' as const;

  private vfs: VirtualFileSystem;
  private npmClient: NpmClient;

  constructor() {
    this.vfs = new VirtualFileSystem('javascript', '');
    this.npmClient = new NpmClient(this.vfs);
  }

  /** Get the internal VFS (for file tree building, project persistence, etc.) */
  getVfs(): VirtualFileSystem {
    return this.vfs;
  }

  /** Initialize esbuild-wasm and QuickJS WASM engines. */
  async initialize(): Promise<void> {
    await Promise.all([initEsbuild(), initQuickJS()]);
  }

  // ── Filesystem ────────────────────────────────────────────────────────

  async readFile(path: string): Promise<string> {
    const content = this.vfs.readFile(path);
    if (content === null) {
      throw createEnoent(path);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.vfs.writeFile(path, content);
  }

  async readdir(path: string): Promise<string[]> {
    const entries = this.vfs.readdir(path);
    if (entries === null) {
      throw createEnoent(path);
    }
    return entries;
  }

  async mkdir(path: string): Promise<void> {
    this.vfs.mkdir(path);
  }

  async rm(path: string): Promise<void> {
    this.vfs.remove(path);
  }

  async stat(path: string): Promise<FileStat> {
    const s = this.vfs.stat(path);
    if (s === null) {
      throw createEnoent(path);
    }
    return {
      isFile: !s.isDirectory,
      isDirectory: s.isDirectory,
      size: s.size,
    };
  }

  // ── Process execution ─────────────────────────────────────────────────

  async spawn(command: string, args: string[] = []): Promise<ProcessHandle> {
    if (command === 'node') {
      return this.spawnNode(args);
    }

    // Unknown command
    let controller: ReadableStreamDefaultController<string> | null = null;
    const output = new ReadableStream<string>({
      start(c) { controller = c; },
    });
    controller!.enqueue(`${command}: command not found\n`);
    controller!.close();
    return { output, exit: Promise.resolve(127) };
  }

  // ── Terminal ──────────────────────────────────────────────────────────

  connectTerminal(onData: (data: string) => void): TerminalConnection {
    // Create a minimal terminal interface that captures writes
    const termProxy = {
      write: (data: string) => { onData(data); },
      writeln: (data: string) => { onData(data + '\r\n'); },
      clear: () => { onData('\x1b[2J\x1b[H'); },
      onData: () => ({ dispose: () => {} }),
      cols: 80,
      rows: 24,
    };

    const shellCallbacks: ShellCallbacks = {
      onRunCode: async (code: string) => {
        return quickjsEval(code, this.vfs);
      },
      onRunTests: async () => {
        return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      },
      onEnterRuwt: () => {},
    };

    const runtimeCallbacks: RuntimeCallbacks = {
      evaluate: async (code: string) => {
        return quickjsEval(code, this.vfs);
      },
      npmInstall: async (packages: string[]) => {
        if (packages.length === 0) {
          await this.npmClient.installFromPackageJson();
        } else {
          await this.npmClient.install(packages);
        }
      },
      npmInit: async () => {
        this.vfs.writeFile('/home/user/package.json', JSON.stringify({
          name: 'ruwt-project',
          version: '1.0.0',
          type: 'module',
          scripts: { start: 'node index.js' },
        }, null, 2));
      },
    };

    const shell = new VirtualShell(
      termProxy as any,
      this.vfs,
      'javascript',
      shellCallbacks,
      runtimeCallbacks,
    );
    shell.printPrompt();

    return {
      write: (data: string) => { shell.handleInput(data); },
      resize: () => {},
      disconnect: () => {},
    };
  }

  // ── Private ───────────────────────────────────────────────────────────

  private async spawnNode(args: string[]): Promise<ProcessHandle> {
    const filePath = args[0] ? this.vfs.resolve(args[0]) : null;
    const code = filePath ? this.vfs.readFile(filePath) : null;

    let controller: ReadableStreamDefaultController<string> | null = null;
    const output = new ReadableStream<string>({
      start(c) { controller = c; },
    });

    if (!code && filePath) {
      controller!.enqueue(`Error: Cannot find module '${args[0]}'\n`);
      controller!.close();
      return { output, exit: Promise.resolve(1) };
    }

    const result = await quickjsEval(code ?? '', this.vfs);
    if (result.stdout) controller!.enqueue(result.stdout + '\n');
    if (result.stderr) controller!.enqueue(result.stderr + '\n');
    controller!.close();

    return { output, exit: Promise.resolve(result.exitCode) };
  }
}
