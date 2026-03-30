/**
 * Virtual shell interpreter connected to VFS and xterm.
 * Supports: ls, cat, echo, cd, pwd, mkdir, rm, clear, help, touch, mv, cp, run, test, ruwt
 */
import type { Terminal } from '@xterm/xterm';
import type { VirtualFileSystem } from './VirtualFileSystem';

export interface ShellCallbacks {
  onRunCode: (code: string, language: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  onRunTests: (code: string, language: string) => Promise<{
    passed: boolean;
    passedTests: number;
    totalTests: number;
    results?: Array<{ passed: boolean; input: string; expectedOutput: string; actualOutput: string; error?: string | null }>;
  }>;
  onEnterRuwt: () => void;
}

export interface RuntimeCallbacks {
  evaluate: (code: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  npmInstall: (packages: string[]) => Promise<void>;
  npmInit: () => Promise<void>;
}

export class VirtualShell {
  private term: Terminal;
  private fs: VirtualFileSystem;
  private callbacks: ShellCallbacks;
  private language: string;
  private line = '';
  private history: string[] = [];
  private historyIndex = -1;
  private savedLine = '';
  private cursorPos = 0;
  private writeMode: { filename: string; lines: string[] } | null = null;
  private runtime: RuntimeCallbacks | undefined;

  constructor(term: Terminal, fs: VirtualFileSystem, language: string, callbacks: ShellCallbacks, runtime?: RuntimeCallbacks) {
    this.term = term;
    this.fs = fs;
    this.language = language;
    this.callbacks = callbacks;
    this.runtime = runtime;
  }

  printPrompt(): void {
    this.term.write(`\r\n\x1b[36m${this.fs.getShortCwd()}\x1b[0m \x1b[33m$\x1b[0m `);
  }

  handleInput(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      // ESC sequence — arrow keys
      if (ch === '\x1b' && data[i + 1] === '[') {
        const arrow = data[i + 2];
        if (arrow === 'A') { this.historyUp(); i += 2; continue; }
        if (arrow === 'B') { this.historyDown(); i += 2; continue; }
        if (arrow === 'C') { // right arrow
          if (this.cursorPos < this.line.length) {
            this.cursorPos++;
            this.term.write('\x1b[C');
          }
          i += 2; continue;
        }
        if (arrow === 'D') { // left arrow
          if (this.cursorPos > 0) {
            this.cursorPos--;
            this.term.write('\x1b[D');
          }
          i += 2; continue;
        }
        i += 2; continue;
      }

      // Ctrl+C
      if (code === 3) {
        this.term.write('^C');
        this.line = '';
        this.cursorPos = 0;
        this.printPrompt();
        continue;
      }

      // Backspace
      if (code === 127 || code === 8) {
        if (this.cursorPos > 0) {
          this.line = this.line.slice(0, this.cursorPos - 1) + this.line.slice(this.cursorPos);
          this.cursorPos--;
          this.redrawLine();
        }
        continue;
      }

      // Enter
      if (ch === '\r' || ch === '\n') {
        this.term.write('\r\n');
        const raw = this.line;
        this.line = '';
        this.cursorPos = 0;
        this.historyIndex = -1;

        // Write mode: collect lines until EOF
        if (this.writeMode) {
          if (raw.trim() === 'EOF') {
            const content = this.writeMode.lines.join('\n');
            this.fs.writeFile(this.writeMode.filename, content);
            this.term.write(`\x1b[32m[saved ${this.writeMode.filename} \u2014 ${content.length} bytes]\x1b[0m\r\n`);
            this.writeMode = null;
            this.printPrompt();
          } else {
            this.writeMode.lines.push(raw);
            this.term.write('\x1b[90m> \x1b[0m');
          }
          continue;
        }

        const cmd = raw.trim();
        if (cmd) {
          this.history.unshift(cmd);
          if (this.history.length > 50) this.history.pop();
          this.execute(cmd);
        } else {
          this.printPrompt();
        }
        continue;
      }

      // Tab — autocomplete
      if (code === 9) {
        this.handleTab();
        continue;
      }

      // Printable character
      /* istanbul ignore next -- @preserve */
      if (code >= 32) {
        this.line = this.line.slice(0, this.cursorPos) + ch + this.line.slice(this.cursorPos);
        this.cursorPos++;
        this.redrawLine();
      }
    }
  }

