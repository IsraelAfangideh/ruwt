/**
 * ChatPanel — AI chat side panel for the standalone IDE.
 *
 * Displays the agent conversation, mode selector, cost tracker,
 * and input area. Uses useAgentLoop for the multi-turn tool-use loop.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentLoop } from '@/features/shared-ide/hooks/useAgentLoop';
import { buildIDESystemPrompt } from '@/lib/ai/ide-system-prompt';
import type { AIMode } from '@/features/shared-ide/lib/ai-types';
import type { VirtualFileSystem } from '@/features/shared-ide/VirtualFileSystem';
import type { RuntimeBackend } from '@/lib/sandbox/runtime';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

interface ChatPanelProps {
  vfs: VirtualFileSystem;
  backend: RuntimeBackend;
  model: string;
  fileTree: string[];
  currentFile?: { path: string; content: string };
  language: string;
  packageJson?: string | null;
}

const MODES: AIMode[] = ['agent', 'plan', 'debug', 'ask'];

export function ChatPanel(props: ChatPanelProps) {
  const { vfs, backend, model, fileTree, currentFile, language, packageJson } = props;
  const [mode, setMode] = useState<AIMode>('agent');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isRunning, totalCost, sendMessage, abort } = useAgentLoop({
    model,
    vfs,
    backend,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const systemPrompt = buildIDESystemPrompt({
      mode,
      fileTree,
      currentFile,
      language,
      packageJson,
      includeToolDefs: mode === 'agent',
      tier: 'free',
    });

    sendMessage(trimmed, systemPrompt);
    setInput('');
  }, [input, mode, fileTree, currentFile, language, packageJson, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const costDisplay = totalCost > 0
    ? `$${(totalCost / 10000).toFixed(4)}`
    : '$0.00';

  return (
    <div style={panelStyle} data-testid="chat-panel">
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>AI Chat</span>
        <span style={costStyle} data-testid="chat-cost">{costDisplay}</span>
      </div>

      {/* Mode selector */}
      <div style={modeSelectorStyle} data-testid="mode-selector">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              ...modeBtnStyle,
              ...(m === mode ? modeBtnActiveStyle : {}),
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={emptyStyle} data-testid="chat-empty">
            Ask a question or describe a task. In Agent mode, the AI can read and edit your files.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={messageBubbleStyle(msg.role)}>
            <div style={messageRoleStyle}>
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : 'Tool'}
            </div>
            <div style={messageContentStyle}>{msg.content}</div>
            {msg.toolCalls && (
              <div style={toolCallsStyle}>
                {msg.toolCalls.map((tc, i) => (
                  <span key={i} style={toolBadgeStyle}>{tc.name}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={inputAreaStyle}>
        {isRunning && (
          <button onClick={abort} style={stopBtnStyle}>Stop</button>
        )}
        <textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'AI is working...' : `Ask in ${mode} mode...`}
          disabled={isRunning}
          rows={2}
          style={textareaStyle}
        />
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: arena.surface,
  borderLeft: `1px solid ${arena.border}`,
  width: '100%',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: arena.text,
};

const costStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  fontFamily: fontFamily.mono,
};

const modeSelectorStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const modeBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  fontSize: 11,
  padding: '6px 4px',
  cursor: 'pointer',
  textAlign: 'center',
};

const modeBtnActiveStyle: React.CSSProperties = {
  color: arena.text,
  borderBottom: `2px solid ${arena.accent}`,
};

const messagesStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 8,
};

const emptyStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 12,
  textAlign: 'center',
  padding: '24px 12px',
};

function messageBubbleStyle(role: string): React.CSSProperties {
  return {
    padding: '8px 10px',
    marginBottom: 8,
    borderRadius: 6,
    fontSize: 13,
    background: role === 'user' ? 'rgba(201,169,98,0.1)' : role === 'tool' ? 'rgba(255,255,255,0.03)' : 'transparent',
    borderLeft: role === 'tool' ? `2px solid ${arena.textMuted}` : 'none',
  };
}

const messageRoleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: arena.textMuted,
  marginBottom: 2,
  textTransform: 'uppercase',
};

const messageContentStyle: React.CSSProperties = {
  color: arena.text,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: fontFamily.mono,
  fontSize: 12,
  lineHeight: 1.5,
};

const toolCallsStyle: React.CSSProperties = {
  marginTop: 4,
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

const toolBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 6px',
  borderRadius: 3,
  background: 'rgba(201,169,98,0.15)',
  color: arena.accent,
};

const inputAreaStyle: React.CSSProperties = {
  padding: 8,
  borderTop: `1px solid ${arena.border}`,
  flexShrink: 0,
};

const stopBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 0',
  marginBottom: 4,
  background: arena.error,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: arena.bg,
  color: arena.text,
  border: `1px solid ${arena.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: fontFamily.mono,
  resize: 'none',
  outline: 'none',
  boxSizing: 'border-box',
};
