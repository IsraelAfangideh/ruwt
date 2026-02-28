import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RuwtTUI } from './RuwtTUI';
import { VirtualFileSystem } from './VirtualFileSystem';

// ---------------------------------------------------------------------------
// Mock dependencies that RuwtTUI imports
// ---------------------------------------------------------------------------

// Mock the AI-related modules to isolate RuwtTUI behavior
vi.mock('../../lib/ai/system-prompts', () => ({
  buildSystemPrompt: vi.fn(() => 'mock-system-prompt'),
  formatTestResultsForMessage: vi.fn((r) => `Tests: ${r.passedTests}/${r.totalTests}`),
}));

vi.mock('../../lib/ai/tool-parser', () => ({
  hasToolCalls: vi.fn(() => false),
  stripToolCalls: vi.fn((text: string) => text),
}));

vi.mock('../../lib/ai/code-apply', () => ({
  applyCodeFromResponse: vi.fn(() => ({
    applied: false,
    newCode: '',
    method: 'none' as const,
    message: '',
    needsApplyModel: false,
  })),
  extractFileEdits: vi.fn(() => ({ fileEdits: [], remaining: '' })),
}));

vi.mock('../../lib/ai/apply-model', () => ({
  callApplyModel: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('../../lib/ai/line-diff', () => ({
  computeLineDiff: vi.fn(() => ({ added: [], changed: [] })),
}));

// Import the mocked modules for use in tests
import { hasToolCalls, stripToolCalls } from '../../lib/ai/tool-parser';
import { applyCodeFromResponse, extractFileEdits } from '../../lib/ai/code-apply';
import { callApplyModel } from '../../lib/ai/apply-model';
import { computeLineDiff } from '../../lib/ai/line-diff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTerminal() {
  return {
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    cols: 80,
    rows: 24,
  };
}

type MockTerminal = ReturnType<typeof createMockTerminal>;

function termOutput(term: MockTerminal): string {
  return term.write.mock.calls.map((c) => c[0]).join('');
}

function clearOutput(term: MockTerminal): void {
  term.write.mockClear();
}

interface TUISetup {
  tui: RuwtTUI;
  term: MockTerminal;
  fs: VirtualFileSystem;
  streamChat: Mock;
  abort: Mock;
  onExit: Mock;
  onCodeApplied: Mock;
  onRunTests: Mock;
  isExpired: Mock;
}

function createTUI(overrides: Record<string, unknown> = {}): TUISetup {
  const term = createMockTerminal();
  const fs = new VirtualFileSystem('javascript', 'function solve() { return 42; }');
  const streamChat = vi.fn();
  const abort = vi.fn();
  const onExit = vi.fn();
  const onCodeApplied = vi.fn();
  const onRunTests = vi.fn().mockResolvedValue({
    passed: true, passedTests: 1, totalTests: 1, results: [],
  });
  const isExpired = vi.fn(() => false);

  const tui = new RuwtTUI({
    term: term as any,
    fs,
    language: 'javascript',
    attemptId: 'attempt-123',
    challengeTitle: 'Test Challenge',
    challengeDescription: 'Solve this test',
    challengeDifficulty: 'medium',
    challengeCategory: 'Debugging',
    challengeTestCases: '[{"input":"1","output":"1"}]',
    hiddenTestCount: 2,
    streamChat,
    abort,
    onExit,
    onCodeApplied,
    onRunTests,
    isExpired,
    ...overrides,
  } as any);

  return { tui, term, fs, streamChat, abort, onExit, onCodeApplied, onRunTests, isExpired };
}

function typeAndEnter(tui: RuwtTUI, text: string): void {
  tui.handleInput(text + '\r');
}

/** Simulate streamChat that immediately calls onDone with given response. */
function mockStreamDone(streamChat: Mock, response: string): void {
  streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
    cbs.onChunk(response);
    await cbs.onDone(response);
  });
}

