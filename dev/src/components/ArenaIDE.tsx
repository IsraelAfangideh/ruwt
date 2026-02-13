/**
 * Arena IDE: Monaco editor + test output (left), tabbed Description/Chat (right), status bar (bottom).
 * Dark IDE aesthetic inspired by Claude Code / Cursor.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { arena } from '@/theme/colors';

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
  h1: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: '1.4',
    margin: '16px 0 8px',
    color: arena.text,
  },
  h2: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: '1.4',
    margin: '12px 0 6px',
    color: arena.text,
  },
  h3: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '1.4',
    margin: '10px 0 4px',
    color: arena.text,
  },
  listItem: {
    display: 'flex',
    gap: 8,
    lineHeight: '1.5',
    paddingLeft: 4,
  },
  listBullet: {
    color: arena.textMuted,
    flexShrink: 0,
    width: 12,
  },
  listNum: {
    color: arena.textMuted,
    flexShrink: 0,
    width: 16,
    textAlign: 'right' as const,
  },
};

/* ─── Constraint violation messages ──────────────────────────────── */

const constraintMessages: Record<string, string> = {
  time: 'Time limit reached — you can review your code but can\'t make more AI requests.',
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
  runResult?: {
    passed: boolean;
    passedTests: number;
    totalTests: number;
    results?: TestCaseResult[];
  } | null;
  isRunning?: boolean;
  onRestart?: () => void;
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function DescriptionPanel({ challenge }: { challenge: ArenaChallenge }) {
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
    </div>
  );
}

