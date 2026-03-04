/**
 * Arena IDE: Left sidebar (Description/Chat), right pane (Monaco + Terminal).
 * AI auto-apply: code blocks from chat responses are applied to the editor.
 * Terminal: virtual shell with `ruwt` TUI mode for AI assistance.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { arena } from '@/theme/colors';
import { VirtualFileSystem } from './arena/VirtualFileSystem';
import { useCodeSync } from './arena/useCodeSync';
import { useAIChat, type MessageMeta } from './arena/useAIChat';
import { TerminalPanel, type TerminalPanelHandle } from './arena/TerminalPanel';
import { TIER_MODELS, getModelById, getModelsForTier, tierColor, tierLabel, estimateTypicalMessageCost, formatCostFromHundredths, type ModelTier } from '@/lib/ai/pricing';
import { estimateChatCost, formatEstimatedCost } from '@/lib/cost-estimate';
import { useIsMobile } from '@/lib/useIsMobile';
import { CommentSection } from '@/components/CommentSection';
import { buildSystemPrompt, formatTestResultsForMessage, type AIMode, type TestResults as AITestResults } from '@/lib/ai/system-prompts';
import { stripToolCalls, hasToolCalls } from '@/lib/ai/tool-parser';
import { applyCodeFromResponse as sharedApplyCode, extractFileEdits } from '@/lib/ai/code-apply';
import { callApplyModel } from '@/lib/ai/apply-model';
import { useEditorDecorations } from './arena/useEditorDecorations';
import { ModeSelector } from './arena/ModeSelector';
// Notepad is now embedded in DescriptionPanel
import { renderMarkdown, ThinkingBlock } from './arena/ChatMarkdown';
import { ResultsBar, type TestResults } from './arena/ResultsBar';
import ExpiryOverlay from './arena/ExpiryOverlay';
import '@/lib/monaco-init';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

function formatCost(cents: number): string {
  const d = cents / 10000;
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── Constraint violation messages ──────────────────────────────── */

const constraintMessages: Record<string, string> = {
  time: 'Time limit reached \u2014 you can review your code but can\'t make more AI requests.',
  cost: 'Cost limit reached for this attempt.',
};

/* ─── Types ───────────────────────────────────────────────────────── */

export interface TestCaseResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string | null;
  time?: string;
  memory?: number;
}

export interface ArenaChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category?: string | null;
  starterCode: string | null;
  testCases: string;
  maxCost: number | null;
  wallClockLimit: number | null;
  language?: string | null;
  expiresAt?: string | null;
  hiddenTestCount?: number;
  readonlyPrefix?: string | null;
  stats?: { solvers: number; avgCost: number | null; bestCost: number | null } | null;
}

export interface ArenaAttempt {
  id: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  status: string;
  expiresAt: string | null;
}

// TestResults re-exported from ./arena/ResultsBar
export type { TestResults } from './arena/ResultsBar';

export interface PastAttempt {
  id: string;
  status: string;
  passedTests: number;
  totalTests: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  submittedAt: string | null;
}

interface ArenaIDEProps {
  challenge: ArenaChallenge;
  attempt?: ArenaAttempt | null;
  guestMode?: boolean;
  userCredits: number;
  code: string;
  onCodeChange: (code: string) => void;
  language: string;
  isExpired?: boolean;
  onExpire?: () => void;
  onRunTests: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number; results?: unknown[] }>;
  onSubmit?: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number }>;
  onAttemptUpdate?: (attempt: ArenaAttempt) => void;
  onRestart?: () => void;
  onRunCode: (sourceCode: string, language: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  testResults?: TestResults | null;
  onDismissResults?: () => void;
  pastAttempts?: PastAttempt[];
}

/* ─── Notification Toast ─────────────────────────────────────────── */

function CodeUpdateToast({ visible, message }: { visible: boolean; message?: string }) {
  if (!visible) return null;
  return (
    <div style={s.toast} role="status" aria-live="polite">
      <span style={{ color: arena.success }}>{'\u2713'}</span> {message || 'Code updated'}
    </div>
  );
}

function PasteBlockedToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{ ...s.toast, borderLeft: `3px solid ${arena.error}` }} role="alert" aria-live="assertive">
      <span style={{ color: arena.error }}>{'\u2718'}</span> No pasting in the Arena — let your AI write the code.
    </div>
  );
}

