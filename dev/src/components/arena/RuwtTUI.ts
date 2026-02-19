/**
 * Terminal-based AI chat mode (Claude Code-style).
 * User types `ruwt` in shell to enter this mode.
 * Supports modes: /agent /plan /debug /ask
 */
import type { Terminal } from '@xterm/xterm';
import type { VirtualFileSystem } from './VirtualFileSystem';
import { buildSystemPrompt, formatTestResultsForMessage, type AIMode, type TestResults } from '../../lib/ai/system-prompts';
import { parseEditBlocks, applyEditBlocks, hasEditBlocks } from '../../lib/ai/diff-apply';
import { hasToolCalls, stripToolCalls } from '../../lib/ai/tool-parser';

interface RuwtTUIOptions {
  term: Terminal;
  fs: VirtualFileSystem;
  language: string;
  challengeTitle: string;
  challengeDescription: string;
  challengeDifficulty: string;
  challengeCategory: string | null;
  challengeTestCases: string;
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
  onRunTests?: (code: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number; results?: unknown[] }>;
  isExpired: () => boolean;
}

const MODE_COLORS: Record<AIMode, string> = {
  agent: '33',  // yellow/gold
  plan: '34',   // blue
  debug: '31',  // red
  ask: '32',    // green
};

export class RuwtTUI {
  private term: Terminal;
  private fs: VirtualFileSystem;
  private language: string;
  private challengeTitle: string;
  private challengeDescription: string;
  private challengeDifficulty: string;
  private challengeCategory: string | null;
  private challengeTestCases: string;
  private streamChat: RuwtTUIOptions['streamChat'];
  private abortFn: () => void;
  private onExit: () => void;
  private onCodeApplied: (code: string) => void;
  private onRunTests?: RuwtTUIOptions['onRunTests'];
  private isExpired: () => boolean;

