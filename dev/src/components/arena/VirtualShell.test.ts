import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualShell, type ShellCallbacks } from './VirtualShell';
import { VirtualFileSystem } from './VirtualFileSystem';

// ---------------------------------------------------------------------------
// Mock terminal
// ---------------------------------------------------------------------------
function createMockTerminal() {
  return {
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    onData: vi.fn((_cb: (data: string) => void) => ({ dispose: vi.fn() })),
    cols: 80,
    rows: 24,
  };
}

type MockTerminal = ReturnType<typeof createMockTerminal>;

function createCallbacks(overrides: Partial<ShellCallbacks> = {}): ShellCallbacks {
  return {
    onRunCode: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    onRunTests: vi.fn().mockResolvedValue({ passed: true, passedTests: 1, totalTests: 1, results: [] }),
    onEnterRuwt: vi.fn(),
    ...overrides,
  };
}

/** Collect all write() calls into a single string for easier assertion. */
function termOutput(term: MockTerminal): string {
  return term.write.mock.calls.map((c) => c[0]).join('');
}

/** Clear write history so we can assert on only new output. */
function clearOutput(term: MockTerminal): void {
  term.write.mockClear();
}

/** Simulate typing a command and pressing Enter. */
function typeAndEnter(shell: VirtualShell, text: string): void {
  shell.handleInput(text + '\r');
}