function ApplyFailureToast({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  if (!visible) return null;
  return (
    <div role="alert" aria-live="assertive" style={{
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      zIndex: 30,
      background: '#1a1216',
      border: `1px solid ${arena.error}`,
      borderLeft: `4px solid ${arena.error}`,
      borderRadius: 8,
      padding: '14px 18px',
      fontSize: 13,
      fontFamily: 'Libre Franklin, -apple-system, sans-serif',
      color: arena.text,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, color: arena.error, marginBottom: 6, fontSize: 14 }}>
            Code apply failed — manual copy needed
          </div>
          <div style={{ color: '#b0a898' }}>
            Our apply model tried its best but couldn't faithfully reproduce this code change.
            The AI's response is in the chat panel — grab the code from there and paste it into the right spot.
            We've been notified and are looking into it.
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          style={{
            background: 'none',
            border: 'none',
            color: '#6e6560',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >{'\u2715'}</button>
      </div>
    </div>
  );
}

function ModelUnavailableToast({ visible, message, onDismiss }: { visible: boolean; message: string; onDismiss: () => void }) {
  if (!visible) return null;
  return (
    <div role="alert" aria-live="assertive" style={{
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      zIndex: 30,
      background: '#1a1612',
      border: `1px solid ${arena.accent}`,
      borderLeft: `4px solid ${arena.accent}`,
      borderRadius: 8,
      padding: '14px 18px',
      fontSize: 13,
      fontFamily: 'Libre Franklin, -apple-system, sans-serif',
      color: arena.text,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>{message}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          style={{
            background: 'none',
            border: 'none',
            color: '#6e6560',
            fontSize: 18,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >{'\u2715'}</button>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function PastAttemptsSection({ attempts: pastAttempts }: { attempts: PastAttempt[] }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={s.sectionLabel}>Past Attempts</div>
      {!pastAttempts.length && (
        <div style={{
          padding: '16px 12px',
          background: arena.surface,
          border: `1px solid ${arena.border}`,
          borderRadius: 6,
          fontSize: 12,
          lineHeight: '1.6',
          color: arena.textMuted,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          textAlign: 'center' as const,
        }}>
          No past attempts yet. Run tests or submit your solution to see history here.
        </div>
      )}
      {pastAttempts.map((a) => {
        const statusColor = a.status === 'passed' ? arena.success : a.status === 'failed' ? arena.error : arena.accent;
        const costStr = formatCost(a.totalCost);
        const tokens = a.inputTokens + a.outputTokens;
        const timeAgo = getTimeAgo(a.createdAt);
        return (
          <div key={a.id} style={{
            marginBottom: 8, background: arena.surface,
            border: `1px solid ${arena.border}`, borderRadius: 6,
            padding: '8px 12px', fontSize: 12,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: statusColor,
                padding: '1px 6px', borderRadius: 9999,
                border: `1px solid ${statusColor}40`, background: `${statusColor}15`,
              }}>
                {a.status}
              </span>
              <span style={{ color: arena.textMuted }}>
                {a.passedTests}/{a.totalTests} passed
              </span>
              <span style={{ color: arena.textSubtle, marginLeft: 'auto' }}>{timeAgo}</span>
            </div>
            <div style={{ color: arena.textMuted, fontSize: 11 }}>
              Cost: {costStr} &middot; {tokens.toLocaleString()} {tokens === 1 ? 'token' : 'tokens'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MessageCopyButton({ content }: { content: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'transparent',
        border: `1px solid ${arena.border}`,
        borderRadius: 4,
        color: copied ? arena.accent : arena.textMuted,
        fontSize: 10,
        padding: '1px 6px',
        cursor: 'pointer',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        marginLeft: 'auto',
        transition: 'color 0.15s',
      }}
      title="Copy message"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function DescriptionPanel({ challenge, pastAttempts, notepadContent, onNotepadChange }: { challenge: ArenaChallenge; pastAttempts?: PastAttempt[]; notepadContent?: string; onNotepadChange?: (v: string) => void }) {
  const [notesExpanded, setNotesExpanded] = React.useState(false);
  let testCases: Array<{ input: string; expectedOutput: string }> = [];
  try {
    testCases = JSON.parse(challenge.testCases);
  } catch { /* ignore */ }
  const examples = testCases.slice(0, 2);

  return (
    <div style={s.descriptionScroll}>
      <div style={s.descriptionText}>
        {renderMarkdown(challenge.description, undefined, { collapsibleCodeBlocks: true })}
      </div>

      {examples.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={s.sectionLabel}>Examples</div>
          {examples.map((tc, i) => (
            <div key={i} style={s.exampleBlock}>
              <div style={s.exampleLabel}>Input:</div>
              <div style={s.exampleValue}>{tc.input || '(none)'}</div>
              <div style={{ ...s.exampleLabel, marginTop: 6 }}>Output:</div>
              <div style={{ ...s.exampleValue, color: arena.success }}>{tc.expectedOutput}</div>
            </div>
          ))}
          {challenge.hiddenTestCount != null && challenge.hiddenTestCount > 0 && (
            <div style={{
              marginTop: 10,
              padding: '8px 10px',
              background: `${arena.accent}10`,
              border: `1px solid ${arena.accent}30`,
              borderRadius: 6,
              fontSize: 11,
              color: arena.textMuted,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              lineHeight: '1.5',
            }}>
              <span style={{ color: arena.accent }}>{'\u{1F512}'}</span>{' '}
              {testCases.length} public tests shown + {challenge.hiddenTestCount} hidden tests run on submission
            </div>
          )}
        </div>
      )}

      {(challenge.maxCost != null || challenge.wallClockLimit != null) && (
        <div style={{ marginTop: 20 }}>
          <div style={s.sectionLabel}>Constraints</div>
          <div style={s.constraintsList}>
            {challenge.wallClockLimit != null && <div>Time limit: {formatTime(challenge.wallClockLimit)}</div>}
            {challenge.maxCost != null && <div>Max cost: ${(challenge.maxCost / 10000).toFixed(2)}</div>}
          </div>
        </div>
      )}

      {pastAttempts && <PastAttemptsSection attempts={pastAttempts} />}

      {/* Collapsible Your Notes section */}
      {onNotepadChange && (
        <div style={{ marginTop: 20, borderTop: `1px solid ${arena.border}`, paddingTop: 12 }}>
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: 0,
            }}
          >
            <span style={{ fontSize: 8, color: arena.textMuted, transition: 'transform 0.15s', transform: notesExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>{'\u25B6'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: arena.text }}>Your Notes</span>
            <span style={{ fontSize: 10, color: arena.textSubtle, fontStyle: 'italic' }}>(AI can't see this)</span>
          </button>
          {notesExpanded && (
            <textarea
              value={notepadContent ?? ''}
              onChange={(e) => onNotepadChange(e.target.value)}
              placeholder="Jot down your approach, observations, or ideas..."
              aria-label="Notes"
              style={{
                marginTop: 8,
                width: '100%',
                minHeight: 100,
                background: arena.surface,
                border: `1px solid ${arena.border}`,
                borderRadius: 6,
                color: arena.text,
                fontSize: 12,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                padding: 10,
                resize: 'vertical' as const,
                lineHeight: '1.5',
                boxSizing: 'border-box' as const,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────── */

export function ArenaIDE({
  challenge,
  attempt,
  guestMode,
  code,
  onCodeChange,
  language,
  isExpired: isExpiredProp,
  onExpire,
  onAttemptUpdate,
  onRestart,
  onRunTests,
  onRunCode,
  testResults,
  onDismissResults,
  pastAttempts,
}: ArenaIDEProps) {
  const [totalCost, setTotalCost] = useState(attempt?.totalCost ?? 0);
  const [inputTokens, setInputTokens] = useState(attempt?.inputTokens ?? 0);
  const [outputTokens, setOutputTokens] = useState(attempt?.outputTokens ?? 0);
  const [messages, setMessages] = useState<{ role: 'system' | 'user' | 'assistant'; content: string; isConstraint?: boolean; meta?: MessageMeta; thinking?: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isThinkingPhase, setIsThinkingPhase] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [model, setModel] = useState('@cf/meta/llama-3.1-8b-instruct');
  const [selectedTier, setSelectedTier] = useState<ModelTier>('budget');
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);
  const [showExpiryOverlay, setShowExpiryOverlay] = useState(false);
  const [aiLimitReached, setAiLimitReached] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'chat' | 'discussion'>('description');
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showPasteBlocked, setShowPasteBlocked] = useState(false);
  const [showApplyFailure, setShowApplyFailure] = useState(false);
  const [showModelUnavailable, setShowModelUnavailable] = useState(false);
  const [modelUnavailableMsg, setModelUnavailableMsg] = useState('');
  const [disabledModels, setDisabledModels] = useState<Set<string>>(new Set());
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'editor'>('editor');
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [mode, setMode] = useState<AIMode>('agent');
  const [notepadContent, setNotepadContent] = useState('');
  const [isToolLooping, setIsToolLooping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const [queueLength, setQueueLength] = useState(0);
  const pendingTestContextRef = useRef<AITestResults | null>(null);
  const pendingRetryRef = useRef<string | null>(null);
  const streamingThinkingRef = useRef('');
  const abortedByUserRef = useRef(false);
  const lastApplyFailedRef = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messageQueueRef = useRef<string[]>([]);
  const isSidebarDragging = useRef(false);

  const isMobile = useIsMobile();
  const activeTabRef = useRef<'description' | 'chat' | 'discussion'>('description');
  activeTabRef.current = activeTab;
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<unknown>(null);
  const terminalRef = useRef<TerminalPanelHandle>(null);
  // isExpired is driven by ArenaScreen (single source of truth for timer)
  const isExpired = isExpiredProp ?? false;
  const isExpiredRef = useRef(false);
  isExpiredRef.current = isExpired;
  const isDragging = useRef(false);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const attemptId = attempt?.id ?? '';

  // Virtual filesystem
  const fs = useMemo(() => new VirtualFileSystem(language, code), []);

  // Editor decorations (visual diff highlights)
  const { showDiffDecorations, clearDecorations } = useEditorDecorations(editorRef as React.RefObject<unknown>);

  // Bidirectional sync: Monaco <-> VFS
  const { handleEditorChange } = useCodeSync(editorRef as React.RefObject<never>, fs, onCodeChange, clearDecorations);

  // Use ref to avoid stale closure in handleCostUpdate during agent loops
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const onAttemptUpdateRef = useRef(onAttemptUpdate);
  onAttemptUpdateRef.current = onAttemptUpdate;

  // AI chat hook — uses refs to always read latest attempt
  const handleCostUpdate = useCallback((cost: number, inTok: number, outTok: number) => {
    setTotalCost((prev) => prev + cost);
    setInputTokens((prev) => prev + inTok);
    setOutputTokens((prev) => prev + outTok);
    const currentAttempt = attemptRef.current;
    /* istanbul ignore if -- @preserve onAttemptUpdate callback requires both ref and attempt to be set; test mocks bypass this */
    if (onAttemptUpdateRef.current && currentAttempt) {
      onAttemptUpdateRef.current({
        ...currentAttempt,
        totalCost: currentAttempt.totalCost + cost,
        inputTokens: currentAttempt.inputTokens + inTok,
        outputTokens: currentAttempt.outputTokens + outTok,
      });
    }
  }, []);

  const { streamChat, abort: abortChat } = useAIChat({
    attemptId,
    model,
    onCostUpdate: handleCostUpdate,
  });

  // Show toast notification
  const flashToast = useCallback((msg?: string) => {
    setToastMessage(msg || '');
    setShowToast(true);
    /* istanbul ignore next -- @preserve timer callback; not awaitable in unit tests */
    setTimeout(() => setShowToast(false), 2000);
  }, []);

  const pasteToastTimer = useRef<ReturnType<typeof setTimeout>>();
  /* istanbul ignore next -- @preserve paste-blocked toast callback; paste events not simulated in tests */
  const showPasteBlockedToast = useCallback(() => {
    if (pasteToastTimer.current) clearTimeout(pasteToastTimer.current);
    setShowPasteBlocked(true);
    pasteToastTimer.current = setTimeout(() => setShowPasteBlocked(false), 3000);
  }, []);

  // Auto-apply code from AI response.
  // Returns true if code was changed (used by agent loop to auto-run tests).
  const applyCodeFromResponse = useCallback(async (responseText: string): Promise<boolean> => {
    // Extract FILE: prefixed edits for non-solution files
    const { fileEdits, remaining } = extractFileEdits(responseText);
    /* istanbul ignore next -- @preserve extractFileEdits is mocked to return empty array in tests */
    for (const edit of fileEdits) {
      fs.writeFile(edit.path, edit.content);
      flashToast(`Created ${edit.path}`);
    }

    const oldCode = fs.getSolutionCode();
    const result = sharedApplyCode(remaining || responseText, oldCode, language, mode);
    lastApplyFailedRef.current = result.failedCount;

    // Code block extracted directly (free, instant)
    if (result.applied) {
      fs.setSolutionCode(result.newCode);
      flashToast(result.message);
      showDiffDecorations(oldCode, result.newCode);
      return true;
    }

    // Response has code but no extractable block — use apply model
    if (result.needsApplyModel && attemptId) {
      flashToast('Applying edit...');
      const applyResult = await callApplyModel({
        attemptId,
        currentCode: oldCode,
        aiResponse: remaining || responseText,
        language,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
      });

      // Track apply model cost regardless of success/failure
      if (applyResult.cost) {
        handleCostUpdate(applyResult.cost, applyResult.inputTokens ?? 0, applyResult.outputTokens ?? 0);
      }

      // Verification failed — apply model corrupted the output
      if (applyResult.verified === false) {
        setShowApplyFailure(true);
        return fileEdits.length > 0;
      }

      /* istanbul ignore if -- @preserve applyResult.success requires callApplyModel to succeed; mocked as { success: false } */
      if (applyResult.success && applyResult.mergedCode) {
        // Check that the merge actually changed something
        if (applyResult.mergedCode.trim() === oldCode.trim()) {
          return fileEdits.length > 0; // Still return true if we wrote other files
        }
        fs.setSolutionCode(applyResult.mergedCode);
        flashToast('Code updated');
        showDiffDecorations(oldCode, applyResult.mergedCode);
        return true;
      }

      /* istanbul ignore next -- @preserve fallback return after apply model branch */
      return fileEdits.length > 0;
    }

    /* istanbul ignore next -- @preserve fallback return when no code block and no apply model result */
    return fileEdits.length > 0;
  }, [language, fs, flashToast, mode, attemptId, showDiffDecorations, challenge.id, challenge.title, handleCostUpdate]);

  // Handle code applied from terminal (RuwtTUI)
  /* istanbul ignore next -- @preserve callback invoked by TerminalPanel which is fully mocked */
  const handleTerminalCodeApplied = useCallback(() => {
    flashToast();
  }, [flashToast]);

  // pendingTestContextRef is read inside runOneRound's buildSystemPrompt call

  // Notepad localStorage persistence
  useEffect(() => {
    if (attemptId) {
      const saved = localStorage.getItem(`notepad-${attemptId}`);
      if (saved) setNotepadContent(saved);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId && notepadContent) {
      localStorage.setItem(`notepad-${attemptId}`, notepadContent);
    }
  }, [notepadContent, attemptId]);

  // Auto-save code to localStorage every 30s + on blur/tab switch
  useEffect(() => {
    if (!attemptId) return;
    const save = () => {
      if (code) localStorage.setItem(`arena-code-${attemptId}`, code);
    };
    const timer = setInterval(save, 30000);
    const handleVisibility = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', save);
    return () => {
      save(); // save on unmount too
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', save);
    };
  }, [attemptId, code]);

  // Show expiry overlay when ArenaScreen's timer detects expiration
  useEffect(() => {
    if (isExpired && !showExpiryOverlay) {
      setShowExpiryOverlay(true);
    }
  }, [isExpired]);

  // Auto-scroll chat (only when user is near the bottom)
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
      setShowScrollBtn(false);
    }
  }, [messages, streamingContent, streamingThinking]);

  // Cmd+L to focus chat input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setActiveTab('chat');
        setHasUnreadChat(false);
        if (isMobile) setMobilePanel('sidebar');
        setTimeout(() => chatTextareaRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isMobile]);

  // Track unread chat messages & auto-dismiss nudge
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      setNudgeDismissed(true);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && activeTabRef.current !== 'chat') {
        setHasUnreadChat(true);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Send sidebar chat message — with tool-use orchestration loop
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || chatInput).trim();
    if (!text || !attemptId) return;

    // Queue if currently loading
    if (isLoadingChat) {
      messageQueueRef.current.push(text);
      setQueueLength(messageQueueRef.current.length);
      setChatInput('');
      return;
    }

    /* istanbul ignore if -- @preserve isExpired requires time-based expiry which is not simulated in unit tests */
    if (isExpired) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: constraintMessages.time,
        isConstraint: true,
      }]);
      setChatInput('');
      return;
    }

    /* istanbul ignore if -- @preserve aiLimitReached requires exhausting the budget which test mocks don't simulate */
    if (aiLimitReached) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'AI limit reached \u2014 budget exhausted for this attempt.',
        isConstraint: true,
      }]);
      setChatInput('');
      return;
    }

    setChatInput('');
    const userMsg = { role: 'user' as const, content: text };
    setMessages((m) => [...m, userMsg]);
    setIsLoadingChat(true);
    setStreamingContent('');

    // Build the conversation with mode-aware system prompt
    const allMessages = [
      ...messages.filter((m) => m.role !== 'system' && !m.isConstraint).map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: text },
    ];

    let toolLoopCount = 0;
    const MAX_TOOL_LOOPS = 5;
    let conversationMessages = allMessages;
    let constraintHit = false;
    let lastRoundAppliedCode = false;

    const runOneRound = async (msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, isFollowUp: boolean): Promise<string | null> => {
      // Gather workspace files for AI context (non-solution files)
      const workspaceFiles: Array<{ path: string; content: string }> = [];
      const allFiles = fs.readdir('/home/user');
      /* istanbul ignore next -- @preserve VFS readdir mock returns empty array; workspace file gathering loop body never executes */
      if (allFiles) {
        for (const name of allFiles) {
          if (name === fs.solutionFilename) continue;
          const content = fs.readFile(`/home/user/${name}`);
          if (content != null && content.length > 0 && content.length < 5000) {
            workspaceFiles.push({ path: name, content });
          }
        }
      }

      const systemPrompt = buildSystemPrompt({
        mode,
        challengeTitle: challenge.title,
        challengeDescription: challenge.description,
        challengeDifficulty: challenge.difficulty,
        challengeCategory: challenge.category || null,
        language,
        currentCode: fs.getSolutionCode(),
        testCases: challenge.testCases || '[]',
        hiddenTestCount: challenge.hiddenTestCount,
        lastTestResults: pendingTestContextRef.current || (testResults as AITestResults | undefined) || null,
        isFollowUp,
        workspaceFiles: workspaceFiles.length > 0 ? workspaceFiles : undefined,
        readonlyPrefix: challenge.readonlyPrefix || null,
      });
      const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...msgs,
      ];

      return new Promise((resolve) => {
        streamChat(chatMessages, {
          userMessage: isFollowUp ? undefined : text,
          onThinking: (thinkingContent) => {
            setStreamingThinking(thinkingContent);
            streamingThinkingRef.current = thinkingContent;
            setIsThinkingPhase(true);
          },
          onThinkingDone: () => {
            setIsThinkingPhase(false);
          },
          onChunk: (fullContent) => {
            setStreamingContent(stripToolCalls(fullContent));
            setIsThinkingPhase(false);
          },
          onDone: async (fullContent, meta) => {
            // If user clicked Stop, handleStopChat already saved the message
            if (abortedByUserRef.current) {
              abortedByUserRef.current = false;
              setStreamingContent('');
              setStreamingThinking('');
              streamingThinkingRef.current = '';
              setIsThinkingPhase(false);
              resolve(null);
              return;
            }
            const cleanContent = stripToolCalls(fullContent);
            const thinking = streamingThinkingRef.current || undefined;
            setMessages((m) => [...m, { role: 'assistant', content: cleanContent, meta, thinking }]);
            setStreamingContent('');
            setStreamingThinking('');
            streamingThinkingRef.current = '';
            setIsThinkingPhase(false);
            lastRoundAppliedCode = await applyCodeFromResponse(fullContent);
            resolve(fullContent);
          },
          onError: (error) => {
            setMessages((m) => [...m, { role: 'assistant', content: `Request failed: ${error}` }]);
            setStreamingContent('');
            setStreamingThinking('');
            streamingThinkingRef.current = '';
            setIsThinkingPhase(false);
            setIsLoadingChat(false);
            resolve(null);
          },
          onConstraint: (violation, message) => {
            const friendlyMsg = constraintMessages[violation] || message;
            setMessages((m) => [...m, { role: 'assistant', content: friendlyMsg, isConstraint: true }]);
            setStreamingContent('');
            setStreamingThinking('');
            streamingThinkingRef.current = '';
            setIsThinkingPhase(false);
            constraintHit = true;
            if (violation === 'time') {
              onExpire?.();
              setShowExpiryOverlay(true);
            }
            if (violation === 'cost') {
              setAiLimitReached(true);
            }
            setIsLoadingChat(false);
            resolve(null);
          },
          onModelUnavailable: (_modelId, _displayName, message) => {
            setDisabledModels((prev) => new Set(prev).add(_modelId));
            setModelUnavailableMsg(message);
            setShowModelUnavailable(true);
            setStreamingContent('');
            setStreamingThinking('');
            streamingThinkingRef.current = '';
            setIsThinkingPhase(false);
            setIsLoadingChat(false);
            setTimeout(() => setShowModelUnavailable(false), 5000);
            resolve(null);
          },
        });
      });
    };

    // First round
    let aiResponse = await runOneRound(conversationMessages, false);

    // Agent loop: auto-run tests when AI writes code OR explicitly requests tests.
    // This makes ALL models work with the loop — no need for <ruwt:run_tests/> markers.
    while (
      aiResponse &&
      (hasToolCalls(aiResponse) || lastRoundAppliedCode) &&
      (mode === 'agent' || mode === 'debug') &&
      toolLoopCount < MAX_TOOL_LOOPS &&
      !constraintHit &&
      onRunTests
    ) {
      toolLoopCount++;
      lastRoundAppliedCode = false;
      setIsToolLooping(true);

      // Run tests with current code
      const currentCode = fs.getSolutionCode();
      try {
        const testResult = await onRunTests(currentCode, language);
        const asAITestResults: AITestResults = {
          passed: testResult.passed,
          passedTests: testResult.passedTests,
          totalTests: testResult.totalTests,
          results: (testResult.results || []) as AITestResults['results'],
        };

        // If all tests pass, stop looping
        if (testResult.passed) {
          const resultMsg = formatTestResultsForMessage(asAITestResults);
          setMessages((m) => [...m, { role: 'user', content: resultMsg }]);
          break;
        }

        const failNote = lastApplyFailedRef.current > 0
          ? `\n[Note: ${lastApplyFailedRef.current} edit block(s) failed to apply — SEARCH text not found in current code. Re-read the current file above before writing SEARCH blocks.]`
          : '';
        lastApplyFailedRef.current = 0;
        const resultMsg = formatTestResultsForMessage(asAITestResults) + failNote;
        setMessages((m) => [...m, { role: 'user', content: resultMsg }]);

        // Add to conversation and re-prompt
        conversationMessages = [
          ...conversationMessages,
          { role: 'assistant' as const, content: stripToolCalls(aiResponse!) },
          { role: 'user' as const, content: resultMsg },
        ];
        aiResponse = await runOneRound(conversationMessages, true);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Test execution failed';
        setMessages((m) => [...m, { role: 'assistant', content: `[Agent loop error: ${errMsg}]` }]);
        break;
      }
    }

    // Notify user if max tool loops reached
    if (toolLoopCount >= MAX_TOOL_LOOPS && !constraintHit) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'Reached maximum auto-fix attempts (5). Review the code and try asking again.',
        isConstraint: true,
      }]);
    }

    setIsToolLooping(false);
    setIsLoadingChat(false);
    // Clear pending test context after use
    pendingTestContextRef.current = null;

    // Drain message queue
    /* istanbul ignore if -- @preserve queue drain requires completing a stream while a second message is queued; fully mocked ArenaIDE cannot trigger this */
    if (messageQueueRef.current.length > 0) {
      const nextMsg = messageQueueRef.current.shift()!;
      setQueueLength(messageQueueRef.current.length);
      setTimeout(() => sendMessage(nextMsg), 0);
    }
  }, [chatInput, isLoadingChat, attemptId, messages, challenge, language, fs, streamChat, isExpired, aiLimitReached, applyCodeFromResponse, mode, onRunTests, testResults]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Stop AI generation
  const handleStopChat = useCallback(() => {
    abortedByUserRef.current = true;
    abortChat();
    setIsLoadingChat(false);
    setIsToolLooping(false);
    setIsThinkingPhase(false);
    // Save partial streaming content as final message
    const partial = streamingContent || streamingThinking;
    if (partial) {
      setMessages((m) => [...m, {
        role: 'assistant' as const,
        content: partial + '\n\n*[stopped]*',
      }]);
    }
    setStreamingContent('');
    setStreamingThinking('');
    streamingThinkingRef.current = '';
    messageQueueRef.current = [];
    setQueueLength(0);
  }, [abortChat, streamingContent, streamingThinking]);

  // Retry: after messages are truncated by handleRetry, this effect fires
  // the retry with the latest sendMessage (which sees the truncated messages).
  useEffect(() => {
    if (pendingRetryRef.current && !isLoadingChat) {
      const text = pendingRetryRef.current;
      pendingRetryRef.current = null;
      sendMessage(text);
    }
  }, [messages, isLoadingChat, sendMessage]);

  // Retry last AI response
  /* istanbul ignore next -- @preserve handleRetry requires chat history state that tests do not build up */
  const handleRetry = useCallback(() => {
    if (isLoadingChat || !attemptId) return;

    const msgs = messagesRef.current;
    // Find last non-constraint assistant message
    let lastAsstIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant' && !msgs[i].isConstraint) {
        lastAsstIdx = i;
        break;
      }
    }
    if (lastAsstIdx === -1) return;

    // Find the original user message that started this exchange
    // (skip tool-loop test result messages)
    let userMsgIdx = lastAsstIdx - 1;
    while (userMsgIdx >= 0) {
      const m = msgs[userMsgIdx];
      if (m.role === 'user' && !m.content.startsWith('[Test Results]')) break;
      /* istanbul ignore next -- @preserve only hit when tool-loop inserts [Test Results] messages before the user message */
      userMsgIdx--;
    }
    /* istanbul ignore next -- @preserve only reachable if no user message exists before the assistant message */
    if (userMsgIdx < 0) return;

    const retryText = msgs[userMsgIdx].content;
    // Store retry text in ref — the useEffect above fires sendMessage
    // after React commits the truncated messages state
    pendingRetryRef.current = retryText;
    setMessages((prev) => prev.slice(0, userMsgIdx));
  }, [isLoadingChat, attemptId]);

  // Clear chat
  const handleClearChat = useCallback(() => {
    if (isLoadingChat) handleStopChat();
    setMessages([]);
    setStreamingContent('');
    setStreamingThinking('');
    streamingThinkingRef.current = '';
    setIsThinkingPhase(false);
    setChatInput('');
    setExpandedMessages(new Set());
    messageQueueRef.current = [];
    setQueueLength(0);
  }, [isLoadingChat, handleStopChat]);

  // Drag-to-resize sidebar (horizontal)
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isSidebarDragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    /* istanbul ignore next -- @preserve mousemove closure; drag events not simulated in unit tests */
    const onMouseMove = (ev: MouseEvent) => {
      if (!isSidebarDragging.current) return;
      const delta = ev.clientX - startX;
      setSidebarWidth(Math.max(240, Math.min(640, startWidth + delta)));
    };

    const onMouseUp = () => {
      isSidebarDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // Drag-to-resize between editor and terminal
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startHeight = terminalHeight;

    /* istanbul ignore next -- @preserve mousemove closure; drag events not simulated in unit tests */
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY - ev.clientY;
      const paneHeight = rightPaneRef.current?.clientHeight ?? 600;
      const newHeight = Math.max(150, Math.min(paneHeight - 200, startHeight + delta));
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight]);

  // Shell callbacks for terminal
  const shellCallbacks = useMemo(() => ({
    onRunCode,
    onRunTests: onRunTests as (code: string, language: string) => Promise<{
      passed: boolean;
      passedTests: number;
      totalTests: number;
      results?: Array<{ passed: boolean; input: string; expectedOutput: string; actualOutput: string; error?: string | null }>;
    }>,
  }), [onRunCode, onRunTests]);

  // Clickable line references in AI messages → navigate editor to that line
  /* istanbul ignore next -- @preserve handleLineClick requires a real Monaco editor instance */
  const handleLineClick = useCallback((line: number) => {
    const editor = editorRef.current as any;
    if (!editor?.revealLineInCenter) return;
    if (isMobile) setMobilePanel('editor');
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  }, [isMobile]);

  const totalTokens = inputTokens + outputTokens;
  const chatDisabled = (isExpired && !showExpiryOverlay) || aiLimitReached;

  return (
    <div style={s.container}>
      {/* Diff decoration CSS for Monaco */}
      <style>{`
        .ruwt-diff-added { background: rgba(63,185,80,0.15) !important; }
        .ruwt-diff-changed { background: rgba(201,169,98,0.15) !important; }
        .ruwt-diff-glyph-added { border-left: 3px solid rgba(63,185,80,0.6); margin-left: 3px; }
        .ruwt-diff-glyph-changed { border-left: 3px solid rgba(201,169,98,0.6); margin-left: 3px; }
        @keyframes ruwt-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
      {/* Main content area */}
      <div style={isMobile ? s.mainRowMobile : s.mainRow}>
        {/* LEFT SIDEBAR: Description/Chat tabs */}
        <div
          role="complementary"
          aria-label="Challenge description and AI chat"
          style={isMobile
          ? { ...s.sidebarMobile, display: mobilePanel === 'sidebar' ? 'flex' : 'none' }
          : { ...s.sidebar, width: sidebarWidth }
        }>
          {/* Tab bar */}
          <div style={s.tabBar} role="tablist" aria-label="Sidebar panels">
            <button
              style={activeTab === 'description' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('description')}
              role="tab"
              aria-selected={activeTab === 'description'}
              aria-controls="panel-description"
            >
              Description
            </button>
            <button
              style={activeTab === 'chat' ? s.tabActive : s.tab}
              onClick={() => { setActiveTab('chat'); setHasUnreadChat(false); }}
              role="tab"
              aria-selected={activeTab === 'chat'}
              aria-controls="panel-chat"
            >
              AI Chat
              {hasUnreadChat && <span style={s.unreadDot} aria-label="unread messages" />}
            </button>
            <button
              style={activeTab === 'discussion' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('discussion')}
              role="tab"
              aria-selected={activeTab === 'discussion'}
              aria-controls="panel-discussion"
            >
              Discussion
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'description' ? (
            <div id="panel-description" role="tabpanel" aria-label="Challenge description" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <DescriptionPanel challenge={challenge} pastAttempts={pastAttempts} notepadContent={notepadContent} onNotepadChange={setNotepadContent} />
            </div>
          ) : activeTab === 'discussion' ? (
            <div id="panel-discussion" role="tabpanel" aria-label="Challenge discussion" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
              <CommentSection
                targetType="challenge"
                targetId={challenge.id}
                apiPath={`/api/challenges/${challenge.id}/comments`}
                promptText="Share your approach or discuss this challenge..."
              />
            </div>
          ) : (
            <div id="panel-chat" role="tabpanel" aria-label="AI Chat" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Mode selector + Clear */}
              <div style={{ borderBottom: `1px solid ${arena.border}`, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}><ModeSelector mode={mode} onModeChange={setMode} disabled={isLoadingChat} /></div>
                {messages.filter(m => m.role !== 'system').length > 0 && (
                  <button onClick={handleClearChat} style={s.clearButton} title="Clear chat">Clear</button>
                )}
              </div>
              {/* Chat messages */}
              <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div
                ref={chatScrollRef}
                style={s.chatScroll}
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
                aria-atomic={false}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
                }}
              >
                {messages.filter((m) => m.role !== 'system').length === 0 && !streamingContent && (
                  <div style={s.chatEmpty}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 12px', width: '100%', maxWidth: 360 }}>
                      <span style={{ color: arena.textSubtle, fontSize: 12, textAlign: 'center', lineHeight: '1.5' }}>
                        Every message costs from your budget. Choose your tier wisely.
                      </span>
                      {[
                        'Write the solution',
                        'What\'s the most efficient approach?',
                        'Fix the failing tests',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          style={{
                            background: arena.surface,
                            border: `1px solid ${arena.border}`,
                            borderRadius: 8,
                            padding: '10px 14px',
                            fontSize: 13,
                            color: arena.text,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.15s',
                          }}
                          onClick={() => setChatInput(prompt)}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = arena.accent)}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = arena.border)}
                        >
                          {prompt}
                        </button>
                      ))}
                      <span style={{ color: arena.textSubtle, fontSize: 11, textAlign: 'center', lineHeight: '1.5', marginTop: 4 }}>
                        {challenge.maxCost
                          ? `Budget: ${formatCost(challenge.maxCost)} \u2014 choose your tier wisely.`
                          : 'Costs tracked for leaderboard ranking.'}
                      </span>
                    </div>
                  </div>
                )}
                {(() => {
                  // Build visible messages with original indices
                  const visible: Array<{ msg: typeof messages[0]; origIdx: number }> = [];
                  messages.forEach((m, idx) => { if (m.role !== 'system') visible.push({ msg: m, origIdx: idx }); });
                  // Find last non-constraint assistant message for retry button
                  let lastAsstVisIdx = -1;
                  for (let j = visible.length - 1; j >= 0; j--) {
                    if (visible[j].msg.role === 'assistant' && !visible[j].msg.isConstraint) { lastAsstVisIdx = j; break; }
                  }
                  return visible.map(({ msg, origIdx }, i) => {
                  if (msg.isConstraint) {
                    return (
                      <div key={origIdx} style={s.constraintMessage}>
                        <span style={s.constraintIcon}>!</span>
                        <span style={s.constraintText}>{msg.content}</span>
                      </div>
                    );
                  }
                  const modelInfo = msg.meta ? getModelById(msg.meta.model) : undefined;
                  const isLastAssistant = i === lastAsstVisIdx;
                  const lineCount = msg.content.split('\n').length;
                  const isLongMsg = msg.role === 'assistant' && lineCount > 12;
                  const isExpanded = isLastAssistant || expandedMessages.has(origIdx);
                  return (
                    <div key={origIdx} style={msg.role === 'user' ? s.userMessage : s.aiMessage}>
                      <div style={s.messageLabel}>
                        <span style={msg.role === 'user' ? s.userLabel : s.aiLabel}>
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </span>
                        {msg.role === 'assistant' && modelInfo && (
                          <span style={s.msgTierBadge}>
                            <span style={{ ...s.tierDot, background: msg.meta!.cost > 0 ? tierColor(modelInfo.tier) : arena.textSubtle }} />
                            {modelInfo.displayName}
                          </span>
                        )}
                        {msg.role === 'assistant' && !msg.isConstraint && (
                          <MessageCopyButton content={msg.content} />
                        )}
                        {msg.role === 'user' && !isLoadingChat && (
                          <button
                            onClick={() => {
                              setChatInput(msg.content);
                              setMessages(prev => prev.slice(0, origIdx));
                              messageQueueRef.current = [];
                              setQueueLength(0);
                              setTimeout(() => chatTextareaRef.current?.focus(), 0);
                            }}
                            style={s.editButton}
                            title="Edit and resend"
                          >
                            &#9998;
                          </button>
                        )}
                      </div>
                      {msg.role === 'assistant' && msg.thinking && (
                        <ThinkingBlock text={msg.thinking} />
                      )}
                      {msg.role === 'assistant' ? (
                        <>
                          <div style={{
                            ...s.aiContent,
                            ...(isLongMsg && !isExpanded ? { maxHeight: '10em', overflow: 'hidden', position: 'relative' as const } : {}),
                          }}>
                            {renderMarkdown(msg.content, handleLineClick)}
                          </div>
                          {isLongMsg && !isExpanded && (
                            <button
                              onClick={() => setExpandedMessages(prev => new Set(prev).add(origIdx))}
                              style={s.showMoreButton}
                            >
                              Show more ({lineCount} lines)
                            </button>
                          )}
                          {isLongMsg && isExpanded && !isLastAssistant && (
                            <button
                              onClick={() => setExpandedMessages(prev => { const n = new Set(prev); n.delete(origIdx); return n; })}
                              style={s.showMoreButton}
                            >
                              Show less
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={s.userContent}>{renderMarkdown(msg.content)}</div>
                      )}
                      {msg.meta && (
                        <div style={s.msgCostLine}>
                          {modelInfo?.displayName || 'AI'} {'\u00B7'} {msg.meta.tokens.toLocaleString()} {msg.meta.tokens === 1 ? 'token' : 'tokens'} {'\u00B7'} {formatCost(msg.meta.cost)}
                        </div>
                      )}
                      {msg.role === 'assistant' && isLastAssistant && !isLoadingChat && (
                        <button
                          onClick={handleRetry}
                          style={s.retryButton}
                          title="Retry this response"
                        >
                          &#8635; Retry
                        </button>
                      )}
                    </div>
                  );
                });
                })()}
                {/* Tool loop indicator */}
                {isToolLooping && !streamingContent && !isThinkingPhase && (
                  <div style={{ ...s.aiMessage, opacity: 0.7 }}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={s.streamingDot}>{'\u25CF'}</span>
                      <span style={{ fontSize: 10, color: arena.accent }}>
                        Running tests...
                      </span>
                    </div>
                  </div>
                )}
                {/* Thinking phase — reasoning model is producing chain-of-thought */}
                {isThinkingPhase && streamingThinking && (
                  <div style={s.aiMessage}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={{ animation: 'ruwt-pulse 1.2s ease-in-out infinite', fontSize: 8, color: '#a78bfa' }}>{'\u25CF'}</span>
                      <span style={{ fontSize: 10, color: '#a78bfa' }}>
                        {getModelById(model)?.displayName || 'AI'} reasoning...
                      </span>
                    </div>
                    <ThinkingBlock text={streamingThinking} isStreaming />
                  </div>
                )}
                {/* Content phase — answer is streaming */}
                {streamingContent && (
                  <div style={s.aiMessage}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={s.streamingDot}>{'\u25CF'}</span>
                      <span style={{ fontSize: 10, color: arena.textSubtle }}>
                        {getModelById(model)?.displayName || 'AI'} {isToolLooping ? 'fixing...' : 'responding...'}
                      </span>
                    </div>
                    {streamingThinking && <ThinkingBlock text={streamingThinking} />}
                    <div style={s.aiContent}>{renderMarkdown(streamingContent, handleLineClick)}</div>
                  </div>
                )}
                {/* Waiting — model is processing (e.g. non-streaming GPT-OSS) */}
                {isLoadingChat && !streamingContent && !streamingThinking && !isThinkingPhase && !isToolLooping && (
                  <div style={{ ...s.aiMessage, opacity: 0.7 }}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={{ animation: 'ruwt-pulse 1.2s ease-in-out infinite', fontSize: 8, color: arena.textSubtle }}>{'\u25CF'}</span>
                      <span style={{ fontSize: 10, color: arena.textSubtle }}>
                        {getModelById(model)?.displayName || 'AI'} processing...
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Scroll to bottom button */}
              {showScrollBtn && (
                <button
                  onClick={() => {
                    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
                    setShowScrollBtn(false);
                  }}
                  style={s.scrollToBottomBtn}
                  title="Scroll to bottom"
                >
                  {'\u2193'}
                </button>
              )}
              </div>

              {/* Model selector — 5 tiers (star = recommended for this difficulty) */}
              <div style={isMobile ? s.tierBarMobile : s.tierBar} role="radiogroup" aria-label="Model tier selector">
                {(['micro', 'budget', 'mid', 'premium', 'reasoning'] as ModelTier[]).map((tier) => {
                  const m = TIER_MODELS[tier];
                  const isActive = selectedTier === tier;
                  const tc = tierColor(tier);
                  const modelsInTier = getModelsForTier(tier);
                  const hasMultiple = modelsInTier.length > 1;
                  const diffToTier: Record<string, ModelTier> = {
                    sprint: 'micro', easy: 'budget', medium: 'mid', hard: 'premium', impossible: 'reasoning',
                  };
                  const isRecommended = tier === (diffToTier[challenge.difficulty] || 'budget');
                  return (
                    <div key={tier} style={isMobile
                      ? { position: 'relative', minWidth: 80, flexShrink: 0 }
                      : { position: 'relative', flex: 1 }
                    }>
                      <button
                        style={{
                          ...s.tierPill,
                          width: '100%',
                          background: isActive ? `${tc}20` : 'transparent',
                          borderColor: isActive ? tc : isRecommended ? `${arena.accent}60` : arena.border,
                          color: isActive ? tc : arena.textMuted,
                          opacity: isLoadingChat ? 0.5 : 1,
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                        role="radio"
                        aria-checked={isActive}
                        aria-expanded={isActive && hasMultiple ? tierDropdownOpen : undefined}
                        aria-label={`${tierLabel(tier)} tier — ${m.displayName}${isRecommended ? ` (recommended for ${challenge.difficulty})` : ''}`}
                        title={`${tierLabel(tier)} tier — ${m.displayName}${isRecommended ? ` (recommended for ${challenge.difficulty})` : ''}`}
                        disabled={isLoadingChat}
                        onClick={() => {
                          if (isActive && hasMultiple) {
                            setTierDropdownOpen(!tierDropdownOpen);
                          } else {
                            setSelectedTier(tier);
                            setModel(m.id);
                            setTierDropdownOpen(false);
                          }
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {tierLabel(tier)}
                          {isRecommended && <span style={{ fontSize: 8, marginLeft: 2, color: arena.accent }}>{'\u2605'}</span>}
                          {hasMultiple && isActive && <span style={{ fontSize: 7, marginLeft: 2 }}>{'\u25BC'}</span>}
                        </span>
                        <span style={{ fontSize: 8, color: arena.textSubtle, fontWeight: 400, whiteSpace: 'nowrap' }}>
                          ~{formatCostFromHundredths(estimateTypicalMessageCost(tier))}/msg
                        </span>
                      </button>
                      {isActive && tierDropdownOpen && hasMultiple && (
                        <div style={s.tierDropdown} role="listbox" aria-label={`${tierLabel(tier)} tier models`}>
                          {modelsInTier.map((mi) => (
                            <button
                              key={mi.id}
                              role="option"
                              aria-selected={model === mi.id}
                              aria-disabled={disabledModels.has(mi.id)}
                              style={{
                                ...s.tierDropdownItem,
                                background: model === mi.id ? `${tc}15` : 'transparent',
                                color: disabledModels.has(mi.id) ? arena.textSubtle : model === mi.id ? tc : arena.text,
                                opacity: disabledModels.has(mi.id) ? 0.5 : 1,
                                cursor: disabledModels.has(mi.id) ? 'not-allowed' : 'pointer',
                              }}
                              onClick={() => {
                                if (disabledModels.has(mi.id)) return;
                                setModel(mi.id);
                                setTierDropdownOpen(false);
                              }}
                            >
                              <span style={{ fontWeight: 500 }}>{mi.displayName}</span>
                              <span style={{ fontSize: 10, color: arena.textSubtle }}>{mi.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Chat input */}
              <div style={{ ...s.chatInputWrap, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <textarea
                    ref={chatTextareaRef}
                    style={{
                      ...(isMobile ? { ...s.chatInput, padding: '10px 14px', fontSize: 16 } : s.chatInput),
                      resize: 'none' as const,
                      minHeight: 34,
                      maxHeight: 120,
                      overflow: 'auto',
                      lineHeight: '1.4',
                    }}
                    rows={1}
                    placeholder={guestMode ? 'Sign up to chat with AI' : chatDisabled ? (aiLimitReached ? 'AI limit reached \u2014 budget exhausted' : 'Chat disabled \u2014 time expired') : 'Ask about this problem... (Shift+Enter for newline)'}
                    aria-label="Chat message"
                    aria-describedby="chat-cost-estimate"
                    data-testid="chat-input"
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={handleInputKeyDown}
                    disabled={chatDisabled || !!guestMode}
                  />
                  {/* Pre-call cost estimate + running total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 2, paddingRight: 2 }}>
                    <span id="chat-cost-estimate" style={{ fontSize: 10, color: arena.textSubtle, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
                      {chatInput.trim() && !chatDisabled && !guestMode
                        ? `${formatEstimatedCost(estimateChatCost(chatInput, model))} est`
                        : '\u00A0'}
                    </span>
                    {(inputTokens + outputTokens > 0) && (
                      <span style={{ fontSize: 10, color: arena.textSubtle, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
                        {(inputTokens + outputTokens).toLocaleString()} tok {'\u00B7'} {formatCost(totalCost)}
                      </span>
                    )}
                  </div>
                  {queueLength > 0 && isLoadingChat && (
                    <span style={{ fontSize: 10, color: arena.accent, fontFamily: 'Menlo, Monaco, "Courier New", monospace', paddingLeft: 2 }}>
                      {queueLength} message{queueLength > 1 ? 's' : ''} queued
                    </span>
                  )}
                </div>
                {isLoadingChat ? (
                  <button
                    style={{
                      ...s.sendButton,
                      background: 'rgba(248,81,73,0.12)',
                      borderColor: 'rgba(248,81,73,0.3)',
                      color: arena.error,
                      alignSelf: 'flex-start',
                    }}
                    onClick={handleStopChat}
                    title="Stop generating"
                    aria-label="Stop generating"
                  >
                    &#9632;
                  </button>
                ) : (
                  <button
                    style={{
                      ...s.sendButton,
                      opacity: !chatInput.trim() || chatDisabled || guestMode ? 0.4 : 1,
                      alignSelf: 'flex-start',
                    }}
                    onClick={() => sendMessage()}
                    disabled={!chatInput.trim() || chatDisabled || !!guestMode}
                    aria-label="Send message"
                  >
                    &#9658;
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar resize handle */}
        {!isMobile && <div style={s.sidebarDragHandle} onMouseDown={handleSidebarDragStart} />}

        {/* RIGHT PANE: Editor + Terminal */}
        <div ref={rightPaneRef} role="region" aria-label="Code editor and terminal" style={isMobile
          ? { ...s.rightPane, display: mobilePanel === 'editor' ? 'flex' : 'none' }
          : s.rightPane
        }>
          {/* Editor */}
          <div style={s.editorWrap} role="region" aria-label="Code editor">
            <CodeUpdateToast visible={showToast} message={toastMessage} />
            <PasteBlockedToast visible={showPasteBlocked} />
            <ApplyFailureToast visible={showApplyFailure} onDismiss={() => setShowApplyFailure(false)} />
            <ModelUnavailableToast visible={showModelUnavailable} message={modelUnavailableMsg} onDismiss={() => setShowModelUnavailable(false)} />
            <Suspense fallback={
              <div style={s.editorLoading}>
                <span style={{ color: arena.textMuted, fontSize: 13 }}>Loading editor...</span>
              </div>
            }>
              <MonacoEditor
                height="100%"
                language={language}
                value={code}
                onChange={handleEditorChange}
                onMount={(editor: any) => {
                  editorRef.current = editor;
                  // Paste prevention — capture phase blocks before Monaco handles it
                  const dom = editor.getDomNode?.();
                  if (dom) {
                    dom.addEventListener('paste', (e: ClipboardEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      showPasteBlockedToast();
                    }, true);
                  }
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: isMobile ? 13 : 14,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  lineNumbers: isMobile ? ('off' as const) : ('on' as const),
                  renderLineHighlight: 'line' as const,
                  scrollBeyondLastLine: false,
                  padding: { top: 8 },
                  automaticLayout: true,
                  wordWrap: isMobile ? ('on' as const) : ('off' as const),
                  folding: isMobile ? false : true,
                  glyphMargin: isMobile ? false : true,
                  lineDecorationsWidth: isMobile ? 0 : 10,
                  // Disable aggressive autocomplete — it mangles .catch(), async patterns,
                  // causing SyntaxErrors that confuse users writing Promise/async code.
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: 'off' as const,
                  tabCompletion: 'off' as const,
                  parameterHints: { enabled: false },
                }}
              />
            </Suspense>
          </div>

          {/* Drag handle — hidden on mobile */}
          {!isMobile && (
            <div
              style={s.dragHandle}
              onMouseDown={handleDragStart}
            />
          )}

          {/* Terminal */}
          <div style={{
            ...s.terminalWrap,
            height: terminalCollapsed
              ? 28
              : isMobile
                ? (terminalExpanded ? '60vh' : 180)
                : terminalHeight,
            minHeight: terminalCollapsed ? 28 : 150,
            overflow: terminalCollapsed ? 'hidden' : undefined,
          }}>
            <div style={s.terminalHeader}>
              <span style={s.terminalHeaderText}>Terminal</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isMobile && !terminalCollapsed && (
                  <button
                    style={s.terminalToggleBtn}
                    onClick={() => setTerminalExpanded(!terminalExpanded)}
                  >
                    {terminalExpanded ? '\u25BC Shrink' : '\u25B2 Expand'}
                  </button>
                )}
                <button
                  style={s.terminalToggleBtn}
                  onClick={() => setTerminalCollapsed(!terminalCollapsed)}
                >
                  {terminalCollapsed ? '\u25B2' : '\u25BC'}
                </button>
              </div>
            </div>
            <TerminalPanel
              ref={terminalRef}
              fs={fs}
              language={language}
              attemptId={attemptId}
              challengeTitle={challenge.title}
              challengeDescription={challenge.description}
              challengeDifficulty={challenge.difficulty}
              challengeCategory={challenge.category || null}
              challengeTestCases={challenge.testCases || '[]'}
              hiddenTestCount={challenge.hiddenTestCount}
              readonlyPrefix={challenge.readonlyPrefix || null}
              shellCallbacks={shellCallbacks}
              streamChat={streamChat}
              abortChat={abortChat}
              onCodeApplied={handleTerminalCodeApplied}
              onRunTests={onRunTests}
              isExpired={() => isExpiredRef.current}
            />
          </div>
        </div>
      </div>

      {/* First-attempt nudge — shown when no messages sent and no code written */}
      {!nudgeDismissed && messages.length === 0 && code === (challenge.starterCode || '// your code here') && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? 60 : 16,
          left: isMobile ? 16 : '50%',
          right: isMobile ? 16 : undefined,
          transform: isMobile ? undefined : 'translateX(-50%)',
          background: arena.surface,
          border: `1px solid ${arena.accent}40`,
          borderRadius: 10,
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 40,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          animation: 'nudge-fade-in 0.3s ease',
        }}>
          <style>{`@keyframes nudge-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <span style={{ fontSize: 16 }}>{'\u{1F4AC}'}</span>
          <span style={{ fontSize: 13, color: arena.text, flex: 1 }}>
            Start by asking the AI to help you solve this problem
            <span style={{ display: 'block', fontSize: 11, color: arena.textMuted, marginTop: 2 }}>
              First message costs ~$0.001 with Budget tier
            </span>
          </span>
          <button
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 6,
              color: '#0d1117',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              setActiveTab('chat');
              if (isMobile) setMobilePanel('sidebar');
              setNudgeDismissed(true);
            }}
          >
            Open Chat
          </button>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label="Dismiss nudge"
            style={{ background: 'transparent', border: 'none', color: arena.textMuted, fontSize: 14, cursor: 'pointer', padding: '0 4px' }}
          >
            {'\u00D7'}
          </button>
        </div>
      )}

      {/* Test results bar */}
      {testResults && <ResultsBar results={testResults} hiddenTestCount={challenge.hiddenTestCount} onDismiss={onDismissResults} onAskAI={(prompt) => {
        // Inject test results into AI context and switch to debug mode
        pendingTestContextRef.current = testResults as AITestResults;
        setMode('debug');
        setChatInput(prompt);
        setActiveTab('chat');
        if (isMobile) setMobilePanel('sidebar');
        setNudgeDismissed(true);
      }} />}

      {/* Mobile floating bottom tab bar */}
      {isMobile && (
        <div style={s.mobileFloatingBar}>
          <button
            style={mobilePanel === 'sidebar' ? s.mobileFloatingTabActive : s.mobileFloatingTab}
            onClick={() => { setMobilePanel('sidebar'); }}
          >
            <span>{activeTab === 'chat' ? 'AI Chat' : activeTab === 'discussion' ? 'Discussion' : 'Description'}</span>
            {hasUnreadChat && mobilePanel === 'editor' && <span style={s.mobileUnreadDot} />}
          </button>
          <button
            style={mobilePanel === 'editor' ? s.mobileFloatingTabActive : s.mobileFloatingTab}
            onClick={() => setMobilePanel('editor')}
          >
            <span>Editor</span>
          </button>
        </div>
      )}

      {/* Expiry overlay */}
      {showExpiryOverlay && (
        <ExpiryOverlay
          totalTokens={totalTokens}
          totalCost={totalCost}
          isMobile={isMobile}
          onReview={() => setShowExpiryOverlay(false)}
          onRestart={onRestart}
        />
      )}

      {/* Stats moved to header in ArenaScreen */}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    background: arena.bg,
    color: arena.text,
    overflow: 'hidden',
    height: '100%',
    position: 'relative',
  },

  // Main layout
  mainRow: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mainRowMobile: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },

  // Left sidebar
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    width: 420,
    minWidth: 300,
    maxWidth: 640,
    flexShrink: 0,
  },
  sidebarMobile: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    width: '100%',
  },

  // Right pane: editor + terminal
  rightPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 3,
    minWidth: 0,
  },

  // Editor
  editorWrap: {
    flex: 1,
    position: 'relative',
    minHeight: 200,
  },
  editorLoading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: arena.bg,
  },

  // Toast notification
  toast: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 20,
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    color: arena.text,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },

  // Drag handle between editor and terminal
  dragHandle: {
    height: 4,
    background: arena.surface,
    cursor: 'row-resize',
    flexShrink: 0,
    borderTop: `1px solid ${arena.border}`,
    borderBottom: `1px solid ${arena.border}`,
  },

  // Terminal
  terminalWrap: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 150,
    flexShrink: 0,
  },
  terminalHeader: {
    padding: '3px 12px',
    background: arena.surface,
    borderBottom: `1px solid ${arena.border}`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  terminalHeaderText: {
    fontSize: 11,
    fontWeight: 600,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  terminalToggleBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },

  // Tab bar
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${arena.border}`,
    background: arena.surface,
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: arena.textMuted,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    position: 'relative' as const,
  },
  tabActive: {
    flex: 1,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    color: arena.accent,
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${arena.accent}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
    position: 'relative' as const,
  },
  unreadDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: 3,
    background: arena.accent,
    marginLeft: 6,
    verticalAlign: 'middle',
  },

  // Description panel
  descriptionScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '16px 18px',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: '1.6',
    color: arena.text,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: arena.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 10,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  exampleBlock: {
    marginBottom: 12,
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 6,
    padding: '10px 12px',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 12,
  },
  exampleLabel: {
    color: arena.textMuted,
    marginBottom: 2,
    fontSize: 11,
  },
  exampleValue: {
    color: arena.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  constraintsList: {
    fontSize: 12,
    color: arena.textMuted,
    lineHeight: '1.8',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },

  // Chat panel
  chatScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
  },
  chatEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 100,
  },

  // Messages
  userMessage: {
    marginBottom: 16,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'rgba(201,169,98,0.08)',
  },
  aiMessage: {
    marginBottom: 16,
    padding: '0 2px',
  },
  constraintMessage: {
    marginBottom: 16,
    padding: '8px 12px',
    borderRadius: 6,
    background: 'rgba(248,81,73,0.08)',
    border: `1px solid rgba(248,81,73,0.2)`,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  constraintIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 9999,
    background: arena.error,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
  },
  constraintText: {
    fontSize: 13,
    lineHeight: '1.5',
    color: arena.error,
  },
  messageLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: arena.accent,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  streamingDot: {
    fontSize: 8,
    color: arena.accent,
  },
  userContent: {
    fontSize: 13,
    lineHeight: '1.5',
    color: arena.text,
  },
  aiContent: {
    fontSize: 13,
    lineHeight: '1.5',
    color: arena.text,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },

  // Tier selector
  tierBar: {
    display: 'flex',
    gap: 3,
    padding: '6px 6px',
    borderTop: `1px solid ${arena.border}`,
    background: arena.surface,
    flexShrink: 0,
  },
  tierBarMobile: {
    display: 'flex',
    gap: 3,
    padding: '6px 6px',
    borderTop: `1px solid ${arena.border}`,
    background: arena.surface,
    flexShrink: 0,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  } as React.CSSProperties,
  tierPill: {
    flex: 1,
    padding: '3px 2px',
    fontSize: 11,
    borderRadius: 6,
    border: `1px solid ${arena.border}`,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 1,
  },

  // Tier dropdown
  tierDropdown: {
    position: 'absolute' as const,
    bottom: '100%',
    left: 0,
    right: 0,
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 6,
    marginBottom: 4,
    zIndex: 30,
    overflow: 'hidden',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
  },
  tierDropdownItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    padding: '6px 10px',
    fontSize: 11,
    border: 'none',
    borderBottom: `1px solid ${arena.border}`,
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textAlign: 'left' as const,
    width: '100%',
  },

  // Per-message cost
  msgCostLine: {
    fontSize: 10,
    color: arena.textSubtle,
    marginTop: 4,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  msgTierBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  tierDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  retryButton: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 11,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    marginTop: 4,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'color 0.15s, border-color 0.15s',
  },

  // Chat input
  chatInputWrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    borderTop: `1px solid ${arena.border}`,
    background: arena.surface,
    gap: 8,
    flexShrink: 0,
  },
  chatInput: {
    flex: 1,
    background: arena.bg,
    border: `1px solid ${arena.border}`,
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    color: arena.text,
    fontFamily: 'inherit',
  },
  sendButton: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 6,
    color: arena.accent,
    fontSize: 16,
    width: 34,
    height: 34,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mobile floating bottom tab bar
  mobileFloatingBar: {
    display: 'flex',
    gap: 8,
    padding: '6px 16px',
    paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
    background: arena.surface,
    borderTop: `1px solid ${arena.border}`,
    flexShrink: 0,
  },
  mobileFloatingTab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '8px 0',
    fontSize: 11,
    fontWeight: 500,
    color: arena.textMuted,
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    position: 'relative' as const,
  },
  mobileFloatingTabActive: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '8px 0',
    fontSize: 11,
    fontWeight: 600,
    color: arena.accent,
    background: arena.accentBg,
    border: `1px solid ${arena.accent}`,
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    position: 'relative' as const,
  },
  mobileUnreadDot: {
    position: 'absolute' as const,
    top: 4,
    right: '25%',
    width: 7,
    height: 7,
    borderRadius: 4,
    background: arena.accent,
    border: `1.5px solid ${arena.surface}`,
  },

  // Clear chat button
  clearButton: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '3px 8px',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    marginRight: 10,
    flexShrink: 0,
    transition: 'color 0.15s, border-color 0.15s',
  },

  // Edit/resend button on user messages
  editButton: {
    background: 'transparent',
    border: 'none',
    color: arena.textMuted,
    fontSize: 13,
    padding: '0 4px',
    cursor: 'pointer',
    marginLeft: 'auto',
    opacity: 0.5,
    transition: 'opacity 0.15s',
    lineHeight: 1,
  },

  // Show more/less button for collapsed messages
  showMoreButton: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    marginTop: 4,
    transition: 'color 0.15s, border-color 0.15s',
  },

  // Scroll-to-bottom floating button
  scrollToBottomBtn: {
    position: 'absolute' as const,
    bottom: 8,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    color: arena.text,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    zIndex: 10,
    transition: 'background 0.15s',
  },

  // Sidebar drag handle
  sidebarDragHandle: {
    width: 4,
    cursor: 'col-resize',
    flexShrink: 0,
    background: arena.surface,
    borderLeft: `1px solid ${arena.border}`,
    borderRight: `1px solid ${arena.border}`,
    transition: 'background 0.15s',
  },

};
