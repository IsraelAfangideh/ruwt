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
import { TIER_MODELS, getModelById, getModelsForTier, tierColor, tierLabel, type ModelTier } from '@/lib/ai/pricing';

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

/* ─── Simple Markdown Renderer ────────────────────────────────────── */

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={mdStyles.codeBlock}>
      <div style={mdStyles.codeHeader}>
        {lang && <span style={mdStyles.codeLang}>{lang}</span>}
        <button onClick={handleCopy} style={mdStyles.copyBtn}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={mdStyles.codePre}>{code}</pre>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(<CodeBlock key={blocks.length} lang={lang} code={codeLines.join('\n')} />);
      continue;
    }

    // headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const headingStyle = level === 1 ? mdStyles.h1 : level === 2 ? mdStyles.h2 : mdStyles.h3;
      blocks.push(
        <div key={blocks.length} style={headingStyle}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // unordered list item
    if (/^[\-\*]\s+/.test(line)) {
      blocks.push(
        <div key={blocks.length} style={mdStyles.listItem}>
          <span style={mdStyles.listBullet}>{'\u2022'}</span>
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // ordered list item
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] || '1';
      blocks.push(
        <div key={blocks.length} style={mdStyles.listItem}>
          <span style={mdStyles.listNum}>{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // regular line — parse inline elements
    blocks.push(
      <div key={blocks.length} style={mdStyles.paragraph}>
        {renderInline(line)}
      </div>
    );
    i++;
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // match **bold**, *italic*/_italic_, `code`, and [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={parts.length}>{text.slice(last, match.index)}</span>);
    }
    if (match[2]) {
      // bold
      parts.push(<strong key={parts.length}>{match[2]}</strong>);
    } else if (match[3]) {
      // italic with *
      parts.push(<em key={parts.length}>{match[3]}</em>);
    } else if (match[4]) {
      // italic with _
      parts.push(<em key={parts.length}>{match[4]}</em>);
    } else if (match[5]) {
      // inline code
      parts.push(
        <code key={parts.length} style={mdStyles.inlineCode}>{match[5]}</code>
      );
    } else if (match[6] && match[7]) {
      // link
      parts.push(
        <a key={parts.length} href={match[7]} target="_blank" rel="noopener noreferrer" style={mdStyles.link}>
          {match[6]}
        </a>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<span key={parts.length}>{text.slice(last)}</span>);
  }
  return parts.length ? parts : [<span key={0}>{text || '\u00A0'}</span>];
}

const mdStyles: Record<string, React.CSSProperties> = {
  codeBlock: {
    background: '#0d1117',
    borderRadius: 6,
    margin: '6px 0',
    overflow: 'hidden',
    border: `1px solid ${arena.border}`,
    position: 'relative',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    borderBottom: `1px solid ${arena.border}`,
    minHeight: 24,
  },
  codeLang: {
    fontSize: 11,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  copyBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  codePre: {
    margin: 0,
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: '1.45',
    color: arena.text,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  inlineCode: {
    background: 'rgba(240,246,252,0.08)',
    padding: '2px 5px',
    borderRadius: 3,
    fontSize: '0.9em',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  link: {
    color: arena.accent,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  paragraph: {
    lineHeight: '1.5',
    minHeight: '1.2em',
  },
  h1: { fontSize: 18, fontWeight: 700, lineHeight: '1.4', margin: '16px 0 8px', color: arena.text },
  h2: { fontSize: 16, fontWeight: 600, lineHeight: '1.4', margin: '12px 0 6px', color: arena.text },
  h3: { fontSize: 14, fontWeight: 600, lineHeight: '1.4', margin: '10px 0 4px', color: arena.text },
  listItem: { display: 'flex', gap: 8, lineHeight: '1.5', paddingLeft: 4 },
  listBullet: { color: arena.textMuted, flexShrink: 0, width: 12 },
  listNum: { color: arena.textMuted, flexShrink: 0, width: 16, textAlign: 'right' as const },
};

/* ─── Constraint violation messages ──────────────────────────────── */

const constraintMessages: Record<string, string> = {
  time: 'Time limit reached \u2014 you can review your code but can\'t make more AI requests.',
  tokens: 'Token limit reached for this attempt.',
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
  starterCode: string | null;
  testCases: string;
  maxTokens: number | null;
  maxCost: number | null;
  wallClockLimit: number | null;
  expiresAt?: string | null;
}

export interface ArenaAttempt {
  id: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  status: string;
  expiresAt: string | null;
}

export interface TestResults {
  passed: boolean;
  passedTests: number;
  totalTests: number;
  results: Array<{ passed: boolean; input: string; expectedOutput: string; actualOutput: string; error?: string }>;
  isSubmission: boolean;
}

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
  attempt: ArenaAttempt;
  userCredits: number;
  code: string;
  onCodeChange: (code: string) => void;
  language: string;
  onRunTests: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number; results?: unknown[] }>;
  onSubmit: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number }>;
  onAttemptUpdate?: (attempt: ArenaAttempt) => void;
  onRestart?: () => void;
  onRunCode: (sourceCode: string, language: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  testResults?: TestResults | null;
  onDismissResults?: () => void;
  pastAttempts?: PastAttempt[];
}

/* ─── Code extraction helper ─────────────────────────────────────── */

function extractBestCodeBlock(text: string, language: string): string | null {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let bestMatch: string | null = null;
  let bestLangMatch: string | null = null;
  let bestLen = 0;
  let bestLangLen = 0;

  while ((match = regex.exec(text)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2];
    if (code.length > bestLen) {
      bestMatch = code;
      bestLen = code.length;
    }
    if ((lang === language || lang === '') && code.length > bestLangLen) {
      bestLangMatch = code;
      bestLangLen = code.length;
    }
  }
  return bestLangMatch ?? bestMatch;
}

/* ─── Notification Toast ─────────────────────────────────────────── */

function CodeUpdateToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={s.toast}>
      <span style={{ color: arena.success }}>{'\u2713'}</span> Code updated
    </div>
  );
}

/* ─── Results Bar ────────────────────────────────────────────────── */

function ResultsBar({ results, onDismiss }: { results: TestResults; onDismiss?: () => void }) {
  const [expanded, setExpanded] = useState(!results.passed); // auto-expand on failure
  const allPassed = results.passed;
  const barBg = allPassed ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)';
  const barBorder = allPassed ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)';
  const barColor = allPassed ? arena.success : arena.error;

  return (
    <div style={{ borderTop: `1px solid ${barBorder}`, background: barBg, flexShrink: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', minHeight: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: barColor, fontWeight: 700, fontSize: 13, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
            {allPassed ? '\u2713' : '\u2717'} {results.passedTests}/{results.totalTests} passed
          </span>
          {results.isSubmission && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: barColor,
              padding: '1px 8px', borderRadius: 9999,
              border: `1px solid ${barBorder}`, background: barBg,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}>
              {allPassed ? 'Submitted \u2014 Passed!' : 'Submitted \u2014 Failed'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent', border: `1px solid ${arena.border}`,
              borderRadius: 4, color: arena.textMuted, fontSize: 10,
              padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}
          >
            {expanded ? '\u25B2 Hide' : '\u25BC Details'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent', border: 'none', color: arena.textMuted,
                fontSize: 14, cursor: 'pointer', padding: '0 4px',
              }}
            >
              \u00D7
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 8px', fontSize: 12, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
          {results.results.map((r, i) => (
            <div key={i} style={{
              padding: '4px 0', borderTop: i > 0 ? `1px solid ${arena.border}` : undefined,
              color: r.passed ? arena.success : arena.error,
            }}>
              <span>{r.passed ? '\u2713' : '\u2717'} Test {i + 1}: </span>
              <span style={{ color: arena.textMuted }}>
                {r.input.length > 40 ? r.input.slice(0, 40) + '...' : r.input}
              </span>
              {!r.passed && (
                <div style={{ color: arena.textMuted, paddingLeft: 16, fontSize: 11, marginTop: 2 }}>
                  expected <span style={{ color: arena.success }}>{r.expectedOutput}</span>
                  {' '}got <span style={{ color: arena.error }}>{r.actualOutput || '(empty)'}</span>
                  {r.error && <div style={{ color: arena.error, marginTop: 2 }}>{r.error}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function PastAttemptsSection({ attempts: pastAttempts }: { attempts: PastAttempt[] }) {
  if (!pastAttempts.length) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={s.sectionLabel}>Past Attempts</div>
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

function DescriptionPanel({ challenge, pastAttempts }: { challenge: ArenaChallenge; pastAttempts?: PastAttempt[] }) {
  let testCases: Array<{ input: string; expectedOutput: string }> = [];
  try {
    testCases = JSON.parse(challenge.testCases);
  } catch { /* ignore */ }
  const examples = testCases.slice(0, 2);

  return (
    <div style={s.descriptionScroll}>
      <div style={s.descriptionText}>
        {renderMarkdown(challenge.description)}
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
        </div>
      )}

      {(challenge.maxTokens != null || challenge.maxCost != null || challenge.wallClockLimit != null) && (
        <div style={{ marginTop: 20 }}>
          <div style={s.sectionLabel}>Constraints</div>
          <div style={s.constraintsList}>
            {challenge.wallClockLimit != null && <div>Time limit: {formatTime(challenge.wallClockLimit)}</div>}
            {challenge.maxTokens != null && <div>Max tokens: {challenge.maxTokens.toLocaleString()}</div>}
            {challenge.maxCost != null && <div>Max cost: ${(challenge.maxCost / 10000).toFixed(2)}</div>}
          </div>
        </div>
      )}

      {pastAttempts && <PastAttemptsSection attempts={pastAttempts} />}
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────── */

export function ArenaIDE({
  challenge,
  attempt,
  code,
  onCodeChange,
  language,
  onAttemptUpdate,
  onRestart,
  onRunTests,
  onRunCode,
  testResults,
  onDismissResults,
  pastAttempts,
}: ArenaIDEProps) {
  const [totalCost, setTotalCost] = useState(attempt.totalCost);
  const [inputTokens, setInputTokens] = useState(attempt.inputTokens);
  const [outputTokens, setOutputTokens] = useState(attempt.outputTokens);
  const [messages, setMessages] = useState<{ role: 'system' | 'user' | 'assistant'; content: string; isConstraint?: boolean; meta?: MessageMeta }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [model, setModel] = useState('@cf/meta/llama-3.1-8b-instruct');
  const [selectedTier, setSelectedTier] = useState<ModelTier>('budget');
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showExpiryOverlay, setShowExpiryOverlay] = useState(false);
  const [aiLimitReached, setAiLimitReached] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'chat'>('description');
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);

  const activeTabRef = useRef<'description' | 'chat'>('description');
  activeTabRef.current = activeTab;
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<unknown>(null);
  const terminalRef = useRef<TerminalPanelHandle>(null);
  const isExpiredRef = useRef(false);
  isExpiredRef.current = isExpired;
  const isDragging = useRef(false);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const attemptId = attempt.id;
  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;

  // Virtual filesystem
  const fs = useMemo(() => new VirtualFileSystem(language, code), []);

  // Bidirectional sync: Monaco <-> VFS
  const { handleEditorChange } = useCodeSync(editorRef as React.RefObject<never>, fs, onCodeChange);

  // AI chat hook
  const handleCostUpdate = useCallback((cost: number, inTok: number, outTok: number) => {
    setTotalCost((prev) => prev + cost);
    setInputTokens((prev) => prev + inTok);
    setOutputTokens((prev) => prev + outTok);
    if (onAttemptUpdate) {
      onAttemptUpdate({
        ...attempt,
        totalCost: attempt.totalCost + cost,
        inputTokens: attempt.inputTokens + inTok,
        outputTokens: attempt.outputTokens + outTok,
      });
    }
  }, [attempt, onAttemptUpdate]);

  const { streamChat, abort: abortChat } = useAIChat({
    attemptId,
    model,
    onCostUpdate: handleCostUpdate,
  });

  // Show toast notification
  const flashToast = useCallback(() => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }, []);

  // Auto-apply code from AI response
  const applyCodeFromResponse = useCallback((responseText: string) => {
    const codeBlock = extractBestCodeBlock(responseText, language);
    if (codeBlock) {
      fs.setSolutionCode(codeBlock);
      flashToast();
    }
  }, [language, fs, flashToast]);

  // Handle code applied from terminal (RuwtTUI)
  const handleTerminalCodeApplied = useCallback(() => {
    flashToast();
  }, [flashToast]);

  // Build system prompt with current code — agentic style (Cursor-like)
  const buildSystemPrompt = useCallback(() => {
    const currentCode = fs.getSolutionCode();
    return `You are a coding agent. You write code, not explanations.

Challenge: "${challenge.title}" (${challenge.difficulty})
Language: ${language}

Description:
${challenge.description}

Current code:
\`\`\`${language}
${currentCode}
\`\`\`

Rules:
- Output the COMPLETE updated file in a single \`\`\`${language} code block. No partial snippets.
- Be extremely concise. 1-2 sentences max before/after the code block if needed.
- Do NOT explain the approach step-by-step. Do NOT list time/space complexity.
- Do NOT use headings, numbered lists, or bullet points.
- If the user says "solve it" or similar, just write the solution directly.
- If debugging, state the bug in one line, then provide the fixed code.
- Think of yourself as a pair programmer who writes code, not a tutor who explains.`;
  }, [challenge.title, challenge.difficulty, challenge.description, language, fs]);

  // Timer (expiry detection only — display moved to ArenaScreen header)
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      if (left === 0 && !isExpiredRef.current) {
        setIsExpired(true);
        isExpiredRef.current = true;
        setShowExpiryOverlay(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Track unread chat messages
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && activeTabRef.current !== 'chat') {
        setHasUnreadChat(true);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  // Send sidebar chat message
  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isLoadingChat || !attemptId) return;

    if (isExpired) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: constraintMessages.time,
        isConstraint: true,
      }]);
      setChatInput('');
      return;
    }

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

    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages.filter((m) => m.role !== 'system' && !m.isConstraint).map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: text },
    ];

    await streamChat(chatMessages, {
      userMessage: text,
      onChunk: (fullContent) => {
        setStreamingContent(fullContent);
      },
      onDone: (fullContent, meta) => {
        setMessages((m) => [...m, { role: 'assistant', content: fullContent, meta }]);
        setStreamingContent('');
        setIsLoadingChat(false);
        // Auto-apply code blocks
        applyCodeFromResponse(fullContent);
      },
      onError: (error) => {
        setMessages((m) => [...m, { role: 'assistant', content: `Request failed: ${error}` }]);
        setStreamingContent('');
        setIsLoadingChat(false);
      },
      onConstraint: (violation, message) => {
        const friendlyMsg = constraintMessages[violation] || message;
        setMessages((m) => [...m, { role: 'assistant', content: friendlyMsg, isConstraint: true }]);
        setStreamingContent('');
        setIsLoadingChat(false);
        if (violation === 'time') {
          setIsExpired(true);
          isExpiredRef.current = true;
          setShowExpiryOverlay(true);
        }
        if (violation === 'cost' || violation === 'tokens') {
          setAiLimitReached(true);
        }
      },
    });
  }, [chatInput, isLoadingChat, attemptId, messages, buildSystemPrompt, streamChat, isExpired, aiLimitReached, applyCodeFromResponse]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Drag-to-resize between editor and terminal
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startHeight = terminalHeight;

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

  const totalTokens = inputTokens + outputTokens;
  const chatDisabled = (isExpired && !showExpiryOverlay) || aiLimitReached;

  return (
    <div style={s.container}>
      {/* Main content area */}
      <div style={s.mainRow}>
        {/* LEFT SIDEBAR: Description/Chat tabs */}
        <div style={s.sidebar}>
          {/* Tab bar */}
          <div style={s.tabBar}>
            <button
              style={activeTab === 'description' ? s.tabActive : s.tab}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
            <button
              style={activeTab === 'chat' ? s.tabActive : s.tab}
              onClick={() => { setActiveTab('chat'); setHasUnreadChat(false); }}
            >
              AI Chat
              {hasUnreadChat && <span style={s.unreadDot} />}
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'description' ? (
            <DescriptionPanel challenge={challenge} pastAttempts={pastAttempts} />
          ) : (
            <>
              {/* Chat messages */}
              <div ref={chatScrollRef} style={s.chatScroll}>
                {messages.filter((m) => m.role !== 'system').length === 0 && !streamingContent && (
                  <div style={s.chatEmpty}>
                    <span style={{ color: arena.textSubtle, fontSize: 13, textAlign: 'center', lineHeight: '1.6', padding: '0 12px' }}>
                      Choose a model tier below, then ask for help.{'\n'}
                      Micro/Budget = cheap, Mid = balanced,{'\n'}
                      Premium/Reasoning = powerful but costly.
                    </span>
                  </div>
                )}
                {messages.filter((m) => m.role !== 'system').map((msg, i) => {
                  if (msg.isConstraint) {
                    return (
                      <div key={i} style={s.constraintMessage}>
                        <span style={s.constraintIcon}>!</span>
                        <span style={s.constraintText}>{msg.content}</span>
                      </div>
                    );
                  }
                  const modelInfo = msg.meta ? getModelById(msg.meta.model) : undefined;
                  return (
                    <div key={i} style={msg.role === 'user' ? s.userMessage : s.aiMessage}>
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
                      </div>
                      <div style={msg.role === 'user' ? s.userContent : s.aiContent}>
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                      {msg.meta && (
                        <div style={s.msgCostLine}>
                          {modelInfo?.displayName || 'AI'} {'\u00B7'} {msg.meta.tokens.toLocaleString()} {msg.meta.tokens === 1 ? 'token' : 'tokens'} {'\u00B7'} {formatCost(msg.meta.cost)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {streamingContent && (
                  <div style={s.aiMessage}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={s.streamingDot}>{'\u25CF'}</span>
                      <span style={{ fontSize: 10, color: arena.textSubtle }}>
                        {getModelById(model)?.displayName || 'AI'} thinking...
                      </span>
                    </div>
                    <div style={s.aiContent}>{renderMarkdown(streamingContent)}</div>
                  </div>
                )}
              </div>

              {/* Model selector — 5 tiers */}
              <div style={s.tierBar}>
                {(['micro', 'budget', 'mid', 'premium', 'reasoning'] as ModelTier[]).map((tier) => {
                  const m = TIER_MODELS[tier];
                  const isActive = selectedTier === tier;
                  const tc = tierColor(tier);
                  const modelsInTier = getModelsForTier(tier);
                  const hasMultiple = modelsInTier.length > 1;
                  return (
                    <div key={tier} style={{ position: 'relative', flex: 1 }}>
                      <button
                        style={{
                          ...s.tierPill,
                          width: '100%',
                          background: isActive ? `${tc}20` : 'transparent',
                          borderColor: isActive ? tc : arena.border,
                          color: isActive ? tc : arena.textMuted,
                          opacity: isLoadingChat ? 0.5 : 1,
                        }}
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
                        <span style={{ fontWeight: 600 }}>{m.costIndicator}</span>
                        {' '}{tierLabel(tier)}
                        {hasMultiple && isActive && <span style={{ fontSize: 8, marginLeft: 2 }}>{'\u25BC'}</span>}
                      </button>
                      {isActive && tierDropdownOpen && hasMultiple && (
                        <div style={s.tierDropdown}>
                          {modelsInTier.map((mi) => (
                            <button
                              key={mi.id}
                              style={{
                                ...s.tierDropdownItem,
                                background: model === mi.id ? `${tc}15` : 'transparent',
                                color: model === mi.id ? tc : arena.text,
                              }}
                              onClick={() => {
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
              <div style={s.chatInputWrap}>
                <input
                  type="text"
                  style={s.chatInput}
                  placeholder={chatDisabled ? (aiLimitReached ? 'AI limit reached \u2014 budget exhausted' : 'Chat disabled \u2014 time expired') : 'Ask about this problem...'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={isLoadingChat || chatDisabled}
                />
                <button
                  style={{
                    ...s.sendButton,
                    opacity: !chatInput.trim() || isLoadingChat || chatDisabled ? 0.4 : 1,
                  }}
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || isLoadingChat || chatDisabled}
                >
                  &#9658;
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANE: Editor + Terminal */}
        <div ref={rightPaneRef} style={s.rightPane}>
          {/* Editor */}
          <div style={s.editorWrap}>
            <CodeUpdateToast visible={showToast} />
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
                onMount={(editor: unknown) => { editorRef.current = editor; }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  lineNumbers: 'on' as const,
                  renderLineHighlight: 'line' as const,
                  scrollBeyondLastLine: false,
                  padding: { top: 8 },
                  automaticLayout: true,
                }}
              />
            </Suspense>
          </div>

          {/* Drag handle */}
          <div
            style={s.dragHandle}
            onMouseDown={handleDragStart}
          />

          {/* Terminal */}
          <div style={{ ...s.terminalWrap, height: terminalHeight }}>
            <div style={s.terminalHeader}>
              <span style={s.terminalHeaderText}>Terminal</span>
            </div>
            <TerminalPanel
              ref={terminalRef}
              fs={fs}
              language={language}
              challengeTitle={challenge.title}
              challengeDescription={challenge.description}
              shellCallbacks={shellCallbacks}
              streamChat={streamChat}
              abortChat={abortChat}
              onCodeApplied={handleTerminalCodeApplied}
              isExpired={() => isExpiredRef.current}
            />
          </div>
        </div>
      </div>

      {/* Test results bar */}
      {testResults && <ResultsBar results={testResults} onDismiss={onDismissResults} />}

      {/* Expiry overlay */}
      {showExpiryOverlay && (
        <div style={s.expiryOverlay}>
          <div style={s.expiryCard}>
            <h2 style={s.expiryTitle}>Time's Up!</h2>
            <div style={s.expiryStats}>
              <div style={s.expiryStat}>
                <span style={s.expiryStatValue}>{totalTokens.toLocaleString()}</span>
                <span style={s.expiryStatLabel}>tokens used</span>
              </div>
              <div style={s.expiryStat}>
                <span style={s.expiryStatValue}>{formatCost(totalCost)}</span>
                <span style={s.expiryStatLabel}>cost</span>
              </div>
            </div>
            <div style={s.expiryActions}>
              <button
                style={s.expiryReviewBtn}
                onClick={() => setShowExpiryOverlay(false)}
              >
                Review Code
              </button>
              {onRestart && (
                <button
                  style={s.expiryRestartBtn}
                  onClick={onRestart}
                >
                  Start New Attempt
                </button>
              )}
            </div>
          </div>
        </div>
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

  // Left sidebar
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    flex: 2,
    minWidth: 280,
    maxWidth: 480,
    borderRight: `1px solid ${arena.border}`,
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
  },
  terminalHeaderText: {
    fontSize: 11,
    fontWeight: 600,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
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
    gap: 6,
    padding: '6px 10px',
    borderTop: `1px solid ${arena.border}`,
    background: arena.surface,
    flexShrink: 0,
  },
  tierPill: {
    flex: 1,
    padding: '5px 8px',
    fontSize: 11,
    borderRadius: 6,
    border: `1px solid ${arena.border}`,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textAlign: 'center' as const,
    transition: 'all 0.15s',
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
    outline: 'none',
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

  // Expiry overlay
  expiryOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  expiryCard: {
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 400,
    width: '90%',
    textAlign: 'center' as const,
  },
  expiryTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: arena.error,
    margin: '0 0 20px',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
  },
  expiryStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  expiryStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  expiryStatValue: {
    fontSize: 16,
    fontWeight: 600,
    color: arena.accent,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  expiryStatLabel: {
    fontSize: 11,
    color: arena.textMuted,
  },
  expiryActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  expiryReviewBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 8,
    color: arena.text,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  expiryRestartBtn: {
    background: arena.accent,
    border: 'none',
    borderRadius: 8,
    color: '#0d1117',
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },

};