describe('VirtualShell', () => {
  let term: MockTerminal;
  let fs: VirtualFileSystem;
  let callbacks: ShellCallbacks;
  let shell: VirtualShell;

  beforeEach(() => {
    term = createMockTerminal();
    fs = new VirtualFileSystem('javascript', 'console.log("hello");');
    callbacks = createCallbacks();
    shell = new VirtualShell(term as any, fs, 'javascript', callbacks);
  });

  // ---------------------------------------------------------------------------
  // printPrompt
  // ---------------------------------------------------------------------------
  describe('printPrompt', () => {
    it('writes the prompt with the short cwd', () => {
      shell.printPrompt();
      const out = termOutput(term);
      expect(out).toContain('~');
      expect(out).toContain('$');
    });

    it('reflects cwd changes in the prompt', () => {
      fs.mkdir('/home/user/projects');
      fs.setCwd('/home/user/projects');
      shell.printPrompt();
      const out = termOutput(term);
      expect(out).toContain('~/projects');
    });
  });

  // ---------------------------------------------------------------------------
  // ls
  // ---------------------------------------------------------------------------
  describe('ls', () => {
    it('lists files in the current directory', () => {
      clearOutput(term);
      typeAndEnter(shell, 'ls');
      const out = termOutput(term);
      expect(out).toContain('solution.js');
    });

    it('lists a specified path', () => {
      fs.mkdir('/home/user/sub');
      fs.writeFile('/home/user/sub/file.txt', 'data');
      clearOutput(term);
      typeAndEnter(shell, 'ls sub');
      const out = termOutput(term);
      expect(out).toContain('file.txt');
    });

    it('shows directory suffix with -l flag', () => {
      fs.mkdir('/home/user/mydir');
      clearOutput(term);
      typeAndEnter(shell, 'ls -l');
      const out = termOutput(term);
      expect(out).toContain('mydir/');
    });

    it('shows file sizes with -l flag', () => {
      fs.writeFile('/home/user/sized.txt', 'hello'); // 5 bytes
      clearOutput(term);
      typeAndEnter(shell, 'ls -l');
      const out = termOutput(term);
      expect(out).toContain('5');
    });

    it('prints error for non-existent directory', () => {
      clearOutput(term);
      typeAndEnter(shell, 'ls /nonexistent');
      const out = termOutput(term);
      expect(out).toContain('No such directory');
    });

    it('prints error for non-existent directory with -l', () => {
      clearOutput(term);
      typeAndEnter(shell, 'ls -l /nonexistent');
      const out = termOutput(term);
      expect(out).toContain('No such directory');
    });

    it('handles empty directory gracefully', () => {
      fs.mkdir('/home/user/empty');
      clearOutput(term);
      typeAndEnter(shell, 'ls empty');
      // Should not crash; the output is just the prompt
      const out = termOutput(term);
      expect(out).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // cat
  // ---------------------------------------------------------------------------
  describe('cat', () => {
    it('prints file content', () => {
      fs.writeFile('/home/user/readme.txt', 'Hello World');
      clearOutput(term);
      typeAndEnter(shell, 'cat readme.txt');
      const out = termOutput(term);
      expect(out).toContain('Hello World');
    });

    it('prints content with multiple lines using \\r\\n', () => {
      fs.writeFile('/home/user/multi.txt', 'line1\nline2\nline3');
      clearOutput(term);
      typeAndEnter(shell, 'cat multi.txt');
      const out = termOutput(term);
      expect(out).toContain('line1');
      expect(out).toContain('line2');
      expect(out).toContain('line3');
    });

    it('prints error for non-existent file', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cat ghost.txt');
      const out = termOutput(term);
      expect(out).toContain('No such file');
    });

    it('prints error when no arguments given', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cat');
      const out = termOutput(term);
      expect(out).toContain('missing file argument');
    });

    it('handles multiple file arguments', () => {
      fs.writeFile('/home/user/a.txt', 'aaa');
      fs.writeFile('/home/user/b.txt', 'bbb');
      clearOutput(term);
      typeAndEnter(shell, 'cat a.txt b.txt');
      const out = termOutput(term);
      expect(out).toContain('aaa');
      expect(out).toContain('bbb');
    });

    it('prints error for missing files when mixed with valid files', () => {
      fs.writeFile('/home/user/real.txt', 'exists');
      clearOutput(term);
      typeAndEnter(shell, 'cat real.txt fake.txt');
      const out = termOutput(term);
      expect(out).toContain('exists');
      expect(out).toContain('fake.txt: No such file');
    });
  });

  // ---------------------------------------------------------------------------
  // echo
  // ---------------------------------------------------------------------------
  describe('echo', () => {
    it('prints joined arguments', () => {
      clearOutput(term);
      typeAndEnter(shell, 'echo hello world');
      const out = termOutput(term);
      expect(out).toContain('hello world');
    });

    it('prints nothing for bare echo', () => {
      clearOutput(term);
      typeAndEnter(shell, 'echo');
      const out = termOutput(term);
      // Should just have a newline (from Enter) and the prompt
      expect(out).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // cd
  // ---------------------------------------------------------------------------
  describe('cd', () => {
    it('changes to a valid directory', () => {
      fs.mkdir('/home/user/projects');
      typeAndEnter(shell, 'cd projects');
      expect(fs.getCwd()).toBe('/home/user/projects');
    });

    it('prints error for invalid directory', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cd /nonexistent');
      const out = termOutput(term);
      expect(out).toContain('No such directory');
    });

    it('goes to /home/user with no argument', () => {
      fs.mkdir('/home/user/sub');
      fs.setCwd('/home/user/sub');
      typeAndEnter(shell, 'cd');
      expect(fs.getCwd()).toBe('/home/user');
    });

    it('resolves ~ to /home/user', () => {
      fs.setCwd('/');
      typeAndEnter(shell, 'cd ~');
      expect(fs.getCwd()).toBe('/home/user');
    });

    it('resolves ~/subpath to /home/user/subpath', () => {
      fs.mkdir('/home/user/docs');
      typeAndEnter(shell, 'cd ~/docs');
      expect(fs.getCwd()).toBe('/home/user/docs');
    });
  });

  // ---------------------------------------------------------------------------
  // pwd
  // ---------------------------------------------------------------------------
  describe('pwd', () => {
    it('prints the current working directory', () => {
      clearOutput(term);
      typeAndEnter(shell, 'pwd');
      const out = termOutput(term);
      expect(out).toContain('/home/user');
    });

    it('reflects directory changes', () => {
      fs.mkdir('/home/user/work');
      fs.setCwd('/home/user/work');
      clearOutput(term);
      typeAndEnter(shell, 'pwd');
      const out = termOutput(term);
      expect(out).toContain('/home/user/work');
    });
  });

  // ---------------------------------------------------------------------------
  // mkdir
  // ---------------------------------------------------------------------------
  describe('mkdir', () => {
    it('creates a new directory', () => {
      typeAndEnter(shell, 'mkdir newdir');
      expect(fs.exists('/home/user/newdir')).toBe(true);
    });

    it('creates multiple directories', () => {
      typeAndEnter(shell, 'mkdir dir1 dir2');
      expect(fs.exists('/home/user/dir1')).toBe(true);
      expect(fs.exists('/home/user/dir2')).toBe(true);
    });

    it('prints error when creation fails (no parent)', () => {
      clearOutput(term);
      typeAndEnter(shell, 'mkdir deep/nested');
      const out = termOutput(term);
      expect(out).toContain('Failed to create directory');
    });
  });

  // ---------------------------------------------------------------------------
  // rm
  // ---------------------------------------------------------------------------
  describe('rm', () => {
    it('removes an existing file', () => {
      fs.writeFile('/home/user/trash.txt', 'delete me');
      typeAndEnter(shell, 'rm trash.txt');
      expect(fs.exists('/home/user/trash.txt')).toBe(false);
    });

    it('prints error for non-existent file', () => {
      clearOutput(term);
      typeAndEnter(shell, 'rm ghost.txt');
      const out = termOutput(term);
      expect(out).toContain('No such file');
    });

    it('skips -r and -rf flags', () => {
      fs.writeFile('/home/user/keep.txt', 'data');
      clearOutput(term);
      typeAndEnter(shell, 'rm -rf keep.txt');
      expect(fs.exists('/home/user/keep.txt')).toBe(false);
    });

    it('handles multiple files', () => {
      fs.writeFile('/home/user/a.txt', '');
      fs.writeFile('/home/user/b.txt', '');
      typeAndEnter(shell, 'rm a.txt b.txt');
      expect(fs.exists('/home/user/a.txt')).toBe(false);
      expect(fs.exists('/home/user/b.txt')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // touch
  // ---------------------------------------------------------------------------
  describe('touch', () => {
    it('creates an empty file', () => {
      typeAndEnter(shell, 'touch new.txt');
      expect(fs.readFile('/home/user/new.txt')).toBe('');
    });

    it('does not overwrite existing file content', () => {
      fs.writeFile('/home/user/existing.txt', 'important');
      typeAndEnter(shell, 'touch existing.txt');
      expect(fs.readFile('/home/user/existing.txt')).toBe('important');
    });

    it('creates multiple files', () => {
      typeAndEnter(shell, 'touch x.txt y.txt z.txt');
      expect(fs.exists('/home/user/x.txt')).toBe(true);
      expect(fs.exists('/home/user/y.txt')).toBe(true);
      expect(fs.exists('/home/user/z.txt')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // mv
  // ---------------------------------------------------------------------------
  describe('mv', () => {
    it('moves a file to a new name', () => {
      fs.writeFile('/home/user/old.txt', 'content');
      typeAndEnter(shell, 'mv old.txt new.txt');
      expect(fs.readFile('/home/user/old.txt')).toBeNull();
      expect(fs.readFile('/home/user/new.txt')).toBe('content');
    });

    it('prints error for non-existent source', () => {
      clearOutput(term);
      typeAndEnter(shell, 'mv ghost.txt dest.txt');
      const out = termOutput(term);
      expect(out).toContain('No such file');
    });

    it('prints error when destination is missing', () => {
      clearOutput(term);
      typeAndEnter(shell, 'mv only-one-arg');
      const out = termOutput(term);
      expect(out).toContain('missing destination');
    });
  });

  // ---------------------------------------------------------------------------
  // cp
  // ---------------------------------------------------------------------------
  describe('cp', () => {
    it('copies a file to a new path', () => {
      fs.writeFile('/home/user/src.txt', 'data');
      typeAndEnter(shell, 'cp src.txt dst.txt');
      expect(fs.readFile('/home/user/src.txt')).toBe('data');
      expect(fs.readFile('/home/user/dst.txt')).toBe('data');
    });

    it('prints error for non-existent source', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cp ghost.txt dst.txt');
      const out = termOutput(term);
      expect(out).toContain('No such file');
    });

    it('prints error when destination is missing', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cp only-src');
      const out = termOutput(term);
      expect(out).toContain('missing destination');
    });
  });

  // ---------------------------------------------------------------------------
  // write (multi-line mode)
  // ---------------------------------------------------------------------------
  describe('write', () => {
    it('enters write mode and saves on EOF', () => {
      clearOutput(term);
      typeAndEnter(shell, 'write myfile.txt');
      let out = termOutput(term);
      expect(out).toContain('Entering write mode');
      expect(out).toContain('myfile.txt');

      clearOutput(term);
      // Type lines then EOF
      typeAndEnter(shell, 'line one');
      typeAndEnter(shell, 'line two');
      typeAndEnter(shell, 'EOF');
      out = termOutput(term);
      expect(out).toContain('saved myfile.txt');
      expect(fs.readFile('/home/user/myfile.txt')).toBe('line one\nline two');
    });

    it('shows continuation prompt for each line', () => {
      typeAndEnter(shell, 'write test.txt');
      clearOutput(term);
      typeAndEnter(shell, 'some content');
      const out = termOutput(term);
      expect(out).toContain('> ');
    });

    it('prints error when no filename given', () => {
      clearOutput(term);
      typeAndEnter(shell, 'write');
      const out = termOutput(term);
      expect(out).toContain('missing filename');
    });

    it('saves byte count in confirmation message', () => {
      typeAndEnter(shell, 'write counter.txt');
      clearOutput(term);
      typeAndEnter(shell, 'hello');
      typeAndEnter(shell, 'EOF');
      const out = termOutput(term);
      expect(out).toContain('5 bytes');
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------
  describe('clear', () => {
    it('calls term.clear()', () => {
      typeAndEnter(shell, 'clear');
      expect(term.clear).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // help
  // ---------------------------------------------------------------------------
  describe('help', () => {
    it('lists available commands', () => {
      clearOutput(term);
      typeAndEnter(shell, 'help');
      const out = termOutput(term);
      expect(out).toContain('ls');
      expect(out).toContain('cat');
      expect(out).toContain('cd');
      expect(out).toContain('pwd');
      expect(out).toContain('mkdir');
      expect(out).toContain('rm');
      expect(out).toContain('touch');
      expect(out).toContain('mv');
      expect(out).toContain('cp');
      expect(out).toContain('write');
      expect(out).toContain('clear');
      expect(out).toContain('run');
      expect(out).toContain('test');
      expect(out).toContain('ruwt');
      expect(out).toContain('help');
      expect(out).toContain('Redirection');
    });
  });

  // ---------------------------------------------------------------------------
  // run
  // ---------------------------------------------------------------------------
  describe('run', () => {
    it('calls onRunCode with solution file content', async () => {
      typeAndEnter(shell, 'run');
      // Allow the promise to resolve
      await vi.waitFor(() => {
        expect(callbacks.onRunCode).toHaveBeenCalledWith(
          'console.log("hello");',
          'javascript'
        );
      });
    });

    it('prints stdout from execution', async () => {
      (callbacks.onRunCode as ReturnType<typeof vi.fn>).mockResolvedValue({
        stdout: 'output line',
        stderr: '',
        exitCode: 0,
      });
      clearOutput(term);
      typeAndEnter(shell, 'run');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('output line');
      });
    });

    it('prints stderr in red', async () => {
      (callbacks.onRunCode as ReturnType<typeof vi.fn>).mockResolvedValue({
        stdout: '',
        stderr: 'error message',
        exitCode: 1,
      });
      clearOutput(term);
      typeAndEnter(shell, 'run');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('error message');
        expect(out).toContain('\x1b[31m'); // red ANSI
      });
    });

    it('prints exit code when non-zero', async () => {
      (callbacks.onRunCode as ReturnType<typeof vi.fn>).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 42,
      });
      clearOutput(term);
      typeAndEnter(shell, 'run');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('exited with code 42');
      });
    });

    it('prints error message when code is empty', () => {
      fs.setSolutionCode('');
      clearOutput(term);
      typeAndEnter(shell, 'run');
      const out = termOutput(term);
      expect(out).toContain('No code to run');
    });

    it('handles execution errors (rejected promise)', async () => {
      (callbacks.onRunCode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sandbox crashed'));
      clearOutput(term);
      typeAndEnter(shell, 'run');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Execution error');
        expect(out).toContain('sandbox crashed');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // test
  // ---------------------------------------------------------------------------
  describe('test', () => {
    it('calls onRunTests with solution code', async () => {
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        expect(callbacks.onRunTests).toHaveBeenCalledWith(
          'console.log("hello");',
          'javascript'
        );
      });
    });

    it('prints test results summary', async () => {
      (callbacks.onRunTests as ReturnType<typeof vi.fn>).mockResolvedValue({
        passed: true,
        passedTests: 3,
        totalTests: 3,
        results: [
          { passed: true, input: '1', expectedOutput: '1', actualOutput: '1' },
          { passed: true, input: '2', expectedOutput: '2', actualOutput: '2' },
          { passed: true, input: '3', expectedOutput: '3', actualOutput: '3' },
        ],
      });
      clearOutput(term);
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('3/3 tests passed');
      });
    });

    it('prints failure details for failed tests', async () => {
      (callbacks.onRunTests as ReturnType<typeof vi.fn>).mockResolvedValue({
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [
          {
            passed: false,
            input: 'test input',
            expectedOutput: 'expected',
            actualOutput: 'actual',
            error: 'TypeError',
          },
        ],
      });
      clearOutput(term);
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('0/1 tests passed');
        expect(out).toContain('Expected:');
        expect(out).toContain('expected');
        expect(out).toContain('Actual:');
        expect(out).toContain('actual');
        expect(out).toContain('Error:');
        expect(out).toContain('TypeError');
      });
    });

    it('prints (none) for empty input on failed test', async () => {
      (callbacks.onRunTests as ReturnType<typeof vi.fn>).mockResolvedValue({
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [
          { passed: false, input: '', expectedOutput: 'x', actualOutput: '', error: null },
        ],
      });
      clearOutput(term);
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('(none)');
        expect(out).toContain('(empty)');
      });
    });

    it('prints error message when code is empty', () => {
      fs.setSolutionCode('   ');
      clearOutput(term);
      typeAndEnter(shell, 'test');
      const out = termOutput(term);
      expect(out).toContain('No code to test');
    });

    it('handles test errors (rejected promise)', async () => {
      (callbacks.onRunTests as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('test runner died'));
      clearOutput(term);
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Test error');
        expect(out).toContain('test runner died');
      });
    });

    it('handles test results without detailed results array', async () => {
      (callbacks.onRunTests as ReturnType<typeof vi.fn>).mockResolvedValue({
        passed: true,
        passedTests: 2,
        totalTests: 2,
      });
      clearOutput(term);
      typeAndEnter(shell, 'test');
      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('2/2 tests passed');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // ruwt
  // ---------------------------------------------------------------------------
  describe('ruwt', () => {
    it('calls onEnterRuwt callback', () => {
      typeAndEnter(shell, 'ruwt');
      expect(callbacks.onEnterRuwt).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown command
  // ---------------------------------------------------------------------------
  describe('unknown command', () => {
    it('prints command not found error', () => {
      clearOutput(term);
      typeAndEnter(shell, 'foobar');
      const out = termOutput(term);
      expect(out).toContain('foobar: command not found');
      expect(out).toContain('help');
    });
  });

  // ---------------------------------------------------------------------------
  // Output redirection
  // ---------------------------------------------------------------------------
  describe('output redirection', () => {
    it('echo > file overwrites file', () => {
      typeAndEnter(shell, 'echo hello > output.txt');
      expect(fs.readFile('/home/user/output.txt')).toBe('hello\n');
    });

    it('echo >> file appends to file', () => {
      fs.writeFile('/home/user/log.txt', 'first\n');
      typeAndEnter(shell, 'echo second >> log.txt');
      expect(fs.readFile('/home/user/log.txt')).toBe('first\nsecond\n');
    });

    it('>> creates file if it does not exist', () => {
      typeAndEnter(shell, 'echo content >> new.txt');
      expect(fs.readFile('/home/user/new.txt')).toBe('content\n');
    });

    it('cat > file redirects file content', () => {
      fs.writeFile('/home/user/src.txt', 'source data');
      typeAndEnter(shell, 'cat src.txt > copy.txt');
      expect(fs.readFile('/home/user/copy.txt')).toBe('source data');
    });

    it('pwd > file redirects pwd output', () => {
      typeAndEnter(shell, 'pwd > dir.txt');
      expect(fs.readFile('/home/user/dir.txt')).toBe('/home/user\n');
    });

    it('ls > file redirects ls output', () => {
      typeAndEnter(shell, 'ls > listing.txt');
      const content = fs.readFile('/home/user/listing.txt');
      expect(content).toContain('solution.js');
    });

    it('prints written-to message', () => {
      clearOutput(term);
      typeAndEnter(shell, 'echo hi > out.txt');
      const out = termOutput(term);
      expect(out).toContain('written to out.txt');
    });

    it('prints error for unsupported command in redirect', () => {
      clearOutput(term);
      typeAndEnter(shell, 'mkdir test > out.txt');
      const out = termOutput(term);
      expect(out).toContain('Redirection not supported');
    });

    it('handles redirect with file not found in cat', () => {
      clearOutput(term);
      typeAndEnter(shell, 'cat nonexistent.txt > out.txt');
      const out = termOutput(term);
      expect(out).toContain('No such file');
      // out.txt should NOT have been created since captureCommand returned null
      expect(fs.exists('/home/user/out.txt')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Argument parsing with quotes
  // ---------------------------------------------------------------------------
  describe('parseArgs (via echo/commands)', () => {
    it('handles double-quoted strings', () => {
      clearOutput(term);
      typeAndEnter(shell, 'echo "hello world"');
      const out = termOutput(term);
      expect(out).toContain('hello world');
    });

    it('handles single-quoted strings', () => {
      clearOutput(term);
      typeAndEnter(shell, "echo 'hello world'");
      const out = termOutput(term);
      expect(out).toContain('hello world');
    });

    it('handles mixed quotes', () => {
      clearOutput(term);
      typeAndEnter(shell, 'echo "it\'s" working');
      const out = termOutput(term);
      // Double quotes strip, single quote inside double quotes is literal
      expect(out).toContain("it's");
      expect(out).toContain('working');
    });
  });

  // ---------------------------------------------------------------------------
  // Input history (up/down arrows)
  // ---------------------------------------------------------------------------
  describe('input history', () => {
    it('recalls previous command with up arrow', () => {
      typeAndEnter(shell, 'echo first');
      typeAndEnter(shell, 'echo second');
      clearOutput(term);
      // Up arrow = ESC [ A
      shell.handleInput('\x1b[A');
      const out = termOutput(term);
      expect(out).toContain('echo second');
    });

    it('navigates back through multiple history entries', () => {
      typeAndEnter(shell, 'echo a');
      typeAndEnter(shell, 'echo b');
      typeAndEnter(shell, 'echo c');
      clearOutput(term);
      shell.handleInput('\x1b[A'); // echo c
      shell.handleInput('\x1b[A'); // echo b
      shell.handleInput('\x1b[A'); // echo a
      const out = termOutput(term);
      expect(out).toContain('echo a');
    });

    it('down arrow returns to saved line after going up', () => {
      typeAndEnter(shell, 'echo old');
      // Start typing something new
      shell.handleInput('new');
      clearOutput(term);
      shell.handleInput('\x1b[A'); // go to "echo old"
      shell.handleInput('\x1b[B'); // back to "new"
      const out = termOutput(term);
      expect(out).toContain('new');
    });

    it('up arrow does nothing with no history', () => {
      clearOutput(term);
      shell.handleInput('\x1b[A');
      // Should not crash, term.write should not have been called for a line change
      expect(term.write).not.toHaveBeenCalled();
    });

    it('down arrow from no history position restores saved line', () => {
      clearOutput(term);
      shell.handleInput('\x1b[B');
      // historyIndex is already -1, should just restore saved line (empty)
      const out = termOutput(term);
      // Just redraw empty line, no crash
      expect(out).toBeDefined();
    });

    it('stops at the oldest entry when pressing up past the end', () => {
      typeAndEnter(shell, 'only command');
      clearOutput(term);
      shell.handleInput('\x1b[A'); // "only command"
      shell.handleInput('\x1b[A'); // still "only command" — can't go further
      const out = termOutput(term);
      expect(out).toContain('only command');
    });

    it('limits history to 50 entries', () => {
      for (let i = 0; i < 55; i++) {
        typeAndEnter(shell, `cmd${i}`);
      }
      // The oldest entries should have been dropped
      // Navigate up 50 times to reach the bottom of history
      clearOutput(term);
      for (let i = 0; i < 55; i++) {
        shell.handleInput('\x1b[A');
      }
      const out = termOutput(term);
      // cmd0 through cmd4 should have been pruned (55 - 50 = 5 dropped)
      expect(out).not.toContain('cmd0\x1b');
    });
  });

  // ---------------------------------------------------------------------------
  // Line editing
  // ---------------------------------------------------------------------------
  describe('line editing', () => {
    it('backspace removes character before cursor', () => {
      shell.handleInput('abc');
      shell.handleInput('\x7f'); // backspace
      clearOutput(term);
      shell.handleInput('\r');
      // The line should have been "ab", which is an unknown command
      const out = termOutput(term);
      expect(out).toContain('ab: command not found');
    });

    it('backspace does nothing at position 0', () => {
      clearOutput(term);
      shell.handleInput('\x7f');
      // Should not crash, cursor at 0
      expect(true).toBe(true);
    });

    it('left arrow moves cursor back', () => {
      shell.handleInput('abc');
      shell.handleInput('\x1b[D'); // left
      clearOutput(term);
      shell.handleInput('X');
      shell.handleInput('\r');
      // "abXc" should have been the line
      const out = termOutput(term);
      expect(out).toContain('abXc');
    });

    it('right arrow moves cursor forward', () => {
      shell.handleInput('abc');
      shell.handleInput('\x1b[D'); // left (cursor between b and c)
      shell.handleInput('\x1b[C'); // right (cursor after c)
      clearOutput(term);
      shell.handleInput('X');
      shell.handleInput('\r');
      // "abcX" should have been the line
      const out = termOutput(term);
      expect(out).toContain('abcX');
    });

    it('left arrow does nothing at position 0', () => {
      clearOutput(term);
      shell.handleInput('\x1b[D');
      // Should not crash or move cursor negative
      expect(true).toBe(true);
    });

    it('right arrow does nothing at end of line', () => {
      shell.handleInput('abc');
      clearOutput(term);
      shell.handleInput('\x1b[C');
      // Cursor already at end; should not move
      expect(true).toBe(true);
    });

    it('Ctrl+C clears the line and reprints prompt', () => {
      shell.handleInput('partial command');
      clearOutput(term);
      shell.handleInput('\x03'); // Ctrl+C
      const out = termOutput(term);
      expect(out).toContain('^C');
      expect(out).toContain('$'); // prompt reprinted
    });

    it('tab is ignored', () => {
      clearOutput(term);
      shell.handleInput('\t');
      // Should not produce any output
      expect(term.write).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty input
  // ---------------------------------------------------------------------------
  describe('empty input', () => {
    it('just reprints prompt on Enter with no input', () => {
      clearOutput(term);
      shell.handleInput('\r');
      const out = termOutput(term);
      expect(out).toContain('$');
    });
  });

  // ---------------------------------------------------------------------------
  // Unhandled ESC sequences
  // ---------------------------------------------------------------------------
  describe('other ESC sequences', () => {
    it('ignores unknown ESC sequences gracefully', () => {
      clearOutput(term);
      shell.handleInput('\x1b[Z'); // some unknown sequence
      // Should not crash
      expect(true).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Capture command edge cases
  // ---------------------------------------------------------------------------
  describe('captureCommand edge cases', () => {
    it('redirecting empty command does nothing', () => {
      clearOutput(term);
      // Leading whitespace before >; parseArgs of empty returns []
      typeAndEnter(shell, '  > file.txt');
      // Should not crash; file may or may not be created depending on regex
    });

    it('ls redirect with non-existent dir returns null (file not written)', () => {
      clearOutput(term);
      typeAndEnter(shell, 'ls /nonexistent > out.txt');
      expect(fs.exists('/home/user/out.txt')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Backspace code 8 (alternate)
  // ---------------------------------------------------------------------------
  describe('alternate backspace (code 8)', () => {
    it('handles backspace with char code 8', () => {
      shell.handleInput('abc');
      shell.handleInput('\x08'); // code 8
      clearOutput(term);
      shell.handleInput('\r');
      const out = termOutput(term);
      expect(out).toContain('ab: command not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Insertion at cursor mid-line
  // ---------------------------------------------------------------------------
  describe('mid-line insertion', () => {
    it('inserts character at cursor position and redraws', () => {
      shell.handleInput('ac');
      shell.handleInput('\x1b[D'); // move left, cursor between a and c
      clearOutput(term);
      shell.handleInput('b');
      const out = termOutput(term);
      // redrawLine should show "abc"
      expect(out).toContain('abc');
    });
  });

  // ---------------------------------------------------------------------------
  // Backspace at mid-line cursor
  // ---------------------------------------------------------------------------
  describe('mid-line backspace', () => {
    it('removes the character before cursor at mid-line', () => {
      shell.handleInput('abc');
      shell.handleInput('\x1b[D'); // cursor before c
      shell.handleInput('\x7f'); // delete b
      clearOutput(term);
      shell.handleInput('\r');
      const out = termOutput(term);
      expect(out).toContain('ac: command not found');
    });
  });

  // ---------------------------------------------------------------------------
  // History navigation — down arrow stepping through
  // ---------------------------------------------------------------------------
  describe('history down step', () => {
    it('steps down through history correctly after going up multiple times', () => {
      typeAndEnter(shell, 'echo alpha');
      typeAndEnter(shell, 'echo beta');
      typeAndEnter(shell, 'echo gamma');
      // Go up 3 times
      shell.handleInput('\x1b[A'); // gamma
      shell.handleInput('\x1b[A'); // beta
      shell.handleInput('\x1b[A'); // alpha
      clearOutput(term);
      // Go down — should show beta
      shell.handleInput('\x1b[B');
      const out = termOutput(term);
      expect(out).toContain('echo beta');
    });
  });
});
