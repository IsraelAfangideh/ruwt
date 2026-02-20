/**
 * xterm React wrapper for the Arena IDE terminal.
 * Manages shell/ruwt mode switching and terminal lifecycle.
 */
import React, { useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { VirtualShell, type ShellCallbacks } from './VirtualShell';
import { RuwtTUI } from './RuwtTUI';
import type { VirtualFileSystem } from './VirtualFileSystem';
import { arena } from '@/theme/colors';

export interface TerminalPanelHandle {
  focus: () => void;
}

interface TerminalPanelProps {
  fs: VirtualFileSystem;
  language: string;
  attemptId: string;
  challengeTitle: string;
  challengeDescription: string;
  challengeDifficulty: string;
  challengeCategory: string | null;
  challengeTestCases: string;
  shellCallbacks: Omit<ShellCallbacks, 'onEnterRuwt'>;
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
  abortChat: () => void;
  onCodeApplied: (code: string) => void;
  onRunTests?: (code: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number; results?: unknown[] }>;
  isExpired: () => boolean;
}

export const TerminalPanel = React.forwardRef<TerminalPanelHandle, TerminalPanelProps>(
  function TerminalPanel(props, ref) {
    const {
      fs, language, attemptId, challengeTitle, challengeDescription,
      challengeDifficulty, challengeCategory, challengeTestCases,
      shellCallbacks, streamChat, abortChat, onCodeApplied, onRunTests, isExpired,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const shellRef = useRef<VirtualShell | null>(null);
    const tuiRef = useRef<RuwtTUI | null>(null);
    const modeRef = useRef<'shell' | 'ruwt'>('shell');

    // Expose focus method
    useImperativeHandle(ref, () => ({
      focus: () => termRef.current?.focus(),
    }));

    // Stable callback refs to avoid recreating shell/tui on prop changes
    const shellCallbacksRef = useRef(shellCallbacks);
    shellCallbacksRef.current = shellCallbacks;
    const streamChatRef = useRef(streamChat);
    streamChatRef.current = streamChat;
    const abortChatRef = useRef(abortChat);
    abortChatRef.current = abortChat;
    const onCodeAppliedRef = useRef(onCodeApplied);
    onCodeAppliedRef.current = onCodeApplied;
    const isExpiredRef = useRef(isExpired);
    isExpiredRef.current = isExpired;
    const onRunTestsRef = useRef(onRunTests);
    onRunTestsRef.current = onRunTests;

    const enterRuwt = useCallback(() => {
      modeRef.current = 'ruwt';
      tuiRef.current = new RuwtTUI({
        term: termRef.current!,
        fs,
        language,
        attemptId,
        challengeTitle,
        challengeDescription,
        challengeDifficulty,
        challengeCategory,
        challengeTestCases,
        streamChat: (...args) => streamChatRef.current(...args),
        abort: () => abortChatRef.current(),
        onExit: () => {
          modeRef.current = 'shell';
          tuiRef.current = null;
          termRef.current?.write('\r\n\x1b[90mExited ruwt mode.\x1b[0m');
          shellRef.current?.printPrompt();
        },
        onCodeApplied: (code) => onCodeAppliedRef.current(code),
        onRunTests: (...args) => onRunTestsRef.current?.(...args) as any,
        isExpired: () => isExpiredRef.current(),
      });
      tuiRef.current.enter();
    }, [fs, language, attemptId, challengeTitle, challengeDescription, challengeDifficulty, challengeCategory, challengeTestCases]);

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new Terminal({
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#c9a962',
          selectionBackground: 'rgba(201,169,98,0.3)',
          black: '#0d1117',
          red: '#f85149',
          green: '#3fb950',
          yellow: '#c9a962',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39d2e0',
          white: '#e6edf3',
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 1000,
        convertEol: false,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      // Initial fit
      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch { /* container not ready */ }
      });

      termRef.current = term;
      fitRef.current = fitAddon;

      // Create shell
      const shell = new VirtualShell(term, fs, language, {
        onRunCode: (...args) => shellCallbacksRef.current.onRunCode(...args),
        onRunTests: (...args) => shellCallbacksRef.current.onRunTests(...args),
        onEnterRuwt: () => enterRuwt(),
      });
      shellRef.current = shell;

      // Welcome message
      term.write('\x1b[1;33mruwt arena\x1b[0m \x1b[90m\u2014 virtual terminal\x1b[0m\r\n');
      term.write('\x1b[90mType \x1b[33mhelp\x1b[90m for commands, \x1b[33mruwt\x1b[90m for AI assistant.\x1b[0m');
      shell.printPrompt();

      // Route input based on mode
      const onData = term.onData((data: string) => {
        if (modeRef.current === 'ruwt' && tuiRef.current) {
          tuiRef.current.handleInput(data);
        } else {
          shell.handleInput(data);
        }
      });

      // Resize handling
      let resizeTimer: ReturnType<typeof setTimeout>;
      const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          try { fitAddon.fit(); } catch { /* ignore */ }
        }, 50);
      };

      const observer = new ResizeObserver(handleResize);
      observer.observe(containerRef.current);
      window.addEventListener('resize', handleResize);

      return () => {
        onData.dispose();
        observer.disconnect();
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimer);
        term.dispose();
        termRef.current = null;
        fitRef.current = null;
        shellRef.current = null;
        tuiRef.current = null;
      };
    }, [fs, language, enterRuwt]);

    return (
      <div
        ref={containerRef}
        onClick={() => termRef.current?.focus()}
        style={{
          flex: 1,
          minHeight: 0,
          background: arena.bg,
          padding: '4px 0 0 4px',
          overflow: 'hidden',
        }}
      />
    );
  }
);
