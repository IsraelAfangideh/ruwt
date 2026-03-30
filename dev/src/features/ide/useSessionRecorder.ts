/**
 * useSessionRecorder — records all IDE activity during a take-home session.
 *
 * High-frequency events (content snapshots, terminal output) are batched
 * in memory and periodically flushed to R2 via the replay API endpoint.
 * Structured events (AI calls) also go through here for the full timeline.
 */
import { useRef, useEffect, useCallback, useMemo } from 'react';

export interface SessionEvent {
  type:
    | 'content_snapshot'
    | 'ai_prompt'
    | 'ai_response'
    | 'terminal_command'
    | 'file_open'
    | 'file_close'
    | 'tab_switch'
    | 'test_run'
    | 'focus_change';
  timestamp: number; // ms since session start
  data: Record<string, unknown>;
}

export interface SessionRecorder {
  record: (type: SessionEvent['type'], data: Record<string, unknown>) => void;
  flush: () => Promise<void>;
  snapshotContent: (path: string, content: string, cursorLine?: number) => void;
  recordAIPrompt: (model: string, fullPrompt: string) => void;
  recordAIResponse: (model: string, fullResponse: string, tokens: number, cost: number) => void;
  recordTerminalCommand: (input: string, output: string, exitCode?: number) => void;
  recordFileOpen: (path: string) => void;
  recordFileClose: (path: string) => void;
  recordTabSwitch: (fromPath: string, toPath: string) => void;
  recordFocus: (focused: boolean) => void;
}

export function useSessionRecorder(sessionId: string): SessionRecorder {
  const events = useRef<SessionEvent[]>([]);
  const startTime = useRef(Date.now());
  const flushingRef = useRef(false);
  const lastSnapshotHash = useRef<Map<string, number>>(new Map());

  const record = useCallback(
    (type: SessionEvent['type'], data: Record<string, unknown>) => {
      events.current.push({
        type,
        timestamp: Date.now() - startTime.current,
        data,
      });
    },
    [],
  );

  const flush = useCallback(async () => {
    if (events.current.length === 0 || flushingRef.current) return;
    flushingRef.current = true;
    const batch = [...events.current];
    events.current = [];
    try {
      await fetch('/api/assess/takehome/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, events: batch }),
      });
    } catch {
      // On failure, push events back so they are retried next flush
      events.current = [...batch, ...events.current];
    } finally {
      flushingRef.current = false;
    }
  }, [sessionId]);

  // Auto-flush every 30 seconds
  useEffect(() => {
    const interval = setInterval(flush, 30_000);
    return () => clearInterval(interval);
  }, [flush]);

  const snapshotContent = useCallback(
    (path: string, content: string, cursorLine?: number) => {
      // Skip if content unchanged since last snapshot for this path
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
      }
      if (lastSnapshotHash.current.get(path) === hash) return;
      lastSnapshotHash.current.set(path, hash);
      record('content_snapshot', { path, content, cursorLine });
    },
    [record],
  );

  const recordAIPrompt = useCallback(
    (model: string, fullPrompt: string) => {
      record('ai_prompt', { model, fullPrompt });
    },
    [record],
  );

  const recordAIResponse = useCallback(
    (model: string, fullResponse: string, tokens: number, cost: number) => {
      record('ai_response', { model, fullResponse, tokens, cost });
    },
    [record],
  );

  const recordTerminalCommand = useCallback(
    (input: string, output: string, exitCode?: number) => {
      record('terminal_command', { input, output, exitCode });
    },
    [record],
  );

  const recordFileOpen = useCallback(
    (path: string) => {
      record('file_open', { path });
    },
    [record],
  );

  const recordFileClose = useCallback(
    (path: string) => {
      record('file_close', { path });
    },
    [record],
  );

  const recordTabSwitch = useCallback(
    (fromPath: string, toPath: string) => {
      record('tab_switch', { fromPath, toPath });
    },
    [record],
  );

  const recordFocus = useCallback(
    (focused: boolean) => {
      record('focus_change', { focused });
    },
    [record],
  );

  return useMemo<SessionRecorder>(() => ({
    record,
    flush,
    snapshotContent,
    recordAIPrompt,
    recordAIResponse,
    recordTerminalCommand,
    recordFileOpen,
    recordFileClose,
    recordTabSwitch,
    recordFocus,
  }), [record, flush, snapshotContent, recordAIPrompt, recordAIResponse, recordTerminalCommand, recordFileOpen, recordFileClose, recordTabSwitch, recordFocus]);
}