  private static readonly COMMANDS = [
    'ls', 'cat', 'echo', 'cd', 'pwd', 'mkdir', 'rm', 'touch', 'mv', 'cp',
    'write', 'clear', 'help', 'run', 'test', 'ruwt', 'node', 'npm', 'npx',
  ];

  private handleTab(): void {
    const parts = this.line.slice(0, this.cursorPos).split(' ');
    const isFirstWord = parts.length <= 1;
    const partial = parts[parts.length - 1];
    if (!partial) return;

    if (isFirstWord) {
      // Complete command names
      const matches = VirtualShell.COMMANDS.filter((c) => c.startsWith(partial));
      this.applyCompletion(partial, matches);
    } else {
      // Complete file/directory paths
      const lastSlash = partial.lastIndexOf('/');
      const dir = lastSlash >= 0 ? partial.slice(0, lastSlash) || '/' : '.';
      const prefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;
      const entries = this.fs.readdir(dir === '.' ? this.fs.getCwd() : this.fs.resolve(dir));
      if (!entries) return;
      const matches = entries.filter((e) => e.startsWith(prefix));
      const completions = matches.map((m) => (lastSlash >= 0 ? partial.slice(0, lastSlash + 1) + m : m));
      this.applyCompletion(partial, completions);
    }
  }

  private applyCompletion(partial: string, matches: string[]): void {
    if (matches.length === 0) return;

    if (matches.length === 1) {
      // Single match — complete it
      const suffix = matches[0].slice(partial.length);
      this.line = this.line.slice(0, this.cursorPos) + suffix + this.line.slice(this.cursorPos);
      this.cursorPos += suffix.length;
      this.redrawLine();
    } else {
      // Multiple matches — complete common prefix, then show options
      let common = matches[0];
      for (const m of matches) {
        while (!m.startsWith(common)) common = common.slice(0, -1);
      }
      const suffix = common.slice(partial.length);
      if (suffix) {
        this.line = this.line.slice(0, this.cursorPos) + suffix + this.line.slice(this.cursorPos);
        this.cursorPos += suffix.length;
        this.redrawLine();
      } else {
        // Show all options
        this.term.write('\r\n' + matches.join('  ') + '\r\n');
        this.redrawLine();
      }
    }
  }

  private redrawLine(): void {
    const prompt = `\x1b[36m${this.fs.getShortCwd()}\x1b[0m \x1b[33m$\x1b[0m `;
    this.term.write(`\r${prompt}${this.line}\x1b[K`);
    // Move cursor to correct position
    const moveBack = this.line.length - this.cursorPos;
    if (moveBack > 0) {
      this.term.write(`\x1b[${moveBack}D`);
    }
  }

  private historyUp(): void {
    if (this.history.length === 0) return;
    if (this.historyIndex === -1) this.savedLine = this.line;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.line = this.history[this.historyIndex];
      this.cursorPos = this.line.length;
      this.redrawLine();
    }
  }

  private historyDown(): void {
    if (this.historyIndex <= 0) {
      this.historyIndex = -1;
      this.line = this.savedLine;
      this.cursorPos = this.line.length;
      this.redrawLine();
      return;
    }
    this.historyIndex--;
    this.line = this.history[this.historyIndex];
    this.cursorPos = this.line.length;
    this.redrawLine();
  }