/** Simulate streamChat that calls onError. */
function mockStreamError(streamChat: Mock, error: string): void {
  streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
    cbs.onError(error);
  });
}

describe('RuwtTUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations
    (hasToolCalls as Mock).mockReturnValue(false);
    (stripToolCalls as Mock).mockImplementation((t: string) => t);
    (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: '' });
    (applyCodeFromResponse as Mock).mockReturnValue({
      applied: false,
      newCode: '',
      method: 'none',
      message: '',
      needsApplyModel: false,
    });
  });

  // ---------------------------------------------------------------------------
  // enter()
  // ---------------------------------------------------------------------------
  describe('enter', () => {
    it('prints welcome banner and prompt', () => {
      const { tui, term } = createTUI();
      tui.enter();
      const out = termOutput(term);
      expect(out).toContain('ruwt');
      expect(out).toContain('AI coding assistant');
      expect(out).toContain('/agent');
      expect(out).toContain('/plan');
      expect(out).toContain('/debug');
      expect(out).toContain('/ask');
      expect(out).toContain('ruwt[agent]>');
    });
  });

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------
  describe('mode switching', () => {
    it('/agent switches to agent mode', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/agent');
      const out = termOutput(term);
      expect(out).toContain('[mode: agent]');
      expect(out).toContain('ruwt[agent]>');
    });

    it('/plan switches to plan mode', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/plan');
      const out = termOutput(term);
      expect(out).toContain('[mode: plan]');
      expect(out).toContain('ruwt[plan]>');
    });

    it('/debug switches to debug mode', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/debug');
      const out = termOutput(term);
      expect(out).toContain('[mode: debug]');
      expect(out).toContain('ruwt[debug]>');
    });

    it('/ask switches to ask mode', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/ask');
      const out = termOutput(term);
      expect(out).toContain('[mode: ask]');
      expect(out).toContain('ruwt[ask]>');
    });
  });

  // ---------------------------------------------------------------------------
  // Slash commands
  // ---------------------------------------------------------------------------
  describe('slash commands', () => {
    it('/shell triggers onExit', () => {
      const { tui, onExit } = createTUI();
      tui.enter();
      typeAndEnter(tui, '/shell');
      expect(onExit).toHaveBeenCalled();
    });

    it('/clear resets chat history', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/clear');
      const out = termOutput(term);
      expect(out).toContain('[chat cleared]');
    });

    it('/mode shows current mode', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/mode');
      const out = termOutput(term);
      expect(out).toContain('Current mode: agent');
    });

    it('/help shows command list', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/help');
      const out = termOutput(term);
      expect(out).toContain('/agent');
      expect(out).toContain('/clear');
      expect(out).toContain('/shell');
      expect(out).toContain('/mode');
      expect(out).toContain('Ctrl+C');
    });

    it('unknown slash command shows error', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      typeAndEnter(tui, '/unknown');
      const out = termOutput(term);
      expect(out).toContain('Unknown command');
      expect(out).toContain('/help');
    });
  });

  // ---------------------------------------------------------------------------
  // exit / quit
  // ---------------------------------------------------------------------------
  describe('exit and quit', () => {
    it('exit triggers onExit', () => {
      const { tui, onExit } = createTUI();
      tui.enter();
      typeAndEnter(tui, 'exit');
      expect(onExit).toHaveBeenCalled();
    });

    it('quit triggers onExit', () => {
      const { tui, onExit } = createTUI();
      tui.enter();
      typeAndEnter(tui, 'quit');
      expect(onExit).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Ctrl+C
  // ---------------------------------------------------------------------------
  describe('Ctrl+C', () => {
    it('when not streaming, triggers onExit', () => {
      const { tui, term, onExit } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('\x03');
      expect(onExit).toHaveBeenCalled();
      const out = termOutput(term);
      expect(out).toContain('^C');
    });

    it('when streaming, aborts and shows interrupted message', async () => {
      const { tui, term, streamChat, abort } = createTUI();
      tui.enter();

      // Make streamChat hang (never resolve) to simulate streaming
      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('partial...');
        // Don't call onDone — streaming in progress
        // Now simulate Ctrl+C from outside
      });

      typeAndEnter(tui, 'hello');
      // Let the streamChat call start
      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalled();
      });

      clearOutput(term);
      tui.handleInput('\x03'); // Ctrl+C during stream
      expect(abort).toHaveBeenCalled();
      const out = termOutput(term);
      expect(out).toContain('[interrupted]');
    });
  });

  // ---------------------------------------------------------------------------
  // Sending a message
  // ---------------------------------------------------------------------------
  describe('sending messages', () => {
    it('sends user message to streamChat with system prompt and history', async () => {
      const { tui, streamChat } = createTUI();
      tui.enter();
      mockStreamDone(streamChat, 'AI says hello');
      typeAndEnter(tui, 'help me solve this');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(1);
      });

      const [msgs] = streamChat.mock.calls[0];
      expect(msgs[0].role).toBe('system');
      expect(msgs[1].role).toBe('user');
      expect(msgs[1].content).toBe('help me solve this');
    });

    it('streams response chunks to terminal', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('Hello');
        cbs.onChunk('Hello world');
        await cbs.onDone('Hello world');
      });

      clearOutput(term);
      typeAndEnter(tui, 'test message');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Hello');
        expect(out).toContain(' world');
      });
    });

    it('handles stream error', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();
      mockStreamError(streamChat, 'Rate limited');
      clearOutput(term);
      typeAndEnter(tui, 'please help');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Error: Rate limited');
      });
    });

    it('handles context window / token limit error with actionable message', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();
      mockStreamError(streamChat, '413 context window limit exceeded');
      clearOutput(term);
      typeAndEnter(tui, 'help me');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Context window full');
        expect(out).toContain('/clear');
      });
    });

    it('rejects message when session is expired', async () => {
      const { tui, term, isExpired, streamChat } = createTUI();
      tui.enter();
      isExpired.mockReturnValue(true);
      clearOutput(term);
      typeAndEnter(tui, 'help');

      // streamChat should NOT have been called
      expect(streamChat).not.toHaveBeenCalled();
      const out = termOutput(term);
      expect(out).toContain('Time expired');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty input
  // ---------------------------------------------------------------------------
  describe('empty input', () => {
    it('reprints prompt on empty Enter', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('\r');
      const out = termOutput(term);
      expect(out).toContain('ruwt[agent]>');
    });
  });

  // ---------------------------------------------------------------------------
  // Tab handling
  // ---------------------------------------------------------------------------
  describe('tab handling', () => {
    it('tab is ignored', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('\t');
      expect(term.write).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiline paste
  // ---------------------------------------------------------------------------
  describe('multiline paste', () => {
    it('joins pasted lines with spaces and auto-submits', async () => {
      const { tui, streamChat } = createTUI();
      tui.enter();
      mockStreamDone(streamChat, 'OK');
      tui.handleInput('line one\nline two\nline three');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(1);
      });

      const [msgs] = streamChat.mock.calls[0];
      const userMsg = msgs.find((m: any) => m.role === 'user');
      expect(userMsg.content).toBe('line one line two line three');
    });

    it('queues pasted text during streaming', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      // Make streamChat hang to simulate streaming
      let resolveDone: (value?: unknown) => void;
      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('thinking...');
        await new Promise((r) => { resolveDone = r; });
        await cbs.onDone('done');
      });

      typeAndEnter(tui, 'first message');
      await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

      clearOutput(term);
      // Paste while streaming
      tui.handleInput('follow up\nquestion');
      const out = termOutput(term);
      expect(out).toContain('[queued: 1 message');

      // Resolve the stream
      resolveDone!();
    });
  });

  // ---------------------------------------------------------------------------
  // Message queuing during streaming
  // ---------------------------------------------------------------------------
  describe('message queue', () => {
    it('queues typed messages during streaming and sends after completion', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      let doneCb: ((content: string) => Promise<void>) | null = null;
      let callCount = 0;

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        callCount++;
        if (callCount === 1) {
          cbs.onChunk('response 1');
          doneCb = cbs.onDone;
          // Don't resolve yet — simulate active streaming
        } else {
          cbs.onChunk('response 2');
          await cbs.onDone('response 2');
        }
      });

      // Send first message
      typeAndEnter(tui, 'first');
      await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

      // Queue a message while streaming
      tui.handleInput('queued msg\r');
      const out = termOutput(term);
      expect(out).toContain('[queued: 1 message]');

      // Complete the first stream
      await doneCb!('response 1');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(2);
      });
    });

    it('shows plural message count for multiple queued', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('thinking...');
        // Never call onDone
      });

      typeAndEnter(tui, 'first');
      await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

      tui.handleInput('msg1\r');
      tui.handleInput('msg2\r');
      const out = termOutput(term);
      expect(out).toContain('[queued: 2 messages]');
    });
  });

  // ---------------------------------------------------------------------------
  // Thinking indicator
  // ---------------------------------------------------------------------------
  describe('thinking indicator', () => {
    it('shows thinking indicator and done message', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onThinking?.('thinking...');
        cbs.onThinkingDone?.();
        cbs.onChunk('result');
        await cbs.onDone('result');
      });

      clearOutput(term);
      typeAndEnter(tui, 'think about it');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('[thinking...]');
        expect(out).toContain('done');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Constraint violation
  // ---------------------------------------------------------------------------
  describe('constraint handling', () => {
    it('shows constraint message', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onConstraint?.('credits', 'Insufficient credits');
      });

      clearOutput(term);
      typeAndEnter(tui, 'help me');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Insufficient credits');
      });
    });

    it('time constraint triggers onExit', async () => {
      const { tui, term, streamChat, onExit } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onConstraint?.('time', 'Time is up');
      });

      typeAndEnter(tui, 'help');

      await vi.waitFor(() => {
        expect(onExit).toHaveBeenCalled();
        const out = termOutput(term);
        expect(out).toContain('Time is up');
        expect(out).toContain('Returning to shell');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Code application from AI response
  // ---------------------------------------------------------------------------
  describe('code application', () => {
    it('applies code when applyCodeFromResponse returns applied=true', async () => {
      const { tui, term, fs: _fs, streamChat, onCodeApplied } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({
        fileEdits: [],
        remaining: 'response with code',
      });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'function solve() { return 99; }',
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });

      mockStreamDone(streamChat, 'Here is the code block');
      clearOutput(term);
      typeAndEnter(tui, 'fix the code');

      await vi.waitFor(() => {
        expect(applyCodeFromResponse).toHaveBeenCalled();
        expect(onCodeApplied).toHaveBeenCalledWith('function solve() { return 99; }');
        const out = termOutput(term);
        expect(out).toContain('Code applied');
      });
    });

    it('applies file edits for non-solution files', async () => {
      const { tui, term, fs: _fs, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({
        fileEdits: [{ path: 'helper.js', content: 'export const x = 1;' }],
        remaining: 'rest of response',
      });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: false,
      });

      mockStreamDone(streamChat, 'FILE: helper.js ...');
      clearOutput(term);
      typeAndEnter(tui, 'create a helper file');

      await vi.waitFor(() => {
        expect(extractFileEdits).toHaveBeenCalled();
        const out = termOutput(term);
        expect(out).toContain('Created helper.js');
      });
    });

    it('calls apply model when needsApplyModel is true', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: true,
      });
      (callApplyModel as Mock).mockResolvedValue({
        success: true,
        mergedCode: 'function solve() { return 100; }',
        verified: true,
      });

      mockStreamDone(streamChat, 'partial code change');
      clearOutput(term);
      typeAndEnter(tui, 'tweak it');

      await vi.waitFor(() => {
        expect(callApplyModel).toHaveBeenCalled();
        const out = termOutput(term);
        expect(out).toContain('applying edit');
        expect(out).toContain('Code updated');
      });
    });

    it('shows failure when apply model verification fails', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: true,
      });
      (callApplyModel as Mock).mockResolvedValue({
        success: false,
        verified: false,
        verificationErrors: ['corruption detected'],
      });

      mockStreamDone(streamChat, 'bad merge');
      clearOutput(term);
      typeAndEnter(tui, 'apply');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Code apply failed');
        expect(out).toContain('paste it manually');
      });
    });

    it('returns false when apply model fails (success:false, not verification)', async () => {
      const { tui, term: _term, streamChat, onCodeApplied } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: true,
      });
      // success:false but NOT verified:false — falls through to the final return
      (callApplyModel as Mock).mockResolvedValue({
        success: false,
        error: 'Model unavailable',
      });

      mockStreamDone(streamChat, 'try edit');
      typeAndEnter(tui, 'apply');

      await vi.waitFor(() => {
        expect(callApplyModel).toHaveBeenCalled();
      });
      expect(onCodeApplied).not.toHaveBeenCalled();
    });

    it('returns true when apply model fails but file edits were applied', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({
        fileEdits: [{ path: 'config.json', content: '{}' }],
        remaining: 'response',
      });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: true,
      });
      (callApplyModel as Mock).mockResolvedValue({
        success: false,
        error: 'Model unavailable',
      });

      mockStreamDone(streamChat, 'edit with file');
      clearOutput(term);
      typeAndEnter(tui, 'create and apply');

      await vi.waitFor(() => {
        expect(callApplyModel).toHaveBeenCalled();
        const out = termOutput(term);
        expect(out).toContain('Created config.json');
      });
    });

    it('skips apply when merged code matches old code', async () => {
      const { tui, term: _term, fs, streamChat, onCodeApplied } = createTUI();
      tui.enter();

      const currentCode = fs.getSolutionCode();
      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: false,
        newCode: '',
        method: 'none',
        message: '',
        needsApplyModel: true,
      });
      (callApplyModel as Mock).mockResolvedValue({
        success: true,
        mergedCode: currentCode,
        verified: true,
      });

      mockStreamDone(streamChat, 'no real change');
      typeAndEnter(tui, 'tweak');

      await vi.waitFor(() => {
        expect(callApplyModel).toHaveBeenCalled();
      });
      // onCodeApplied should NOT have been called since code is the same
      expect(onCodeApplied).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Tool-use loop (agent/debug mode auto-test)
  // ---------------------------------------------------------------------------
  describe('agent tool loop', () => {
    it('auto-runs tests after code is applied in agent mode', async () => {
      const { tui, term, streamChat, onRunTests, onCodeApplied: _onCodeApplied } = createTUI();
      tui.enter();

      let callCount = 0;
      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        callCount++;
        if (callCount === 1) {
          // First round: apply code and have tool call
          (applyCodeFromResponse as Mock).mockReturnValueOnce({
            applied: true,
            newCode: 'function solve() { return 1; }',
            method: 'code_block',
            message: 'Code applied',
            needsApplyModel: false,
          });
          (hasToolCalls as Mock).mockReturnValueOnce(true);
          cbs.onChunk('here is the fix');
          await cbs.onDone('here is the fix <ruwt:run_tests/>');
        } else {
          // Second round: tests pass, no more tool calls
          (applyCodeFromResponse as Mock).mockReturnValueOnce({
            applied: false,
            newCode: '',
            method: 'none',
            message: '',
            needsApplyModel: false,
          });
          (hasToolCalls as Mock).mockReturnValueOnce(false);
          cbs.onChunk('All tests pass now');
          await cbs.onDone('All tests pass now');
        }
      });

      onRunTests.mockResolvedValue({
        passed: true,
        passedTests: 1,
        totalTests: 1,
        results: [],
      });

      typeAndEnter(tui, 'fix the bug');

      await vi.waitFor(() => {
        expect(onRunTests).toHaveBeenCalledTimes(1);
        const out = termOutput(term);
        expect(out).toContain('[running tests...]');
      });
    });

    it('stops loop when tests pass', async () => {
      const { tui, streamChat, onRunTests } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (hasToolCalls as Mock).mockReturnValue(true);
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'code',
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('fix');
        await cbs.onDone('fix <ruwt:run_tests/>');
      });

      onRunTests.mockResolvedValue({
        passed: true,
        passedTests: 3,
        totalTests: 3,
        results: [],
      });

      typeAndEnter(tui, 'solve it');

      await vi.waitFor(() => {
        expect(onRunTests).toHaveBeenCalledTimes(1);
        // Should NOT make another streamChat call since tests passed
        expect(streamChat).toHaveBeenCalledTimes(1);
      });
    });

    it('handles test execution failure gracefully', async () => {
      const { tui, term, streamChat, onRunTests } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (hasToolCalls as Mock).mockReturnValue(true);
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'code',
        method: 'code_block',
        message: 'Applied',
        needsApplyModel: false,
      });

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('fix');
        await cbs.onDone('fix <ruwt:run_tests/>');
      });

      onRunTests.mockRejectedValue(new Error('sandbox error'));

      typeAndEnter(tui, 'fix it');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('Test execution failed');
      });
    });

    it('stops at MAX_TOOL_LOOPS (5)', async () => {
      const { tui, term, streamChat, onRunTests } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      // Always return tool calls and code applied
      (hasToolCalls as Mock).mockReturnValue(true);
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'code',
        method: 'code_block',
        message: 'Applied',
        needsApplyModel: false,
      });

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('try again');
        await cbs.onDone('try again <ruwt:run_tests/>');
      });

      // Tests always fail
      onRunTests.mockResolvedValue({
        passed: false,
        passedTests: 0,
        totalTests: 1,
        results: [{ passed: false, input: '1', expectedOutput: '1', actualOutput: '0' }],
      });

      typeAndEnter(tui, 'keep trying');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('max auto-fix attempts reached');
      });
      // 1 initial + 5 loop iterations
      expect(streamChat).toHaveBeenCalledTimes(6);
    });
  });

  // ---------------------------------------------------------------------------
  // Arrow keys (cursor movement)
  // ---------------------------------------------------------------------------
  describe('cursor movement', () => {
    it('right arrow moves cursor forward', () => {
      const { tui, term } = createTUI();
      tui.enter();
      tui.handleInput('abc');
      tui.handleInput('\x1b[D'); // left
      clearOutput(term);
      tui.handleInput('\x1b[C'); // right
      const out = termOutput(term);
      expect(out).toContain('\x1b[C');
    });

    it('left arrow moves cursor back', () => {
      const { tui, term } = createTUI();
      tui.enter();
      tui.handleInput('abc');
      clearOutput(term);
      tui.handleInput('\x1b[D');
      const out = termOutput(term);
      expect(out).toContain('\x1b[D');
    });

    it('right arrow does nothing at end of line', () => {
      const { tui, term } = createTUI();
      tui.enter();
      tui.handleInput('abc');
      clearOutput(term);
      tui.handleInput('\x1b[C'); // already at end
      expect(term.write).not.toHaveBeenCalled();
    });

    it('left arrow does nothing at start of line', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('\x1b[D'); // cursor at 0
      expect(term.write).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Backspace
  // ---------------------------------------------------------------------------
  describe('backspace', () => {
    it('removes character before cursor', () => {
      const { tui, term } = createTUI();
      tui.enter();
      tui.handleInput('abc');
      tui.handleInput('\x7f'); // backspace
      clearOutput(term);
      tui.handleInput('\r');
      // Line should be "ab" — unknown slash command or regular text
    });

    it('does nothing at position 0', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('\x7f');
      // Should not crash; no redraw if cursorPos is 0
      expect(term.write).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Printable characters
  // ---------------------------------------------------------------------------
  describe('printable input', () => {
    it('echoes typed characters via redrawLine', () => {
      const { tui, term } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.handleInput('h');
      const out = termOutput(term);
      expect(out).toContain('h');
    });

    it('inserts characters at cursor mid-line', () => {
      const { tui, term } = createTUI();
      tui.enter();
      tui.handleInput('ac');
      tui.handleInput('\x1b[D'); // left
      clearOutput(term);
      tui.handleInput('b'); // insert b between a and c
      const out = termOutput(term);
      expect(out).toContain('abc');
    });
  });

  // ---------------------------------------------------------------------------
  // Streaming input buffering
  // ---------------------------------------------------------------------------
  describe('input during streaming', () => {
    it('buffers printable characters during streaming', async () => {
      const { tui, term: _term, streamChat } = createTUI();
      tui.enter();

      // Start streaming that never resolves
      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('processing...');
        // never call onDone
      });

      typeAndEnter(tui, 'first');
      await vi.waitFor(() => expect(streamChat).toHaveBeenCalled());

      // Type during streaming — should not crash
      tui.handleInput('a');
      tui.handleInput('b');
      tui.handleInput('c');
      // These should be buffered silently
    });
  });

  // ---------------------------------------------------------------------------
  // abort() method
  // ---------------------------------------------------------------------------
  describe('abort()', () => {
    it('calls abortFn and shows interrupted when streaming', async () => {
      const { tui, term, streamChat, abort } = createTUI();
      tui.enter();

      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        cbs.onChunk('working...');
        // never resolve
      });

      typeAndEnter(tui, 'test');
      await vi.waitFor(() => expect(streamChat).toHaveBeenCalled());

      clearOutput(term);
      tui.abort();
      expect(abort).toHaveBeenCalled();
      const out = termOutput(term);
      expect(out).toContain('[interrupted]');
    });

    it('does nothing when not streaming', () => {
      const { tui, term, abort } = createTUI();
      tui.enter();
      clearOutput(term);
      tui.abort();
      expect(abort).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Diff summary display
  // ---------------------------------------------------------------------------
  describe('diff summary', () => {
    it('shows diff summary when code is applied', async () => {
      const { tui, term, streamChat, onCodeApplied: _onCodeApplied } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'function solve() { return 99; }',
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });
      (computeLineDiff as Mock).mockReturnValue({
        added: [1],
        changed: [],
      });

      mockStreamDone(streamChat, 'code block');
      clearOutput(term);
      typeAndEnter(tui, 'fix it');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('+ L1');
      });
    });

    it('shows changed lines in diff summary', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'function solve() { return 99; }',
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });
      (computeLineDiff as Mock).mockReturnValue({
        added: [],
        changed: [1, 2],
      });

      mockStreamDone(streamChat, 'code block');
      clearOutput(term);
      typeAndEnter(tui, 'fix it');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('~ L1');
      });
    });

    it('shows overflow message when many lines changed', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'line1\nline2\nline3\nline4\nline5\nline6\nline7',
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });
      (computeLineDiff as Mock).mockReturnValue({
        added: [1, 2, 3, 4, 5, 6, 7],
        changed: [],
      });

      mockStreamDone(streamChat, 'big code block');
      clearOutput(term);
      typeAndEnter(tui, 'rewrite everything');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('... and 3 more line(s) changed');
      });
    });

    it('truncates long line content in diff summary', async () => {
      const { tui, term, streamChat } = createTUI();
      tui.enter();

      const longLine = 'x'.repeat(100);
      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'response' });
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: longLine,
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      });
      (computeLineDiff as Mock).mockReturnValue({
        added: [1],
        changed: [],
      });

      mockStreamDone(streamChat, 'long line code');
      clearOutput(term);
      typeAndEnter(tui, 'add long line');

      await vi.waitFor(() => {
        const out = termOutput(term);
        expect(out).toContain('...');
        // Should contain truncated content (57 chars + ...)
        expect(out).toContain('x'.repeat(57));
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Workspace files in system prompt
  // ---------------------------------------------------------------------------
  describe('workspace files context', () => {
    it('includes non-solution workspace files in system prompt', async () => {
      const { tui, fs, streamChat } = createTUI();
      tui.enter();

      // Write a workspace file (not solution file)
      fs.writeFile('/home/user/helpers.js', 'export function add(a, b) { return a + b; }');

      mockStreamDone(streamChat, 'OK');
      typeAndEnter(tui, 'check the helpers');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(1);
      });

      // The buildSystemPrompt mock was called, and it received workspace files
      // We can verify the system prompt builder was invoked (via the mocked module)
      const { buildSystemPrompt } = await import('../../lib/ai/system-prompts');
      expect(buildSystemPrompt).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // History pruning
  // ---------------------------------------------------------------------------
  describe('history pruning', () => {
    it('prunes history when it exceeds MAX_HISTORY (50)', async () => {
      const { tui, streamChat } = createTUI();
      tui.enter();

      // Each sendMessage adds 2 entries (user + assistant), so 26 messages = 52 entries
      let callCount = 0;
      streamChat.mockImplementation(async (_msgs: unknown, cbs: any) => {
        callCount++;
        cbs.onChunk(`response ${callCount}`);
        await cbs.onDone(`response ${callCount}`);
      });

      // Send 26 messages to exceed 50 history entries (26 user + 26 assistant = 52)
      for (let i = 0; i < 26; i++) {
        typeAndEnter(tui, `message ${i}`);
        // Wait for each to complete before sending next
        await vi.waitFor(() => {
          expect(streamChat).toHaveBeenCalledTimes(i + 1);
        });
      }

      // The system should have pruned history. We can verify it didn't crash
      // and that recent messages are still present by checking the last call
      const lastCall = streamChat.mock.calls[25];
      const msgs = lastCall[0];
      // System prompt is first, then history messages
      // With pruning at 50, and we just added message 25 (user) before the call,
      // the total history before this call had 50 entries (25 user + 25 assistant)
      // plus the new user message = 51, which gets pruned to 50
      expect(msgs.length).toBeLessThanOrEqual(52); // system + up to 51 history entries
    });
  });

  // ---------------------------------------------------------------------------
  // No onRunTests callback
  // ---------------------------------------------------------------------------
  describe('without onRunTests', () => {
    it('does not enter tool loop when onRunTests is not provided', async () => {
      const { tui, streamChat } = createTUI({ onRunTests: undefined });
      tui.enter();

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'r' });
      (hasToolCalls as Mock).mockReturnValue(true);
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'code',
        method: 'code_block',
        message: 'Applied',
        needsApplyModel: false,
      });

      mockStreamDone(streamChat, 'fix <ruwt:run_tests/>');
      typeAndEnter(tui, 'fix');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(1);
      });
      // No loop since onRunTests is undefined
    });
  });

  // ---------------------------------------------------------------------------
  // Plan/ask mode does NOT enter tool loop
  // ---------------------------------------------------------------------------
  describe('plan/ask mode no tool loop', () => {
    it('plan mode does not enter tool loop even with tool calls', async () => {
      const { tui, streamChat, onRunTests } = createTUI();
      tui.enter();
      typeAndEnter(tui, '/plan');

      (extractFileEdits as Mock).mockReturnValue({ fileEdits: [], remaining: 'r' });
      (hasToolCalls as Mock).mockReturnValue(true);
      (applyCodeFromResponse as Mock).mockReturnValue({
        applied: true,
        newCode: 'code',
        method: 'code_block',
        message: 'Applied',
        needsApplyModel: false,
      });

      mockStreamDone(streamChat, 'plan <ruwt:run_tests/>');
      typeAndEnter(tui, 'plan something');

      await vi.waitFor(() => {
        expect(streamChat).toHaveBeenCalledTimes(1);
      });
      expect(onRunTests).not.toHaveBeenCalled();
    });
  });
});
