/**
 * Terminal-based AI chat mode (Claude Code-style).
 * User types `ruwt` in shell to enter this mode.
 */
import type { Terminal } from '@xterm/xterm';
import type { VirtualFileSystem } from './VirtualFileSystem';

interface RuwtTUIOptions {
  term: Terminal;
  fs: VirtualFileSystem;
  language: string;
  challengeTitle: string;
  challengeDescription: string;
  streamChat: (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    callbacks: {
      onChunk: (content: string) => void;
      onDone: (fullContent: string) => void;
      onError: (error: string) => void;
      onConstraint?: (violation: string, message: string) => void;
    }
  ) => Promise<void>;
  abort: () => void;
  onExit: () => void;
  onCodeApplied: (code: string) => void;
  isExpired: () => boolean;
}

export class RuwtTUI {
  private term: Terminal;
  private fs: VirtualFileSystem;
  private language: string;
  private challengeTitle: string;
  private challengeDescription: string;
  private streamChat: RuwtTUIOptions['streamChat'];
  private abortFn: () => void;
  private onExit: () => void;
  private onCodeApplied: (code: string) => void;
  private isExpired: () => boolean;

  private line = '';
  private cursorPos = 0;
  private isStreaming = false;
  private static readonly MAX_HISTORY = 50;
  private history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  private pruneHistory(): void {
    if (this.history.length > RuwtTUI.MAX_HISTORY) {
      this.history = this.history.slice(-RuwtTUI.MAX_HISTORY);
    }
  }

  constructor(options: RuwtTUIOptions) {
    this.term = options.term;
    this.fs = options.fs;
    this.language = options.language;
    this.challengeTitle = options.challengeTitle;
    this.challengeDescription = options.challengeDescription;
    this.streamChat = options.streamChat;
    this.abortFn = options.abort;
    this.onExit = options.onExit;
    this.onCodeApplied = options.onCodeApplied;
    this.isExpired = options.isExpired;
  }

  enter(): void {
    this.term.write('\r\n');
    this.term.write('\x1b[1;33m  ruwt\x1b[0m \x1b[90m\u2014 AI coding assistant\x1b[0m\r\n');
    this.term.write('\x1b[90m  Type your question, or \x1b[33mexit\x1b[90m to return to shell.\x1b[0m\r\n');
    this.term.write('\x1b[90m  Ctrl+C to interrupt a response.\x1b[0m\r\n');
    this.printPrompt();
  }

  private printPrompt(): void {
    this.term.write(`\r\n\x1b[33mruwt>\x1b[0m `);
  }

  handleInput(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      // ESC sequences — arrow keys
      if (ch === '\x1b' && data[i + 1] === '[') {
        const arrow = data[i + 2];
        if (arrow === 'C' && this.cursorPos < this.line.length) {
          this.cursorPos++;
          this.term.write('\x1b[C');
        }
        if (arrow === 'D' && this.cursorPos > 0) {
          this.cursorPos--;
          this.term.write('\x1b[D');
        }
        i += 2;
        continue;
      }

      // Ctrl+C
      if (code === 3) {
        if (this.isStreaming) {
          this.abortFn();
          this.isStreaming = false;
          this.term.write('\r\n\x1b[33m[interrupted]\x1b[0m');
          this.printPrompt();
        } else {
          this.term.write('^C');
          this.line = '';
          this.cursorPos = 0;
          this.onExit();
        }
        continue;
      }

      // Ignore input while streaming
      if (this.isStreaming) continue;

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
        const text = this.line.trim();
        this.line = '';
        this.cursorPos = 0;

        if (!text) {
          this.printPrompt();
          continue;
        }

        if (text === 'exit' || text === 'quit') {
          this.onExit();
          continue;
        }

        this.sendMessage(text);
        continue;
      }

      // Tab — ignore
      if (code === 9) continue;

      // Printable
      if (code >= 32) {
        this.line = this.line.slice(0, this.cursorPos) + ch + this.line.slice(this.cursorPos);
        this.cursorPos++;
        this.redrawLine();
      }
    }
  }

  abort(): void {
    if (this.isStreaming) {
      this.abortFn();
      this.isStreaming = false;
      this.term.write('\r\n\x1b[33m[interrupted]\x1b[0m');
      this.printPrompt();
    }
  }

  private redrawLine(): void {
    this.term.write(`\r\x1b[33mruwt>\x1b[0m ${this.line}\x1b[K`);
    const moveBack = this.line.length - this.cursorPos;
    if (moveBack > 0) {
      this.term.write(`\x1b[${moveBack}D`);
    }
  }

  private buildSystemPrompt(): string {
    const currentCode = this.fs.getSolutionCode();
    return `You are a coding agent in a terminal. Write code, not explanations.

Challenge: "${this.challengeTitle}" (${this.language})

${this.challengeDescription}

Current code:
\`\`\`${this.language}
${currentCode}
\`\`\`

Rules:
- Output the COMPLETE file in a single fenced code block. No partial snippets.
- 1-2 sentences max. No step-by-step explanations, no complexity analysis.
- If asked to solve, just write the solution.
- If debugging, state the bug in one line, then provide fixed code.
- Plain text only (terminal output).`;
  }

  private async sendMessage(text: string): Promise<void> {
    if (this.isExpired()) {
      this.term.write('\x1b[31mTime expired \u2014 AI requests disabled.\x1b[0m');
      this.printPrompt();
      return;
    }

    this.isStreaming = true;
    this.history.push({ role: 'user', content: text });
    this.pruneHistory();

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: this.buildSystemPrompt() },
      ...this.history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    this.term.write('\r\n');
    let lastChunkLen = 0;

    await this.streamChat(messages, {
      onChunk: (fullContent: string) => {
        // Write only the new portion
        const newPart = fullContent.slice(lastChunkLen);
        lastChunkLen = fullContent.length;
        // Convert \n to \r\n for terminal
        const termText = newPart.replace(/\n/g, '\r\n');
        this.term.write(termText);
      },
      onDone: (fullContent: string) => {
        this.isStreaming = false;
        this.history.push({ role: 'assistant', content: fullContent });
        this.pruneHistory();

        // Extract and apply code blocks
        const codeBlock = this.extractCodeBlock(fullContent);
        if (codeBlock) {
          this.fs.setSolutionCode(codeBlock);
          this.onCodeApplied(codeBlock);
          this.term.write('\r\n\r\n\x1b[32m\u2713 Applied to editor\x1b[0m');
        }

        this.printPrompt();
      },
      onError: (error: string) => {
        this.isStreaming = false;
        this.term.write(`\r\n\x1b[31mError: ${error}\x1b[0m`);
        this.printPrompt();
      },
      onConstraint: (violation: string, message: string) => {
        this.isStreaming = false;
        this.term.write(`\r\n\x1b[31m${message}\x1b[0m`);
        if (violation === 'time') {
          this.term.write('\r\n\x1b[90mReturning to shell...\x1b[0m');
          this.onExit();
        } else {
          this.printPrompt();
        }
      },
    });
  }

  private extractCodeBlock(text: string): string | null {
    // Match fenced code blocks, prefer ones matching the challenge language
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let lastMatch: string | null = null;
    let lastLangMatch: string | null = null;

    while ((match = regex.exec(text)) !== null) {
      const lang = match[1].toLowerCase();
      const code = match[2];
      lastMatch = code;
      // Prefer blocks matching the challenge language
      if (lang === this.language || lang === '') {
        lastLangMatch = code;
      }
    }

    return lastLangMatch ?? lastMatch;
  }
}