  private execute(input: string): void {
    // Handle output redirection: cmd > file or cmd >> file
    const redirectMatch = input.match(/^(.+?)\s*(>>|>)\s*(\S+)\s*$/);
    if (redirectMatch) {
      const [, cmdPart, op, targetFile] = redirectMatch;
      const output = this.captureCommand(cmdPart.trim());
      if (output !== null) {
        if (op === '>>') {
          const existing = this.fs.readFile(targetFile) || '';
          this.fs.writeFile(targetFile, existing + output);
        } else {
          this.fs.writeFile(targetFile, output);
        }
        this.term.write(`\x1b[32m[written to ${targetFile}]\x1b[0m\r\n`);
      }
      this.printPrompt();
      return;
    }

    const args = this.parseArgs(input);
    /* istanbul ignore next -- @preserve */
    if (args.length === 0) { this.printPrompt(); return; }
    const cmd = args[0];
    const rest = args.slice(1);

    switch (cmd) {
      case 'ls': this.cmdLs(rest); break;
      case 'cat': this.cmdCat(rest); break;
      case 'echo': this.cmdEcho(rest); break;
      case 'cd': this.cmdCd(rest); break;
      case 'pwd': this.cmdPwd(); break;
      case 'mkdir': this.cmdMkdir(rest); break;
      case 'rm': this.cmdRm(rest); break;
      case 'touch': this.cmdTouch(rest); break;
      case 'mv': this.cmdMv(rest); break;
      case 'cp': this.cmdCp(rest); break;
      case 'write': this.cmdWrite(rest); break;
      case 'clear': this.cmdClear(); break;
      case 'help': this.cmdHelp(); break;
      case 'run': this.cmdRun(); break;
      case 'test': this.cmdTest(); break;
      case 'ruwt': this.cmdRuwt(); break;
      case 'node': this.cmdNode(rest); break;
      case 'npm': this.cmdNpm(rest); break;
      case 'npx': this.cmdNpx(rest); break;
      default:
        this.term.write(`\x1b[31m${cmd}: command not found\x1b[0m\r\n`);
        this.term.write(`Type \x1b[33mhelp\x1b[0m for available commands.\r\n`);
        this.printPrompt();
    }
  }

  /** Execute a command and capture its text output instead of printing to terminal. */
  private captureCommand(input: string): string | null {
    const args = this.parseArgs(input);
    /* istanbul ignore next -- @preserve */
    if (args.length === 0) return null;
    const cmd = args[0];
    const rest = args.slice(1);

    switch (cmd) {
      case 'echo': return rest.join(' ') + '\n';
      case 'cat': {
        const parts: string[] = [];
        for (const arg of rest) {
          const content = this.fs.readFile(arg);
          if (content == null) {
            this.term.write(`\x1b[31mcat: ${arg}: No such file\x1b[0m\r\n`);
            return null;
          }
          parts.push(content);
        }
        return parts.join('\n');
      }
      case 'pwd': return this.fs.getCwd() + '\n';
      case 'ls': {
        const path = rest.find((a) => !a.startsWith('-')) || '.';
        const entries = this.fs.readdir(path);
        if (!entries) return null;
        return entries.join('\n') + '\n';
      }
      default:
        this.term.write(`\x1b[31mRedirection not supported for: ${cmd}\x1b[0m\r\n`);
        return null;
    }
  }

  private parseArgs(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (const ch of input) {
      if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
      if (ch === ' ' && !inSingle && !inDouble) {
        /* istanbul ignore next -- @preserve */
        if (current) { args.push(current); current = ''; }
        continue;
      }
      current += ch;
    }
    /* istanbul ignore next -- @preserve */
    if (current) args.push(current);
    return args;
  }

  /* ── Commands ── */

  private cmdLs(args: string[]): void {
    const showLong = args.includes('-l');
    const path = args.find((a) => !a.startsWith('-')) || '.';

    if (showLong) {
      const entries = this.fs.listDetailed(path);
      if (!entries) {
        this.term.write(`\x1b[31mls: ${path}: No such directory\x1b[0m\r\n`);
        this.printPrompt();
        return;
      }
      for (const e of entries) {
        const color = e.isDirectory ? '\x1b[34m' : '\x1b[0m';
        const suffix = e.isDirectory ? '/' : '';
        const size = e.isDirectory ? '-' : `${e.size}`;
        this.term.write(`${size.padStart(8)}  ${color}${e.name}${suffix}\x1b[0m\r\n`);
      }
    } else {
      const entries = this.fs.readdir(path);
      if (!entries) {
        this.term.write(`\x1b[31mls: ${path}: No such directory\x1b[0m\r\n`);
        this.printPrompt();
        return;
      }
      const line = entries.map((e) => {
        const abs = this.fs.resolve((path === '.' ? '' : path + '/') + e);
        const s = this.fs.stat(abs);
        /* istanbul ignore next -- @preserve */
        if (s?.isDirectory) return `\x1b[34m${e}/\x1b[0m`;
        return e;
      }).join('  ');
      if (line) this.term.write(line + '\r\n');
    }
    this.printPrompt();
  }

