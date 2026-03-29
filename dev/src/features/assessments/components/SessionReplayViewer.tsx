/**
 * SessionReplayViewer — company-facing timeline replay of a candidate's
 * take-home assessment session.
 *
 * Fetches the full event stream from R2 and renders a scrubble timeline
 * with file content, AI conversation, and terminal output reconstructed
 * at the selected point in time.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { arena } from '@/shared/theme/colors';
import type { SessionEvent } from '@/features/ide/useSessionRecorder';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionReplayViewerProps {
  sessionId: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SessionReplayViewer({ sessionId }: SessionReplayViewerProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/assess/takehome/replay?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load replay');
        return res.json();
      })
      .then((data: { events: SessionEvent[] }) => {
        if (cancelled) return;
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const maxTime = useMemo(() => {
    if (events.length === 0) return 0;
    return events[events.length - 1].timestamp;
  }, [events]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentTime(Number(e.target.value));
    },
    [],
  );

  // Reconstruct state at current time
  const visibleEvents = useMemo(
    () => events.filter((ev) => ev.timestamp <= currentTime),
    [events, currentTime],
  );

  // Latest content snapshot per file, for the file panel
  const latestSnapshot = useMemo(() => {
    const snapshots: Record<string, { content: string; cursorLine?: number }> = {};
    for (const ev of visibleEvents) {
      if (ev.type === 'content_snapshot') {
        snapshots[ev.data.path as string] = {
          content: ev.data.content as string,
          cursorLine: ev.data.cursorLine as number | undefined,
        };
      }
    }
    return snapshots;
  }, [visibleEvents]);

  const activeFile = useMemo(() => {
    // Last file_open or tab_switch tells us what file is active
    for (let i = visibleEvents.length - 1; i >= 0; i--) {
      const ev = visibleEvents[i];
      if (ev.type === 'file_open') return ev.data.path as string;
      if (ev.type === 'tab_switch') return ev.data.toPath as string;
    }
    return null;
  }, [visibleEvents]);

  const activeContent = activeFile && latestSnapshot[activeFile]
    ? latestSnapshot[activeFile].content
    : '';

  // AI conversation at the current point
  const aiMessages = useMemo(() => {
    return visibleEvents
      .filter((ev) => ev.type === 'ai_prompt' || ev.type === 'ai_response')
      .map((ev) => ({
        role: ev.type === 'ai_prompt' ? 'user' : 'assistant',
        model: ev.data.model as string,
        content: ev.type === 'ai_prompt'
          ? (ev.data.fullPrompt as string)
          : (ev.data.fullResponse as string),
        timestamp: ev.timestamp,
      }));
  }, [visibleEvents]);

  // Terminal commands at the current point
  const terminalEntries = useMemo(() => {
    return visibleEvents
      .filter((ev) => ev.type === 'terminal_command')
      .map((ev) => ({
        input: ev.data.input as string,
        output: ev.data.output as string,
        exitCode: ev.data.exitCode as number | undefined,
        timestamp: ev.timestamp,
      }));
  }, [visibleEvents]);

  // Event markers for timeline
  const markers = useMemo(() => {
    if (maxTime === 0) return [];
    return events.map((ev) => ({
      type: ev.type,
      pct: (ev.timestamp / maxTime) * 100,
      timestamp: ev.timestamp,
    }));
  }, [events, maxTime]);

  const formatTimestamp = (ms: number): string => {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={rootStyle} data-testid="replay-loading">
        <span style={mutedStyle}>Loading session replay...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={rootStyle} data-testid="replay-error">
        <span style={errorStyle}>{error}</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={rootStyle} data-testid="replay-empty">
        <span style={mutedStyle}>No replay data available for this session.</span>
      </div>
    );
  }

  return (
    <div style={rootStyle} data-testid="session-replay-viewer">
      {/* Timeline bar */}
      <div style={timelineBarStyle} data-testid="replay-timeline">
        <span style={timeLabelStyle}>{formatTimestamp(currentTime)}</span>
        <div style={sliderWrapperStyle}>
          {/* Event markers */}
          <div style={markerTrackStyle}>
            {markers.map((m, i) => (
              <div
                key={i}
                style={{
                  ...markerStyle,
                  left: `${m.pct}%`,
                  background: markerColor(m.type),
                  borderRadius: m.type === 'test_run' ? 0 : '50%',
                }}
                title={`${m.type} @ ${formatTimestamp(m.timestamp)}`}
                data-testid={`marker-${i}`}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={maxTime}
            value={currentTime}
            onChange={handleScrub}
            style={sliderStyle}
            data-testid="replay-scrubber"
          />
        </div>
        <span style={timeLabelStyle}>{formatTimestamp(maxTime)}</span>
      </div>

      {/* Main panels */}
      <div style={panelsStyle}>
        {/* Left: File content */}
        <div style={panelStyle} data-testid="replay-file-panel">
          <div style={panelHeaderStyle}>
            <span style={panelTitleStyle}>{activeFile ?? 'No file selected'}</span>
          </div>
          <pre style={codeStyle} data-testid="replay-code">
            {activeContent || '// No content at this point in time'}
          </pre>
        </div>

        {/* Right: AI conversation */}
        <div style={panelStyle} data-testid="replay-ai-panel">
          <div style={panelHeaderStyle}>
            <span style={panelTitleStyle}>AI Conversation ({aiMessages.length})</span>
          </div>
          <div style={aiListStyle}>
            {aiMessages.length === 0 ? (
              <span style={mutedStyle}>No AI interactions yet at this point.</span>
            ) : (
              aiMessages.map((msg, i) => (
                <div key={i} style={aiMsgStyle} data-testid={`ai-msg-${i}`}>
                  <div style={aiMsgHeaderStyle}>
                    <span style={{
                      ...aiRoleStyle,
                      color: msg.role === 'user' ? arena.accent : arena.success,
                    }}>
                      {msg.role === 'user' ? 'Prompt' : 'Response'}
                    </span>
                    <span style={aiMsgTimeStyle}>{formatTimestamp(msg.timestamp)}</span>
                    <span style={aiMsgModelStyle}>{msg.model}</span>
                  </div>
                  <pre style={aiMsgContentStyle}>{msg.content}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Terminal */}
      <div style={termPanelStyle} data-testid="replay-terminal-panel">
        <div style={panelHeaderStyle}>
          <span style={panelTitleStyle}>Terminal ({terminalEntries.length})</span>
        </div>
        <div style={termListStyle}>
          {terminalEntries.length === 0 ? (
            <span style={mutedStyle}>No terminal commands at this point.</span>
          ) : (
            terminalEntries.map((entry, i) => (
              <div key={i} style={termEntryStyle} data-testid={`term-entry-${i}`}>
                <div style={termInputStyle}>$ {entry.input}</div>
                {entry.output && <div style={termOutputStyle}>{entry.output}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function markerColor(type: string): string {
  switch (type) {
    case 'ai_prompt':
    case 'ai_response':
      return arena.accent;
    case 'test_run':
      return arena.success;
    case 'file_open':
    case 'tab_switch':
      return 'rgba(88,166,255,0.7)';
    case 'focus_change':
      return arena.error;
    default:
      return arena.textMuted;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: arena.bg,
  color: arena.text,
  overflow: 'hidden',
};

const mutedStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 13,
  padding: 16,
};

const errorStyle: React.CSSProperties = {
  color: arena.error,
  fontSize: 13,
  padding: 16,
};

const timelineBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
  flexShrink: 0,
};

const timeLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  color: arena.textMuted,
  minWidth: 44,
  textAlign: 'center',
};

const sliderWrapperStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  height: 24,
};

const markerTrackStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '100%',
  pointerEvents: 'none',
};

const markerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 6,
  height: 6,
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  appearance: 'auto',
  height: 4,
  cursor: 'pointer',
};

const panelsStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const panelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  borderRight: `1px solid ${arena.border}`,
  overflow: 'hidden',
};

const panelHeaderStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
  flexShrink: 0,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: arena.textMuted,
};

const codeStyle: React.CSSProperties = {
  flex: 1,
  margin: 0,
  padding: 12,
  fontSize: 13,
  lineHeight: 1.5,
  fontFamily: 'monospace',
  color: arena.text,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

const aiListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 8,
};

const aiMsgStyle: React.CSSProperties = {
  marginBottom: 8,
  border: `1px solid ${arena.border}`,
  borderRadius: 6,
  overflow: 'hidden',
};

const aiMsgHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px',
  background: arena.surface,
};

const aiRoleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const aiMsgTimeStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  fontVariantNumeric: 'tabular-nums',
};

const aiMsgModelStyle: React.CSSProperties = {
  fontSize: 11,
  color: arena.textMuted,
  marginLeft: 'auto',
};

const aiMsgContentStyle: React.CSSProperties = {
  margin: 0,
  padding: 8,
  fontSize: 12,
  lineHeight: 1.5,
  fontFamily: 'monospace',
  color: arena.text,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 200,
  overflow: 'auto',
};

const termPanelStyle: React.CSSProperties = {
  height: 160,
  borderTop: `1px solid ${arena.border}`,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const termListStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 8,
};

const termEntryStyle: React.CSSProperties = {
  marginBottom: 6,
};

const termInputStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'monospace',
  color: arena.accent,
};

const termOutputStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'monospace',
  color: arena.textMuted,
  whiteSpace: 'pre-wrap',
  paddingLeft: 12,
};