  private line = '';
  private cursorPos = 0;
  private isStreaming = false;
  private mode: AIMode = 'agent';
  private lastTestResults: TestResults | null = null;
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
    this.challengeDifficulty = options.challengeDifficulty;
    this.challengeCategory = options.challengeCategory;
    this.challengeTestCases = options.challengeTestCases;
    this.streamChat = options.streamChat;
    this.abortFn = options.abort;
    this.onExit = options.onExit;
    this.onCodeApplied = options.onCodeApplied;
    this.onRunTests = options.onRunTests;
    this.isExpired = options.isExpired;
  }

  enter(): void {
    this.term.write('\r\n');
    this.term.write('\x1b[1;33m  ruwt\x1b[0m \x1b[90m\u2014 AI coding assistant\x1b[0m\r\n');
    this.term.write('\x1b[90m  Type your question, or \x1b[33mexit\x1b[90m to return to shell.\x1b[0m\r\n');
    this.term.write('\x1b[90m  Modes: \x1b[33m/agent\x1b[90m \x1b[34m/plan\x1b[90m \x1b[31m/debug\x1b[90m \x1b[32m/ask\x1b[90m\x1b[0m\r\n');
    this.term.write('\x1b[90m  Ctrl+C to interrupt a response.\x1b[0m\r\n');
    this.printPrompt();
  }

  private printPrompt(): void {
    const c = MODE_COLORS[this.mode];
    this.term.write(`\r\n\x1b[${c}mruwt[${this.mode}]>\x1b[0m `);
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

        // Mode switching commands
        if (text.startsWith('/')) {
          const cmd = text.slice(1).toLowerCase();
          if (['agent', 'plan', 'debug', 'ask'].includes(cmd)) {
            this.mode = cmd as AIMode;
            const c = MODE_COLORS[this.mode];
            this.term.write(`\x1b[${c}m[mode: ${this.mode}]\x1b[0m`);
            this.printPrompt();
            continue;
          }
          if (cmd === 'mode') {
            const c = MODE_COLORS[this.mode];
            this.term.write(`\x1b[${c}mCurrent mode: ${this.mode}\x1b[0m`);
            this.printPrompt();
            continue;
          }
          this.term.write(`\x1b[31mUnknown command: ${text}\x1b[0m`);
          this.printPrompt();
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
    const c = MODE_COLORS[this.mode];
    this.term.write(`\r\x1b[${c}mruwt[${this.mode}]>\x1b[0m ${this.line}\x1b[K`);
    const moveBack = this.line.length - this.cursorPos;
    if (moveBack > 0) {
      this.term.write(`\x1b[${moveBack}D`);
    }
  }

  private buildModeSystemPrompt(): string {
    return buildSystemPrompt({
      mode: this.mode,
      challengeTitle: this.challengeTitle,
      challengeDescription: this.challengeDescription,
      challengeDifficulty: this.challengeDifficulty,
      challengeCategory: this.challengeCategory,
      language: this.language,
      currentCode: this.fs.getSolutionCode(),
      testCases: this.challengeTestCases,
      lastTestResults: this.lastTestResults,
    });
  }

  private applyCodeFromResponse(responseText: string): void {
    // Skip in ask mode
    if (this.mode === 'ask') return;

    // Try SEARCH/REPLACE blocks first
    if (hasEditBlocks(responseText)) {
      const blocks = parseEditBlocks(responseText);
      if (blocks.length > 0) {
        const currentCode = this.fs.getSolutionCode();
        const result = applyEditBlocks(currentCode, blocks);
        if (result.applied > 0) {
          this.fs.setSolutionCode(result.newCode);
          this.onCodeApplied(result.newCode);
          const msg = result.failed > 0
            ? `${result.applied} edit(s) applied, ${result.failed} failed`
            : `${result.applied} edit(s) applied`;
          this.term.write(`\r\n\r\n\x1b[32m\u2713 ${msg}\x1b[0m`);
          return;
        }
      }
    }

    // Fallback: extract largest code block
    const codeBlock = this.extractCodeBlock(responseText);
    if (codeBlock) {
      this.fs.setSolutionCode(codeBlock);
      this.onCodeApplied(codeBlock);
      this.term.write('\r\n\r\n\x1b[32m\u2713 Applied to editor\x1b[0m');
    }
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
      { role: 'system', content: this.buildModeSystemPrompt() },
      ...this.history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    this.term.write('\r\n');
    let lastChunkLen = 0;
    let toolLoopCount = 0;
    const MAX_TOOL_LOOPS = 3;

    const runOneRound = async (msgs: typeof messages): Promise<string | null> => {
      lastChunkLen = 0;
      return new Promise((resolve) => {
        this.streamChat(msgs, {
          onChunk: (fullContent: string) => {
            const cleaned = stripToolCalls(fullContent);
            const newPart = cleaned.slice(lastChunkLen);
            lastChunkLen = cleaned.length;
            const termText = newPart.replace(/\n/g, '\r\n');
            this.term.write(termText);
          },
          onDone: (fullContent: string) => {
            this.isStreaming = false;
            const cleaned = stripToolCalls(fullContent);
            this.history.push({ role: 'assistant', content: cleaned });
            this.pruneHistory();
            this.applyCodeFromResponse(fullContent);
            resolve(fullContent);
          },
          onError: (error: string) => {
            this.isStreaming = false;
            this.term.write(`\r\n\x1b[31mError: ${error}\x1b[0m`);
            resolve(null);
          },
          onConstraint: (violation: string, message: string) => {
            this.isStreaming = false;
            this.term.write(`\r\n\x1b[31m${message}\x1b[0m`);
            if (violation === 'time') {
              this.term.write('\r\n\x1b[90mReturning to shell...\x1b[0m');
              this.onExit();
            }
            resolve(null);
          },
        });
      });
    };

    let aiResponse = await runOneRound(messages);

    // Tool-use loop
    while (
      aiResponse &&
      hasToolCalls(aiResponse) &&
      (this.mode === 'agent' || this.mode === 'debug') &&
      toolLoopCount < MAX_TOOL_LOOPS &&
      this.onRunTests
    ) {
      toolLoopCount++;
      this.term.write('\r\n\r\n\x1b[33m[running tests...]\x1b[0m\r\n');

      try {
        const currentCode = this.fs.getSolutionCode();
        const testResult = await this.onRunTests(currentCode, this.language);
        this.lastTestResults = {
          passed: testResult.passed,
          passedTests: testResult.passedTests,
          totalTests: testResult.totalTests,
          results: (testResult.results || []) as TestResults['results'],
        };

        const resultMsg = formatTestResultsForMessage(this.lastTestResults);
        this.term.write(`\x1b[90m${resultMsg.replace(/\n/g, '\r\n')}\x1b[0m\r\n`);

        this.history.push({ role: 'user', content: resultMsg });
        this.pruneHistory();

        this.isStreaming = true;
        const followUpMessages: typeof messages = [
          { role: 'system', content: this.buildModeSystemPrompt() },
          ...this.history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ];
        aiResponse = await runOneRound(followUpMessages);
      } catch {
        this.term.write('\r\n\x1b[31mTest execution failed\x1b[0m');
        break;
      }
    }

    if (!this.isStreaming) {
      this.printPrompt();
    }
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