  private cmdCat(args: string[]): void {
    if (args.length === 0) {
      this.term.write(`\x1b[31mcat: missing file argument\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }
    for (const arg of args) {
      const content = this.fs.readFile(arg);
      if (content == null) {
        this.term.write(`\x1b[31mcat: ${arg}: No such file\x1b[0m\r\n`);
      } else {
        // Write content with proper line endings for terminal
        const lines = content.split('\n');
        for (const line of lines) {
          this.term.write(line + '\r\n');
        }
      }
    }
    this.printPrompt();
  }

  private cmdEcho(args: string[]): void {
    this.term.write(args.join(' ') + '\r\n');
    this.printPrompt();
  }

  private cmdCd(args: string[]): void {
    const target = args[0] || '/home/user';
    const resolved = target === '~' ? '/home/user' : target.replace(/^~\//, '/home/user/');
    if (!this.fs.setCwd(resolved)) {
      this.term.write(`\x1b[31mcd: ${target}: No such directory\x1b[0m\r\n`);
    }
    this.printPrompt();
  }

  private cmdPwd(): void {
    this.term.write(this.fs.getCwd() + '\r\n');
    this.printPrompt();
  }

  private cmdMkdir(args: string[]): void {
    for (const arg of args) {
      if (!this.fs.mkdir(arg)) {
        this.term.write(`\x1b[31mmkdir: ${arg}: Failed to create directory\x1b[0m\r\n`);
      }
    }
    this.printPrompt();
  }

  private cmdRm(args: string[]): void {
    for (const arg of args) {
      if (arg === '-r' || arg === '-rf') continue;
      if (!this.fs.remove(arg)) {
        this.term.write(`\x1b[31mrm: ${arg}: No such file\x1b[0m\r\n`);
      }
    }
    this.printPrompt();
  }

  private cmdTouch(args: string[]): void {
    for (const arg of args) {
      if (!this.fs.exists(arg)) {
        this.fs.writeFile(arg, '');
      }
    }
    this.printPrompt();
  }

  private cmdMv(args: string[]): void {
    if (args.length < 2) {
      this.term.write(`\x1b[31mmv: missing destination\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }
    if (!this.fs.rename(args[0], args[1])) {
      this.term.write(`\x1b[31mmv: ${args[0]}: No such file\x1b[0m\r\n`);
    }
    this.printPrompt();
  }

  private cmdCp(args: string[]): void {
    if (args.length < 2) {
      this.term.write(`\x1b[31mcp: missing destination\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }
    if (!this.fs.copy(args[0], args[1])) {
      this.term.write(`\x1b[31mcp: ${args[0]}: No such file\x1b[0m\r\n`);
    }
    this.printPrompt();
  }

  private cmdWrite(args: string[]): void {
    if (args.length === 0) {
      this.term.write(`\x1b[31mwrite: missing filename\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }
    this.writeMode = { filename: args[0], lines: [] };
    this.term.write(`\x1b[33mEntering write mode for ${args[0]}. Type EOF on a new line to save.\x1b[0m\r\n`);
    this.term.write('\x1b[90m> \x1b[0m');
  }

  private cmdClear(): void {
    this.term.clear();
    this.printPrompt();
  }

  private cmdHelp(): void {
    this.term.write('\x1b[1mAvailable commands:\x1b[0m\r\n');
    this.term.write('  \x1b[33mls\x1b[0m [-l] [path]    List files\r\n');
    this.term.write('  \x1b[33mcat\x1b[0m <file>        Show file contents\r\n');
    this.term.write('  \x1b[33mecho\x1b[0m <text>       Print text\r\n');
    this.term.write('  \x1b[33mwrite\x1b[0m <file>      Multi-line file editor (EOF to save)\r\n');
    this.term.write('  \x1b[33mcd\x1b[0m [path]         Change directory\r\n');
    this.term.write('  \x1b[33mpwd\x1b[0m               Print working directory\r\n');
    this.term.write('  \x1b[33mmkdir\x1b[0m <dir>       Create directory\r\n');
    this.term.write('  \x1b[33mrm\x1b[0m <file>         Remove file\r\n');
    this.term.write('  \x1b[33mtouch\x1b[0m <file>      Create empty file\r\n');
    this.term.write('  \x1b[33mmv\x1b[0m <src> <dst>    Move/rename file\r\n');
    this.term.write('  \x1b[33mcp\x1b[0m <src> <dst>    Copy file\r\n');
    this.term.write('  \x1b[33mclear\x1b[0m             Clear terminal\r\n');
    this.term.write('  \x1b[33mrun\x1b[0m               Execute your code\r\n');
    this.term.write('  \x1b[33mtest\x1b[0m              Run test cases\r\n');
    this.term.write('  \x1b[33mruwt\x1b[0m              Enter AI assistant mode\r\n');
    this.term.write('  \x1b[33mnode\x1b[0m <file>       Run JavaScript file\r\n');
    this.term.write('  \x1b[33mnpm\x1b[0m <cmd>         Package manager (install, init)\r\n');
    this.term.write('  \x1b[33mnpx\x1b[0m <pkg>         Run package binary\r\n');
    this.term.write('  \x1b[33mhelp\x1b[0m              Show this help\r\n');
    this.term.write('\r\n\x1b[1mRedirection:\x1b[0m\r\n');
    this.term.write('  echo "text" \x1b[33m>\x1b[0m file    Write to file\r\n');
    this.term.write('  echo "text" \x1b[33m>>\x1b[0m file   Append to file\r\n');
    this.printPrompt();
  }

  private cmdRun(): void {
    const code = this.fs.getSolutionCode();
    if (!code.trim()) {
      this.term.write('\x1b[31mNo code to run. Write some code in the editor first.\x1b[0m\r\n');
      this.printPrompt();
      return;
    }
    this.term.write(`\x1b[33mRunning ${this.fs.solutionFilename}...\x1b[0m\r\n`);
    this.callbacks.onRunCode(code, this.language).then(
      (result) => { this.printEvalResult(result); },
      (err) => {
        /* istanbul ignore next -- @preserve */
        this.term.write(`\x1b[31mExecution error: ${err.message || err}\x1b[0m\r\n`);
        this.printPrompt();
      },
    );
  }

  private cmdTest(): void {
    const code = this.fs.getSolutionCode();
    if (!code.trim()) {
      this.term.write('\x1b[31mNo code to test. Write some code first.\x1b[0m\r\n');
      this.printPrompt();
      return;
    }
    this.term.write('\x1b[33mRunning tests...\x1b[0m\r\n');
    this.callbacks.onRunTests(code, this.language).then(
      (result) => {
        this.term.write('\r\n');
        if (result.results) {
          result.results.forEach((tc, i) => {
            const icon = tc.passed ? '\x1b[32m\u2713\x1b[0m' : '\x1b[31m\u2717\x1b[0m';
            this.term.write(`  ${icon} Test ${i + 1}`);
            if (!tc.passed) {
              this.term.write(`\r\n    Input:    ${tc.input || '(none)'}`);
              this.term.write(`\r\n    Expected: \x1b[32m${tc.expectedOutput}\x1b[0m`);
              this.term.write(`\r\n    Actual:   \x1b[31m${tc.actualOutput || '(empty)'}\x1b[0m`);
              if (tc.error) {
                this.term.write(`\r\n    Error:    \x1b[31m${tc.error}\x1b[0m`);
              }
            }
            this.term.write('\r\n');
          });
        }
        const color = result.passed ? '\x1b[32m' : '\x1b[31m';
        const icon = result.passed ? '\u2713' : '\u2717';
        this.term.write(`\r\n${color}${icon} ${result.passedTests}/${result.totalTests} tests passed\x1b[0m\r\n`);
        this.printPrompt();
      },
      (err) => {
        /* istanbul ignore next -- @preserve */
        this.term.write(`\x1b[31mTest error: ${err.message || err}\x1b[0m\r\n`);
        this.printPrompt();
      }
    );
  }

  private cmdRuwt(): void {
    this.callbacks.onEnterRuwt();
  }

  // ── Runtime commands ────────────────────────────────────────────────────

  private requireRuntime(cmd: string): boolean {
    if (this.runtime) return true;
    this.term.write(`\x1b[31mRuntime not available. ${cmd} command requires Ruwt Runtime.\x1b[0m\r\n`);
    this.printPrompt();
    return false;
  }

  private printRuntimeError(err: any): void {
    /* istanbul ignore next -- @preserve */
    this.term.write(`\x1b[31m${err.message || err}\x1b[0m\r\n`);
    this.printPrompt();
  }

  private cmdNode(args: string[]): void {
    if (!this.requireRuntime('node')) return;

    if (args[0] === '-e' && args.length > 1) {
      const code = args.slice(1).join(' ');
      this.runtime!.evaluate(code).then(
        (result) => { this.printEvalResult(result); },
        (err) => { this.printRuntimeError(err); },
      );
      return;
    }

    if (args.length === 0) {
      this.term.write('Usage: node <file> or node -e "code"\r\n');
      this.printPrompt();
      return;
    }

    const filePath = this.fs.resolve(args[0]);
    const code = this.fs.readFile(filePath);
    if (code === null) {
      this.term.write(`\x1b[31m${args[0]}: not found\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }

    this.term.write(`\x1b[33mRunning ${args[0]}...\x1b[0m\r\n`);
    this.runtime!.evaluate(code).then(
      (result) => { this.printEvalResult(result); },
      (err) => { this.printRuntimeError(err); },
    );
  }

  private cmdNpm(args: string[]): void {
    if (!this.requireRuntime('npm')) return;

    const subcommand = args[0];

    if (subcommand === '--version' || subcommand === '-v') {
      this.term.write('1.0.0\r\n');
      this.printPrompt();
      return;
    }

    if (subcommand === 'init') {
      this.runtime!.npmInit().then(
        () => { this.term.write('\x1b[32mCreated package.json\x1b[0m\r\n'); this.printPrompt(); },
        (err) => { this.printRuntimeError(err); },
      );
      return;
    }

    if (subcommand === 'install' || subcommand === 'i') {
      const packages = args.slice(1);
      this.term.write(`\x1b[33mInstalling packages...\x1b[0m\r\n`);
      this.runtime!.npmInstall(packages).then(
        () => { this.term.write(`\x1b[32mInstalled successfully\x1b[0m\r\n`); this.printPrompt(); },
        (err) => { this.term.write(`\x1b[31mnpm ERR! ${err.message || err}\x1b[0m\r\n`); this.printPrompt(); },
      );
      return;
    }

    this.term.write(`Usage: npm install [pkg], npm init, npm --version\r\n`);
    this.printPrompt();
  }

  private cmdNpx(args: string[]): void {
    if (!this.requireRuntime('npx')) return;

    if (args.length === 0) {
      this.term.write('Usage: npx <package>\r\n');
      this.printPrompt();
      return;
    }

    const binName = args[0];
    const binPath = this.fs.resolve(`node_modules/.bin/${binName}`);
    const code = this.fs.readFile(binPath);

    if (code === null) {
      this.term.write(`\x1b[31m${binName}: not found in node_modules/.bin/\x1b[0m\r\n`);
      this.printPrompt();
      return;
    }

    this.runtime!.evaluate(code).then(
      (result) => { this.printEvalResult(result); },
      (err) => { this.printRuntimeError(err); },
    );
  }

  private printEvalResult(result: { stdout: string; stderr: string; exitCode: number }): void {
    if (result.stdout) {
      const lines = result.stdout.split('\n');
      for (const line of lines) this.term.write(line + '\r\n');
    }
    if (result.stderr) {
      const lines = result.stderr.split('\n');
      for (const line of lines) this.term.write(`\x1b[31m${line}\x1b[0m\r\n`);
    }
    if (result.exitCode !== 0) {
      this.term.write(`\x1b[31mProcess exited with code ${result.exitCode}\x1b[0m\r\n`);
    }
    this.printPrompt();
  }
}
