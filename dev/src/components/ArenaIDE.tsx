/**
 * Arena IDE: Monaco editor + xterm terminal (left), AI chat (right), status bar (bottom).
 * Dark IDE aesthetic inspired by Claude Code / Cursor.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { arena } from '@/theme/colors';

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

function renderMarkdown(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    // fenced code block
    if (lines[i].startsWith('```')) {
      const lang = lines[i].slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <div key={blocks.length} style={mdStyles.codeBlock}>
          {lang && <div style={mdStyles.codeLang}>{lang}</div>}
          <pre style={mdStyles.codePre}>{codeLines.join('\n')}</pre>
        </div>
      );
      continue;
    }

    // regular line — parse inline elements
    blocks.push(
      <div key={blocks.length} style={mdStyles.paragraph}>
        {renderInline(lines[i])}
      </div>
    );
    i++;
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // match **bold** and `code`
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
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
      // inline code
      parts.push(
        <code key={parts.length} style={mdStyles.inlineCode}>{match[3]}</code>
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
  },
  codeLang: {
    fontSize: 11,
    color: arena.textMuted,
    padding: '4px 10px',
    borderBottom: `1px solid ${arena.border}`,
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
  paragraph: {
    lineHeight: '1.5',
    minHeight: '1.2em',
  },
};

/* ─── Types ───────────────────────────────────────────────────────── */

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
  runResult?: { passed: boolean; passedTests: number; totalTests: number } | null;
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
}: ArenaIDEProps) {
  const [totalCost, setTotalCost] = useState(attempt.totalCost);
  const [inputTokens, setInputTokens] = useState(attempt.inputTokens);
  const [outputTokens, setOutputTokens] = useState(attempt.outputTokens);
  const [messages, setMessages] = useState<{ role: 'system' | 'user' | 'assistant'; content: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [model] = useState('@cf/meta/llama-3.1-8b-instruct');
  const [editorReady, setEditorReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const editorRootRef = useRef<{ unmount: () => void } | null>(null);
  const terminalInstanceRef = useRef<{ dispose: () => void } | null>(null);
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

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isLoadingChat || !attemptId) return;
    setChatInput('');
    const userMsg = { role: 'user' as const, content: text };
    setMessages((m) => [...m, userMsg]);
    setIsLoadingChat(true);
    setStreamingContent('');

    // Build messages array with system prompt
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system').map((msg) => ({ role: msg.role, content: msg.content })),
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
        const err = await res.json().catch(() => ({}));
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${(err as { error?: string }).error || res.statusText}` }]);
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
  }, [chatInput, isLoadingChat, attemptId, model, messages, attempt, onAttemptUpdate, systemPrompt]);

  // Mount Monaco editor
  useEffect(() => {
    const mountId = 'arena-monaco-mount';
    const el = document.getElementById(mountId);
    if (!el) return;
    let unmount: (() => void) | undefined;
    Promise.all([import('@monaco-editor/react'), import('react-dom/client')]).then(([{ default: Editor }, { createRoot }]) => {
      const root = document.createElement('div');
      root.style.height = '100%';
      el.appendChild(root);
      const client = createRoot(root);
      client.render(
        React.createElement(Editor, {
          height: '100%',
          language,
          value: code,
          onChange: (v: string | undefined) => v != null && onCodeChange(v),
          theme: 'vs-dark',
          options: {
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          },
        })
      );
      setEditorReady(true);
      editorRootRef.current = { unmount: () => { client.unmount(); root.remove(); } };
      unmount = () => { editorRootRef.current?.unmount(); };
    });
    return () => { unmount?.(); };
  }, []);

  // Mount xterm terminal
  useEffect(() => {
    const mountId = 'arena-terminal-mount';
    const el = document.getElementById(mountId);
    if (!el) return;
    let cleanup: (() => void) | undefined;
    Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(([XTerm, AddonFit]) => {
      const Terminal = XTerm.Terminal;
      const FitAddonClass = (AddonFit as { FitAddon: new () => unknown }).FitAddon;
      const fitAddon = new FitAddonClass();
      const terminal = new Terminal({
        theme: { background: arena.bg, foreground: arena.text, cursor: arena.accent },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
      });
      terminal.loadAddon(fitAddon as never);
      terminal.open(el);
      (fitAddon as { fit: () => void }).fit();
      terminal.writeln('\x1b[1;33mRuwt Arena\x1b[0m — Output');
      terminal.write('$ ');
      setTerminalReady(true);
      terminalInstanceRef.current = terminal;
      const onResize = () => (fitAddon as { fit: () => void }).fit();
      window.addEventListener('resize', onResize);
      cleanup = () => {
        window.removeEventListener('resize', onResize);
        terminal.dispose();
        terminalInstanceRef.current = null;
      };
    });
    return () => { cleanup?.(); };
  }, []);

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
  const wallLimit = challenge.wallClockLimit;

  return (
    <div style={s.container}>
      {/* Main content area */}
      <div style={s.mainRow}>
        {/* Left: Editor + Terminal */}
        <div style={s.leftPane}>
          <div style={s.editorWrap}>
            <div id="arena-monaco-mount" style={s.editorMount} />
            {!editorReady && (
              <div style={s.editorLoading}>
                <span style={{ color: arena.textMuted, fontSize: 13 }}>Loading editor...</span>
              </div>
            )}
          </div>
          <div style={s.terminalWrap}>
            <div style={s.terminalHeader}>
              <span style={s.terminalHeaderText}>Output</span>
            </div>
            <div id="arena-terminal-mount" style={s.terminalMount} />
            {!terminalReady && (
              <div style={s.terminalLoading}>
                <span style={{ color: arena.textMuted, fontSize: 12 }}>Terminal</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div style={s.rightPane}>
          {/* Chat header */}
          <div style={s.chatHeader}>
            <span style={s.chatHeaderTitle}>AI Assistant</span>
            <span style={s.chatHeaderModel}>@llama-8b</span>
          </div>

          {/* Chat messages */}
          <div ref={chatScrollRef} style={s.chatScroll}>
            {messages.filter((m) => m.role !== 'system').length === 0 && !streamingContent && (
              <div style={s.chatEmpty}>
                <span style={{ color: arena.textSubtle, fontSize: 13 }}>
                  Ask the AI for help with this challenge...
                </span>
              </div>
            )}
            {messages.filter((m) => m.role !== 'system').map((msg, i) => (
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
            ))}
            {streamingContent && (
              <div style={s.aiMessage}>
                <div style={s.messageLabel}>
                  <span style={s.aiLabel}>AI</span>
                  <span style={s.streamingDot}>●</span>
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
              placeholder="Ask about this problem..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isLoadingChat}
            />
            <button
              style={{
                ...s.sendButton,
                opacity: !chatInput.trim() || isLoadingChat ? 0.4 : 1,
              }}
              onClick={sendMessage}
              disabled={!chatInput.trim() || isLoadingChat}
            >
              ▸
            </button>
          </div>
        </div>
      </div>

      {/* Result banner overlay */}
      {runResult && (
        <div style={{
          ...s.resultBanner,
          background: runResult.passed
            ? 'rgba(63,185,80,0.15)'
            : 'rgba(248,81,73,0.15)',
          borderColor: runResult.passed ? arena.success : arena.error,
        }}>
          <span style={{
            color: runResult.passed ? arena.success : arena.error,
            fontWeight: 600,
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}>
            {runResult.passed ? '✓ All tests passed' : '✗ Some tests failed'} ({runResult.passedTests}/{runResult.totalTests})
          </span>
        </div>
      )}

      {/* Status bar */}
      <div style={s.statusBar}>
        <span style={s.statusItem}>
          <span style={s.statusDot}>●</span>
          <span style={s.statusValue}>{formatCost(totalCost)}</span>
        </span>
        <span style={s.statusSep}>·</span>
        <span style={s.statusItem}>
          <span style={s.statusLabel}>{totalTokens.toLocaleString()}</span>
          <span style={s.statusLabel}> tok</span>
        </span>
        {wallLimit != null && timeLeft != null && (
          <>
            <span style={s.statusSep}>·</span>
            <span style={s.statusItem}>
              <span style={s.statusValue}>{formatTime(wallLimit - timeLeft)}</span>
              <span style={s.statusLabel}> / {formatTime(wallLimit)}</span>
            </span>
          </>
        )}
        <span style={s.statusSep}>·</span>
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
  editorMount: {
    width: '100%',
    height: '100%',
  },
  editorLoading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: arena.bg,
  },

  // Terminal
  terminalWrap: {
    height: 180,
    borderTop: `1px solid ${arena.border}`,
    display: 'flex',
    flexDirection: 'column',
  },
  terminalHeader: {
    padding: '4px 12px',
    borderBottom: `1px solid ${arena.border}`,
    background: arena.surface,
  },
  terminalHeaderText: {
    fontSize: 11,
    fontWeight: 600,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  terminalMount: {
    flex: 1,
    padding: 4,
  },
  terminalLoading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat panel
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    borderBottom: `1px solid ${arena.border}`,
    background: arena.surface,
  },
  chatHeaderTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: arena.text,
  },
  chatHeaderModel: {
    fontSize: 11,
    color: arena.textMuted,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  },
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
    animation: 'pulse 1s infinite',
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

  // Result banner
  resultBanner: {
    position: 'absolute',
    top: 48,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid',
    zIndex: 10,
    backdropFilter: 'blur(8px)',
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
