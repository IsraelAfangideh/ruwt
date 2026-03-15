/**
 * Terminal-based AI chat mode (Claude Code-style).
 * User types `ruwt` in shell to enter this mode.
 * Supports modes: /agent /plan /debug /ask
 */
import type { Terminal } from '@xterm/xterm';
import type { VirtualFileSystem } from './VirtualFileSystem';
import { buildSystemPrompt, formatTestResultsForMessage, type AIMode, type TestResults } from './lib/system-prompts';
import { hasToolCalls, stripToolCalls } from './lib/tool-parser';
import { applyCodeFromResponse as sharedApplyCode, extractFileEdits } from './lib/code-apply';
import { callApplyModel } from './lib/apply-model';
import { computeLineDiff } from './lib/line-diff';
import { getModelsForTier, getModelById, tierLabel, TIER_ORDER, type ModelTier } from '../../shared/lib/ai/pricing';

type TextSegment = { type: 'text'; content: string };
type PasteSegment = { type: 'paste'; content: string; num: number; lines: number; preview: string; charCount: number };
type InputSegment = TextSegment | PasteSegment;

interface RuwtTUIOptions {
  term: Terminal;
  fs: VirtualFileSystem;
  language: string;
  attemptId: string;
  challengeTitle: string;
  challengeDescription: string;
  challengeDifficulty: string;
  challengeCategory: string | null;
  challengeTestCases: string;
  hiddenTestCount?: number;
  readonlyPrefix?: string | null;
  useStdin?: boolean;
  streamChat: (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    callbacks: {
      onChunk: (content: string) => void;
      onThinking?: (thinkingContent: string) => void;
      onThinkingDone?: () => void;
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
  onModelChange?: (tier: ModelTier, modelId: string) => void;
  getCurrentModelId?: () => string;
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
  private attemptId: string;
  private challengeTitle: string;
  private challengeDescription: string;
  private challengeDifficulty: string;
  private challengeCategory: string | null;
  private challengeTestCases: string;
  private hiddenTestCount?: number;
  private readonlyPrefix?: string | null;
  private useStdin?: boolean;
  private streamChat: RuwtTUIOptions['streamChat'];
  private abortFn: () => void;
  private onExit: () => void;
  private onCodeApplied: (code: string) => void;
  private onRunTests?: RuwtTUIOptions['onRunTests'];
  private isExpired: () => boolean;

  private segments: InputSegment[] = [{ type: 'text', content: '' }];
  private cursorPos = 0;
  private pasteCount = 0;
  private isStreaming = false;
  private mode: AIMode = 'agent';
  private lastTestResults: TestResults | null = null;
  private lastApplyFailedCount = 0;
  private static readonly MAX_HISTORY = 50;
  private static readonly MAX_QUEUE = 5;
  private history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private messageQueue: string[] = [];
  private onModelChange?: (tier: ModelTier, modelId: string) => void;
  private getCurrentModelId: () => string;
  private picker: { tierIdx: number; modelIdx: number; lineCount: number } | null = null;

  private pruneHistory(): void {
    if (this.history.length > RuwtTUI.MAX_HISTORY) {
      this.history = this.history.slice(-RuwtTUI.MAX_HISTORY);
    }
  }

  private resetInput(): void {
    this.segments = [{ type: 'text', content: '' }];
    this.cursorPos = 0;
    this.pasteCount = 0;
  }

  private getFullText(): string {
    return this.segments.map((s) => s.content).join('');
  }

  private lastTextSeg(): TextSegment {
    return this.segments[this.segments.length - 1] as TextSegment;
  }

  private static circledNum(n: number): string {
    /* istanbul ignore next -- @preserve */
    if (n >= 1 && n <= 9) return String.fromCharCode(0x245f + n);
    /* istanbul ignore next -- @preserve */
    return `(${n})`;
  }

  constructor(options: RuwtTUIOptions) {
    this.term = options.term;
    this.fs = options.fs;
    this.language = options.language;
    this.attemptId = options.attemptId;
    this.challengeTitle = options.challengeTitle;
    this.challengeDescription = options.challengeDescription;
    this.challengeDifficulty = options.challengeDifficulty;
    this.challengeCategory = options.challengeCategory;
    this.challengeTestCases = options.challengeTestCases;
    this.hiddenTestCount = options.hiddenTestCount;
    this.readonlyPrefix = options.readonlyPrefix;
    this.useStdin = options.useStdin;
    this.streamChat = options.streamChat;
    this.abortFn = options.abort;
    this.onExit = options.onExit;
    this.onCodeApplied = options.onCodeApplied;
    this.onRunTests = options.onRunTests;
    this.isExpired = options.isExpired;
    this.onModelChange = options.onModelChange;
    this.getCurrentModelId = options.getCurrentModelId ?? (() => '@cf/meta/llama-3.1-8b-instruct');
  }

  enter(): void {
    this.term.write('\r\n');
    this.term.write('\x1b[1;33m  ruwt\x1b[0m \x1b[90m\u2014 AI coding assistant\x1b[0m\r\n');
    this.term.write('\x1b[90m  Type your question, or \x1b[33m/shell\x1b[90m for terminal commands.\x1b[0m\r\n');
    this.term.write('\x1b[90m  Modes: \x1b[33m/agent\x1b[90m \x1b[34m/plan\x1b[90m \x1b[31m/debug\x1b[90m \x1b[32m/ask\x1b[90m  |  \x1b[33m/model\x1b[90m \x1b[33m/clear\x1b[90m \x1b[33m/help\x1b[0m\r\n');
    this.term.write('\x1b[90m  Ctrl+C to interrupt. Type while AI streams to queue.\x1b[0m\r\n');
    this.printPrompt();
  }

  private printPrompt(): void {
    const c = MODE_COLORS[this.mode];
    this.term.write(`\r\n\x1b[${c}mruwt[${this.mode}]>\x1b[0m `);
  }

  handleInput(data: string): void {
    // Multiline paste: detect by \r or \n in data with 2+ actual lines
    // Buffer into segments instead of auto-sending (Claude Code-style)
    if (data.length > 1 && /[\r\n]/.test(data)) {
      const lines = data.split(/[\r\n]+/).filter(l => l.length > 0);
      if (lines.length > 1) {
        const content = lines.join('\n');
        /* istanbul ignore next -- @preserve */
        if (!content.trim()) return;

        this.pasteCount++;
        const preview = lines[0].length > 30 ? lines[0].slice(0, 27) + '...' : lines[0];
        const pasteSeg: PasteSegment = {
          type: 'paste', content, num: this.pasteCount,
          lines: lines.length, preview, charCount: content.length,
        };

        // Split last text segment at cursor, insert paste between halves
        const lastSeg = this.lastTextSeg();
        const before = lastSeg.content.slice(0, this.cursorPos);
        const after = lastSeg.content.slice(this.cursorPos);
        this.segments.pop();
        this.segments.push({ type: 'text', content: before }, pasteSeg, { type: 'text', content: after });
        this.cursorPos = 0;
        if (!this.isStreaming) {
          this.redrawLine();
        }
        return;
      }
      // Single line + Enter — fall through to per-character handler
    }

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      const code = ch.charCodeAt(0);

      // Picker input interception — swallow all keys while picker is open
      if (this.picker) {
        if (ch === '\x1b' && data[i + 1] === '[') {
          const arrow = data[i + 2];
          const models = getModelsForTier(TIER_ORDER[this.picker.tierIdx]);
          if (arrow === 'A') {
            this.picker.modelIdx = (this.picker.modelIdx - 1 + models.length) % models.length;
            this.renderPicker();
          } else if (arrow === 'B') {
            this.picker.modelIdx = (this.picker.modelIdx + 1) % models.length;
            this.renderPicker();
          } else if (arrow === 'C') {
            this.picker.tierIdx = (this.picker.tierIdx + 1) % TIER_ORDER.length;
            this.picker.modelIdx = 0;
            /* istanbul ignore next -- @preserve */
            this.renderPicker();
          } else {
            /* istanbul ignore next -- @preserve */
            if (arrow === 'D') {
              this.picker.tierIdx = (this.picker.tierIdx - 1 + TIER_ORDER.length) % TIER_ORDER.length;
              this.picker.modelIdx = 0;
              this.renderPicker();
            }
          }
          i += 2;
        } else if (code === 9) {
          // Tab → next tier
          this.picker.tierIdx = (this.picker.tierIdx + 1) % TIER_ORDER.length;
          this.picker.modelIdx = 0;
          this.renderPicker();
        } else if (ch === '\r' || ch === '\n') {
          this.closeModelPicker(true);
        } else if (code === 3 || ch === 'q') {
          /* istanbul ignore next -- @preserve */
          this.closeModelPicker(false);
        } else {
          /* istanbul ignore next -- @preserve */
          if (ch === '\x1b') {
            this.closeModelPicker(false);
          }
        }
        continue;
      }

      // ESC sequences — arrow keys (within last text segment only)
      if (ch === '\x1b' && data[i + 1] === '[') {
        const arrow = data[i + 2];
        const lastSeg = this.lastTextSeg();
        if (arrow === 'C' && this.cursorPos < lastSeg.content.length) {
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
          this.messageQueue = [];
          this.resetInput();
          this.term.write('\r\n\x1b[33m[interrupted]\x1b[0m');
          this.printPrompt();
        } else {
          this.term.write('^C');
          this.resetInput();
          this.onExit();
        }
        continue;
      }

      // Buffer input while streaming — queue on Enter
      if (this.isStreaming) {
        if (ch === '\r' || ch === '\n') {
          const queued = this.getFullText().trim();
          /* istanbul ignore next -- @preserve */
          if (queued) {
            if (this.messageQueue.length >= RuwtTUI.MAX_QUEUE) {
              this.term.write(`\r\n\x1b[33m[queue full \u2014 wait for AI to finish]\x1b[0m`);
            } else {
              this.messageQueue.push(queued);
              this.term.write(`\r\n\x1b[90m[queued: ${this.messageQueue.length} message${this.messageQueue.length > 1 ? 's' : ''}]\x1b[0m`);
            }
          }
          /* istanbul ignore next -- @preserve */
          this.resetInput();
        } else {
          /* istanbul ignore next -- @preserve */
          if (code >= 32) {
            const lastSeg = this.lastTextSeg();
            lastSeg.content = lastSeg.content.slice(0, this.cursorPos) + ch + lastSeg.content.slice(this.cursorPos);
            this.cursorPos++;
          }
        }
        continue;
      }

      // Backspace
      if (code === 127 || code === 8) {
        if (this.cursorPos > 0) {
          const lastSeg = this.lastTextSeg();
          lastSeg.content = lastSeg.content.slice(0, this.cursorPos - 1) + lastSeg.content.slice(this.cursorPos);
          this.cursorPos--;
          this.redrawLine();
        } else if (this.segments.length >= 3) {
          // At start of trailing text — remove preceding paste block
          const trailingText = this.segments.pop() as TextSegment;
          this.segments.pop(); // remove paste segment
          const prevText = this.lastTextSeg();
          this.cursorPos = prevText.content.length;
          prevText.content += trailingText.content;
          this.pasteCount = this.segments.filter((s) => s.type === 'paste').length;
          this.redrawLine();
        }
        continue;
      }

      // Enter
      if (ch === '\r' || ch === '\n') {
        this.term.write('\r\n');
        const text = this.getFullText().trim();
        this.resetInput();

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
          if (cmd === 'shell') {
            this.onExit();
            continue;
          }
          if (cmd === 'clear') {
            this.history = [];
            this.messageQueue = [];
            this.lastTestResults = null;
            this.term.write('\x1b[2J\x1b[H');
            this.term.write('\x1b[90m[chat cleared]\x1b[0m');
            this.printPrompt();
            continue;
          }
          if (cmd === 'mode') {
            const c = MODE_COLORS[this.mode];
            this.term.write(`\x1b[${c}mCurrent mode: ${this.mode}\x1b[0m`);
            this.printPrompt();
            continue;
          }
          if (cmd === 'model') {
            this.openModelPicker();
            continue;
          }
          if (cmd === 'help') {
            this.term.write('\x1b[90mCommands:\x1b[0m\r\n');
            this.term.write('  \x1b[33m/agent\x1b[90m /plan /debug /ask\x1b[0m — switch mode\r\n');
            this.term.write('  \x1b[33m/model\x1b[0m — change AI model\r\n');
            this.term.write('  \x1b[33m/clear\x1b[0m — clear chat history\r\n');
            this.term.write('  \x1b[33m/shell\x1b[0m — return to terminal\r\n');
            this.term.write('  \x1b[33m/mode\x1b[0m  — show current mode\r\n');
            this.term.write('  \x1b[33mCtrl+C\x1b[0m — interrupt or exit');
            this.printPrompt();
            continue;
          }
          this.term.write(`\x1b[31mUnknown command: ${text}. Type /help for commands.\x1b[0m`);
          this.printPrompt();
          continue;
        }

        this.sendMessage(text);
        continue;
      }

      // Tab — ignore
      if (code === 9) continue;

      // Printable
      /* istanbul ignore next -- @preserve */
      if (code >= 32) {
        const lastSeg = this.lastTextSeg();
        lastSeg.content = lastSeg.content.slice(0, this.cursorPos) + ch + lastSeg.content.slice(this.cursorPos);
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
    let display = '';
    for (const seg of this.segments) {
      if (seg.type === 'text') {
        display += seg.content;
      } else {
        const num = RuwtTUI.circledNum(seg.num);
        const extra = seg.lines - 1;
        display += `\x1b[36m[paste${num}: "${seg.preview}" +${extra} line${extra > 1 ? 's' : ''} ~${seg.charCount} chars]\x1b[0m`;
      }
    }
    this.term.write(`\r\x1b[${c}mruwt[${this.mode}]>\x1b[0m ${display}\x1b[K`);
    const lastSeg = this.lastTextSeg();
    const moveBack = lastSeg.content.length - this.cursorPos;
    if (moveBack > 0) {
      this.term.write(`\x1b[${moveBack}D`);
    }
  }

  private buildModeSystemPrompt(): string {
    // Gather workspace files for AI context
    const workspaceFiles: Array<{ path: string; content: string }> = [];
    const allFiles = this.fs.readdir('/home/user');
    /* istanbul ignore next -- @preserve */
    if (allFiles) {
      for (const name of allFiles) {
        if (name === this.fs.solutionFilename) continue;
        const content = this.fs.readFile(`/home/user/${name}`);
        /* istanbul ignore next -- @preserve */
        if (content != null && content.length > 0 && content.length < 5000) {
          workspaceFiles.push({ path: name, content });
        }
      }
    }

    return buildSystemPrompt({
      mode: this.mode,
      challengeTitle: this.challengeTitle,
      challengeDescription: this.challengeDescription,
      challengeDifficulty: this.challengeDifficulty,
      challengeCategory: this.challengeCategory,
      language: this.language,
      currentCode: this.fs.getSolutionCode(),
      testCases: this.challengeTestCases,
      hiddenTestCount: this.hiddenTestCount,
      lastTestResults: this.lastTestResults,
      workspaceFiles: workspaceFiles.length > 0 ? workspaceFiles : undefined,
      readonlyPrefix: this.readonlyPrefix || null,
      useStdin: this.useStdin,
    });
  }

  /** Print ANSI-colored diff summary in terminal. */
  private printDiffSummary(oldCode: string, newCode: string): void {
    const diff = computeLineDiff(oldCode, newCode);
    if (diff.added.length === 0 && diff.changed.length === 0) return;

    const newLines = newCode.split('\n');
    const MAX_SHOWN = 4;
    const entries: string[] = [];

    for (const line of diff.added.slice(0, MAX_SHOWN)) {
      /* istanbul ignore next -- @preserve */
      const content = newLines[line - 1] ?? '';
      const trimmed = content.length > 60 ? content.slice(0, 57) + '...' : content;
      entries.push(`\x1b[32m+ L${line}: ${trimmed}\x1b[0m`);
    }
    for (const line of diff.changed.slice(0, Math.max(0, MAX_SHOWN - entries.length))) {
      const content = newLines[line - 1] ?? '';
      /* istanbul ignore next -- @preserve */
      const trimmed = content.length > 60 ? content.slice(0, 57) + '...' : content;
      entries.push(`\x1b[33m~ L${line}: ${trimmed}\x1b[0m`);
    }

    const total = diff.added.length + diff.changed.length;
    if (total > MAX_SHOWN) {
      entries.push(`\x1b[90m  ... and ${total - MAX_SHOWN} more line(s) changed\x1b[0m`);
    }

    for (const entry of entries) {
      this.term.write(`\r\n${entry}`);
    }
  }

  private async applyCodeFromResponse(responseText: string): Promise<boolean> {
    // Extract FILE: prefixed edits for non-solution files
    const { fileEdits, remaining } = extractFileEdits(responseText);
    for (const edit of fileEdits) {
      this.fs.writeFile(edit.path, edit.content);
      this.term.write(`\r\n\x1b[32m\u2713 Created ${edit.path}\x1b[0m`);
    }

    const oldCode = this.fs.getSolutionCode();
    const result = sharedApplyCode(remaining || responseText, oldCode, this.language, this.mode);
    this.lastApplyFailedCount = result.failedCount;

    // Code block extracted directly (free, instant)
    if (result.applied) {
      this.fs.setSolutionCode(result.newCode);
      this.onCodeApplied(result.newCode);
      this.term.write(`\r\n\r\n\x1b[32m\u2713 ${result.message}\x1b[0m`);
      this.printDiffSummary(oldCode, result.newCode);
      return true;
    }

    // Response has code but no extractable block — use apply model
    if (result.needsApplyModel && this.attemptId) {
      this.term.write('\r\n\r\n\x1b[33m[applying edit...]\x1b[0m');
      const applyResult = await callApplyModel({
        /* istanbul ignore next -- @preserve */
        attemptId: this.attemptId,
        currentCode: oldCode,
        aiResponse: /* istanbul ignore next -- @preserve */ remaining || responseText,
        language: this.language,
        challengeTitle: this.challengeTitle,
      });

      // Verification failed — apply model corrupted the output
      if (applyResult.verified === false) {
        this.term.write('\r\n\r\n\x1b[1;31m\u2718 Code apply failed\x1b[0m');
        this.term.write('\r\n\x1b[33mOur apply model couldn\'t faithfully reproduce this change.\x1b[0m');
        this.term.write('\r\n\x1b[33mCopy the code from the AI response above and paste it manually.\x1b[0m');
        this.term.write('\r\n\x1b[90mWe\'ve been notified.\x1b[0m');
        return fileEdits.length > 0;
      }

      if (applyResult.success && applyResult.mergedCode) {
        if (applyResult.mergedCode.trim() === oldCode.trim()) {
          return fileEdits.length > 0;
        }
        this.fs.setSolutionCode(applyResult.mergedCode);
        this.onCodeApplied(applyResult.mergedCode);
        this.term.write('\r\n\x1b[32m\u2713 Code updated\x1b[0m');
        this.printDiffSummary(oldCode, applyResult.mergedCode);
        return true;
      }

      return fileEdits.length > 0;
    }

    return false;
  }

  private openModelPicker(): void {
    let tierIdx = 0;
    let modelIdx = 0;
    const current = getModelById(this.getCurrentModelId());
    /* istanbul ignore next -- @preserve */
    if (current) {
      const tIdx = TIER_ORDER.indexOf(current.tier);
      /* istanbul ignore next -- @preserve */
      if (tIdx >= 0) {
        tierIdx = tIdx;
        const models = getModelsForTier(current.tier);
        const mIdx = models.findIndex((m) => m.id === current.id);
        /* istanbul ignore next -- @preserve */
        if (mIdx >= 0) modelIdx = mIdx;
      }
    }
    this.picker = { tierIdx, modelIdx, lineCount: 0 };
    this.renderPicker();
  }

  private renderPicker(): void {
    /* istanbul ignore next -- @preserve */
    if (!this.picker) return;

    // Erase previous render
    if (this.picker.lineCount > 0) {
      for (let j = 0; j < this.picker.lineCount; j++) {
        this.term.write('\x1b[A\r\x1b[2K');
      }
    }

    const tier = TIER_ORDER[this.picker.tierIdx];
    const models = getModelsForTier(tier);
    const currentId = this.getCurrentModelId();
    const narrow = this.term.cols < 60;
    const lines: string[] = [];

    // Title
    lines.push('  \x1b[1mSelect Model\x1b[0m');

    // Tier bar
    const tierParts = TIER_ORDER.map((t, idx) => {
      const label = tierLabel(t).toUpperCase();
      if (idx === this.picker!.tierIdx) return `\x1b[1;33m[${label}]\x1b[0m`;
      return `\x1b[90m${label}\x1b[0m`;
    });
    lines.push('  ' + tierParts.join('  '));

    // Separator
    lines.push('  \x1b[90m' + '\u2500'.repeat(Math.min(50, this.term.cols - 4)) + '\x1b[0m');

    // Model list
    for (let m = 0; m < models.length; m++) {
      const model = models[m];
      const isHighlighted = m === this.picker.modelIdx;
      const isCurrent = model.id === currentId;
      const pointer = isHighlighted ? '>' : ' ';
      const check = isCurrent ? ' \x1b[32m\u2713\x1b[0m' : '  ';
      const name = model.displayName;
      if (narrow) {
        const line = isHighlighted
          ? `  \x1b[1;33m${pointer} ${name}\x1b[0m${check}`
          : `  ${pointer} ${name}${check}`;
        lines.push(line);
      } else {
        const desc = model.description;
        const padded = name.padEnd(22);
        const line = isHighlighted
          ? `  \x1b[1;33m${pointer} ${padded}\x1b[0m${check}  \x1b[90m${desc}\x1b[0m`
          : `  ${pointer} ${padded}${check}  \x1b[90m${desc}\x1b[0m`;
        lines.push(line);
      }
    }

    // Separator
    lines.push('  \x1b[90m' + '\u2500'.repeat(Math.min(50, this.term.cols - 4)) + '\x1b[0m');

    // Footer
    lines.push('  \x1b[90m\u2191\u2193 navigate  \u2190\u2192/Tab tier  Enter select  Esc cancel\x1b[0m');

    for (const line of lines) {
      this.term.write(`\r\x1b[2K${line}\r\n`);
    }
    this.picker.lineCount = lines.length;
  }

  private closeModelPicker(selected: boolean): void {
    /* istanbul ignore next -- @preserve */
    if (!this.picker) return;

    // Clear menu lines
    for (let j = 0; j < this.picker.lineCount; j++) {
      this.term.write('\x1b[A\r\x1b[2K');
    }

    if (selected) {
      const tier = TIER_ORDER[this.picker.tierIdx];
      const models = getModelsForTier(tier);
      const model = models[this.picker.modelIdx];
      /* istanbul ignore next -- @preserve */
      if (model) {
        this.onModelChange?.(tier, model.id);
        this.term.write(`\x1b[32m[model: ${model.displayName} (${tierLabel(tier).toLowerCase()} ${model.costIndicator})]\x1b[0m`);
      }
    }

    this.picker = null;
    this.printPrompt();
  }

  private async sendMessage(text: string): Promise<void> {
    if (this.isExpired()) {
      this.term.write('\x1b[31mTime expired \u2014 AI requests disabled.\x1b[0m');
      this.printPrompt();
      return;
    }

    this.isStreaming = true;
    this.lastTestResults = null;
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
    const MAX_TOOL_LOOPS = 5;
    let lastRoundAppliedCode = false;

    let thinkingShown = false;

    const runOneRound = async (msgs: typeof messages): Promise<string | null> => {
      lastChunkLen = 0;
      thinkingShown = false;
      return new Promise((resolve) => {
        this.streamChat(msgs, {
          onThinking: () => {
            /* istanbul ignore next -- @preserve */
            if (!thinkingShown) {
              thinkingShown = true;
              this.term.write('\x1b[35m[thinking...]\x1b[0m');
            }
          },
          onThinkingDone: () => {
            /* istanbul ignore next -- @preserve */
            if (thinkingShown) {
              this.term.write('\x1b[35m done\x1b[0m\r\n');
            }
          },
          onChunk: (fullContent: string) => {
            const cleaned = stripToolCalls(fullContent);
            const newPart = cleaned.slice(lastChunkLen);
            lastChunkLen = cleaned.length;
            const termText = newPart.replace(/\n/g, '\r\n');
            this.term.write(termText);
          },
          onDone: async (fullContent: string) => {
            this.isStreaming = false;
            const cleaned = stripToolCalls(fullContent);
            this.history.push({ role: 'assistant', content: cleaned });
            this.pruneHistory();
            lastRoundAppliedCode = await this.applyCodeFromResponse(fullContent);
            resolve(fullContent);
          },
          onError: (error: string) => {
            this.isStreaming = false;
            // Detect context window / token limit errors and give actionable guidance
            const isContextError = /413|context.*(window|limit)|token.*(limit|exceed)|exceed.*(token|context)/i.test(error);
            if (isContextError) {
              this.term.write(`\r\n\x1b[33mContext window full \u2014 type \x1b[1m/clear\x1b[0m\x1b[33m to reset, or switch to a higher-tier model.\x1b[0m`);
            } else {
              this.term.write(`\r\n\x1b[31mError: ${error}\x1b[0m`);
            }
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

    // Agent loop: auto-run tests when AI writes code OR explicitly requests tests
    while (
      aiResponse &&
      (hasToolCalls(aiResponse) || lastRoundAppliedCode) &&
      (this.mode === 'agent' || this.mode === 'debug') &&
      toolLoopCount < MAX_TOOL_LOOPS &&
      this.onRunTests
    ) {
      toolLoopCount++;
      lastRoundAppliedCode = false;
      this.term.write('\r\n\r\n\x1b[33m[running tests...]\x1b[0m\r\n');

      try {
        const currentCode = this.fs.getSolutionCode();
        const testResult = await this.onRunTests(currentCode, this.language);
        this.lastTestResults = {
          /* istanbul ignore next -- @preserve */
          passed: testResult.passed,
          passedTests: testResult.passedTests,
          totalTests: testResult.totalTests,
          results: /* istanbul ignore next -- @preserve */ (testResult.results || []) as TestResults['results'],
        };

        /* istanbul ignore next -- @preserve */
        const failNote = this.lastApplyFailedCount > 0
          ? `\n[Note: ${this.lastApplyFailedCount} edit block(s) failed to apply — SEARCH text not found in current code. Re-read the current file above before writing SEARCH blocks.]`
          : '';
        this.lastApplyFailedCount = 0;
        const resultMsg = formatTestResultsForMessage(this.lastTestResults) + failNote;
        this.term.write(`\x1b[90m${resultMsg.replace(/\n/g, '\r\n')}\x1b[0m\r\n`);

        // If all tests pass, stop looping and discard queued messages
        // to prevent paste garbage from regressing the solution
        if (testResult.passed) {
          this.history.push({ role: 'user', content: resultMsg });
          this.pruneHistory();
          if (this.messageQueue.length > 0) {
            const count = this.messageQueue.length;
            this.messageQueue = [];
            /* istanbul ignore next -- @preserve */
            this.term.write(`\r\n\x1b[90m[${count} queued message${count > 1 ? 's' : ''} discarded]\x1b[0m`);
          }
          break;
        }

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

    // Notify user if max tool loops reached
    if (toolLoopCount >= MAX_TOOL_LOOPS) {
      this.term.write('\r\n\x1b[33m[max auto-fix attempts reached \u2014 review code and try again]\x1b[0m');
    }

    /* istanbul ignore next -- @preserve */
    if (!this.isStreaming) {
      // If tests already passed, discard remaining queue to prevent regressions
      /* istanbul ignore next -- @preserve */
      if (this.lastTestResults?.passed && this.messageQueue.length > 0) {
        /* istanbul ignore next -- @preserve */
        const count = this.messageQueue.length;
        /* istanbul ignore next -- @preserve */
        this.messageQueue = [];
        /* istanbul ignore next -- @preserve */
        this.term.write(`\r\n\x1b[90m[${count} queued message${count > 1 ? 's' : ''} discarded \u2014 tests already pass]\x1b[0m`);
        /* istanbul ignore next -- @preserve */
        this.printPrompt();
      } else if (this.messageQueue.length > 0) {
        // Drain message queue
        const nextMsg = this.messageQueue.shift()!;
        this.term.write(`\r\n\x1b[90m[sending queued message...]\x1b[0m`);
        this.sendMessage(nextMsg);
      } else {
        this.printPrompt();
      }
    }
  }

}