function TestRow({ tc, index, expanded, onToggle }: {
  tc: TestCaseResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const formatMeta = () => {
    const parts: string[] = [];
    if (tc.time) parts.push(`${tc.time}s`);
    if (tc.memory != null) parts.push(`${(tc.memory / 1024).toFixed(1)}MB`);
    return parts.join(' \u00B7 ');
  };

  return (
    <div style={{ borderBottom: `1px solid ${arena.border}` }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...s.testRow,
          background: hovered ? arena.surfaceHover : 'transparent',
        }}
      >
        <span style={{ color: arena.textSubtle, fontSize: 10, width: 12, flexShrink: 0 }}>
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span style={{ color: tc.passed ? arena.success : arena.error, flexShrink: 0 }}>
          {tc.passed ? '\u2713' : '\u2717'}
        </span>
        <span style={{ color: arena.text }}>Test {index + 1}</span>
        {formatMeta() && (
          <span style={{ marginLeft: 'auto', color: arena.textSubtle }}>{formatMeta()}</span>
        )}
      </div>
      {expanded && (
        <div style={s.testDetail}>
          <div>
            <span style={{ color: arena.textMuted }}>Input: </span>
            <span style={{ color: arena.text }}>{tc.input || '(none)'}</span>
          </div>
          <div>
            <span style={{ color: arena.textMuted }}>Expected: </span>
            <span style={{ color: arena.success }}>{tc.expectedOutput}</span>
          </div>
          <div>
            <span style={{ color: arena.textMuted }}>Actual: </span>
            <span style={{ color: tc.passed ? arena.success : arena.error }}>{tc.actualOutput || '(empty)'}</span>
          </div>
          {tc.error && (
            <div style={{ marginTop: 4, color: arena.error, whiteSpace: 'pre-wrap' }}>Error: {tc.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

function OutputPanel({ runResult, isRunning, expandedTests, onToggleTest }: {
  runResult?: ArenaIDEProps['runResult'];
  isRunning?: boolean;
  expandedTests: Set<number>;
  onToggleTest: (i: number) => void;
}) {
  if (!isRunning && !runResult) {
    return (
      <div style={s.outputWrap}>
        <div style={s.outputHeader}>
          <span style={s.outputHeaderText}>Output</span>
        </div>
        <div style={s.outputEmpty}>
          <span style={{ fontSize: 12, color: arena.textSubtle }}>
            Click &ldquo;Run Tests&rdquo; to check your solution
          </span>
        </div>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div style={s.outputWrap}>
        <div style={s.outputHeader}>
          <span style={s.outputHeaderText}>Output</span>
        </div>
        <div style={s.outputEmpty}>
          <span style={{ color: arena.accent, marginRight: 8 }}>{'\u25CF'}</span>
          <span style={{ fontSize: 12, color: arena.textMuted }}>Running tests...</span>
        </div>
      </div>
    );
  }

  if (!runResult) return null;

  return (
    <div style={s.outputWrap}>
      {/* Summary bar */}
      <div style={{
        ...s.outputHeader,
        background: runResult.passed ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: runResult.passed ? arena.success : arena.error,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        }}>
          {runResult.passed ? '\u2713 All tests passed' : '\u2717 Some tests failed'} ({runResult.passedTests}/{runResult.totalTests})
        </span>
      </div>
      {/* Individual test results */}
      <div style={s.outputScroll}>
        {runResult.results?.map((tc, i) => (
          <TestRow
            key={i}
            tc={tc}
            index={i}
            expanded={expandedTests.has(i)}
            onToggle={() => onToggleTest(i)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────── */

export function ArenaIDE({
  challenge,
  attempt,
  userCredits,
  code,
  onCodeChange,
  language,
  onAttemptUpdate,
  runResult,
  isRunning,
  onRestart,
}: ArenaIDEProps) {
  const [totalCost, setTotalCost] = useState(attempt.totalCost);
  const [inputTokens, setInputTokens] = useState(attempt.inputTokens);
  const [outputTokens, setOutputTokens] = useState(attempt.outputTokens);
  const [messages, setMessages] = useState<{ role: 'system' | 'user' | 'assistant'; content: string; isConstraint?: boolean }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [model] = useState('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  const [isExpired, setIsExpired] = useState(false);
  const [showExpiryOverlay, setShowExpiryOverlay] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'chat'>('description');
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());

  const activeTabRef = useRef<'description' | 'chat'>('description');
  activeTabRef.current = activeTab;
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const attemptId = attempt.id;
  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;
  const [timeLeft, setTimeLeft] = useState<number | null>(
    expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : null
  );

  // Build system prompt from challenge context
  const systemPrompt = useMemo(() => {
    return `You are an AI coding assistant helping a user solve a programming challenge in the Ruwt Arena.

Challenge: "${challenge.title}"
Difficulty: ${challenge.difficulty}
Language: ${language}

Description:
${challenge.description}

Help the user understand the problem, suggest approaches, debug their code, and explain concepts. Be concise and focus on the specific challenge. When showing code, use fenced code blocks with the language tag.`;
  }, [challenge.title, challenge.difficulty, challenge.description, language]);

  // Timer
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && !isExpired) {
        setIsExpired(true);
        setShowExpiryOverlay(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isExpired]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-expand failed tests when results arrive
  useEffect(() => {
    if (runResult?.results) {
      const failed = new Set<number>();
      runResult.results.forEach((r, i) => { if (!r.passed) failed.add(i); });
      setExpandedTests(failed);
    }
  }, [runResult]);

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

  const toggleTest = useCallback((i: number) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isLoadingChat || !attemptId) return;

    // Block chat if expired
    if (isExpired) {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: constraintMessages.time,
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

    // Build messages array with system prompt
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system' && !m.isConstraint).map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user' as const, content: text },
    ];

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          attemptId,
          maxTokens: 2048,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; violation?: string };
        // Friendly constraint error messages
        if (res.status === 403 && err.violation) {
          const friendlyMsg = constraintMessages[err.violation] || `Constraint reached: ${err.violation}`;
          setMessages((m) => [...m, { role: 'assistant', content: friendlyMsg, isConstraint: true }]);
          if (err.violation === 'time') {
            setIsExpired(true);
            setShowExpiryOverlay(true);
          }
        } else {
          setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.error || res.statusText}` }]);
        }
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              inputTokens?: number;
              outputTokens?: number;
              cost?: number;
              violation?: string;
              message?: string;
            };
            if (data.type === 'chunk' && data.content) {
              assistantContent += data.content;
              setStreamingContent(assistantContent);
            } else if (data.type === 'done') {
              setTotalCost((prev) => prev + (data.cost ?? 0));
              setInputTokens((prev) => prev + (data.inputTokens ?? 0));
              setOutputTokens((prev) => prev + (data.outputTokens ?? 0));
              if (onAttemptUpdate) {
                onAttemptUpdate({
                  ...attempt,
                  totalCost: attempt.totalCost + (data.cost ?? 0),
                  inputTokens: attempt.inputTokens + (data.inputTokens ?? 0),
                  outputTokens: attempt.outputTokens + (data.outputTokens ?? 0),
                });
              }
            } else if (data.type === 'error') {
              assistantContent += `\n[Error: ${data.message}]`;
            } else if (data.type === 'constraint_warning') {
              assistantContent += `\n[Constraint: ${data.message}]`;
            }
          } catch (_) { /* skip malformed SSE */ }
        }
      }
      setMessages((m) => [...m, { role: 'assistant', content: assistantContent || '(no response)' }]);
      setStreamingContent('');
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Request failed: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [chatInput, isLoadingChat, attemptId, model, messages, attempt, onAttemptUpdate, systemPrompt, isExpired]);

  // Handle Enter key in chat input
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const totalTokens = inputTokens + outputTokens;
  const chatDisabled = isExpired && !showExpiryOverlay;

  // Timer urgency: > 2min = normal, < 2min = warning, < 30s = critical
  const timerUrgency: 'normal' | 'warning' | 'critical' =
    timeLeft == null ? 'normal' :
    timeLeft <= 30 ? 'critical' :
    timeLeft <= 120 ? 'warning' : 'normal';

  const timerPillStyle: React.CSSProperties | undefined =
    timerUrgency === 'critical' ? {
      background: arena.error,
      color: '#fff',
      padding: '1px 8px',
      borderRadius: 9999,
      fontWeight: 700,
    } : timerUrgency === 'warning' ? {
      background: arena.accent,
      color: '#0d1117',
      padding: '1px 8px',
      borderRadius: 9999,
      fontWeight: 600,
    } : undefined;

  return (
    <div style={s.container}>
      {/* Main content area */}
      <div style={s.mainRow}>
        {/* Left: Editor + Output */}
        <div style={s.leftPane}>
          <div style={s.editorWrap}>
            <Suspense fallback={
              <div style={s.editorLoading}>
                <span style={{ color: arena.textMuted, fontSize: 13 }}>Loading editor...</span>
              </div>
            }>
              <MonacoEditor
                height="100%"
                language={language}
                value={code}
                onChange={(v: string | undefined) => v != null && onCodeChange(v)}
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
          <OutputPanel
            runResult={runResult}
            isRunning={isRunning}
            expandedTests={expandedTests}
            onToggleTest={toggleTest}
          />
        </div>

        {/* Right: Tabbed Panel (Description / AI Chat) */}
        <div style={s.rightPane}>
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
            <DescriptionPanel challenge={challenge} />
          ) : (
            <>
              {/* Chat messages */}
              <div ref={chatScrollRef} style={s.chatScroll}>
                {messages.filter((m) => m.role !== 'system').length === 0 && !streamingContent && (
                  <div style={s.chatEmpty}>
                    <span style={{ color: arena.textSubtle, fontSize: 13 }}>
                      Ask the AI for help with this challenge...
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
                  return (
                    <div key={i} style={msg.role === 'user' ? s.userMessage : s.aiMessage}>
                      <div style={s.messageLabel}>
                        <span style={msg.role === 'user' ? s.userLabel : s.aiLabel}>
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </span>
                      </div>
                      <div style={msg.role === 'user' ? s.userContent : s.aiContent}>
                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      </div>
                    </div>
                  );
                })}
                {streamingContent && (
                  <div style={s.aiMessage}>
                    <div style={s.messageLabel}>
                      <span style={s.aiLabel}>AI</span>
                      <span style={s.streamingDot}>{'\u25CF'}</span>
                    </div>
                    <div style={s.aiContent}>{renderMarkdown(streamingContent)}</div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div style={s.chatInputWrap}>
                <input
                  type="text"
                  style={s.chatInput}
                  placeholder={chatDisabled ? 'Chat disabled \u2014 time expired' : 'Ask about this problem...'}
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
      </div>

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
              {runResult && (
                <div style={s.expiryStat}>
                  <span style={{
                    ...s.expiryStatValue,
                    color: runResult.passed ? arena.success : arena.error,
                  }}>
                    {runResult.passedTests}/{runResult.totalTests}
                  </span>
                  <span style={s.expiryStatLabel}>tests passed</span>
                </div>
              )}
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

      {/* Status bar */}
      <div style={s.statusBar}>
        <span style={s.statusItem}>
          <span style={s.statusDot}>&#9679;</span>
          <span style={s.statusValue}>{formatCost(totalCost)}</span>
        </span>
        <span style={s.statusSep}>&middot;</span>
        <span style={s.statusItem}>
          <span style={s.statusLabel}>{totalTokens.toLocaleString()}</span>
          <span style={s.statusLabel}> tok</span>
        </span>
        {timeLeft != null && (
          <>
            <span style={s.statusSep}>&middot;</span>
            <span style={{
              ...s.statusItem,
              ...timerPillStyle,
            }}>
              <span style={timerPillStyle ? undefined : s.statusValue}>
                {formatTime(timeLeft)}
              </span>
              <span style={timerPillStyle ? { opacity: 0.8 } : s.statusLabel}> left</span>
            </span>
          </>
        )}
        <span style={s.statusSep}>&middot;</span>
        <span style={s.statusItem}>
          <span style={s.statusValue}>{userCredits.toLocaleString()}</span>
          <span style={s.statusLabel}> cr</span>
        </span>
      </div>
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
  leftPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 3,
    minWidth: 0,
    borderRight: `1px solid ${arena.border}`,
  },
  rightPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: 2,
    minWidth: 280,
    maxWidth: 480,
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

  // Output panel
  outputWrap: {
    minHeight: 160,
    maxHeight: '40%',
    borderTop: `1px solid ${arena.border}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  outputHeader: {
    padding: '4px 12px',
    borderBottom: `1px solid ${arena.border}`,
    background: arena.surface,
    flexShrink: 0,
  },
  outputHeaderText: {
    fontSize: 11,
    fontWeight: 600,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  outputEmpty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outputScroll: {
    flex: 1,
    overflowY: 'auto',
  },
  testRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    cursor: 'pointer',
    gap: 8,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
  testDetail: {
    padding: '4px 12px 10px 34px',
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    lineHeight: '1.6',
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

  // Status bar
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    height: 28,
    padding: '0 14px',
    gap: 6,
    borderTop: `1px solid ${arena.border}`,
    background: arena.surface,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 11,
    flexShrink: 0,
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    fontSize: 8,
    color: arena.success,
  },
  statusValue: {
    color: arena.accent,
  },
  statusLabel: {
    color: arena.textMuted,
  },
  statusSep: {
    color: arena.textSubtle,
  },
};
