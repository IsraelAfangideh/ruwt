'use client';

import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onInput?: (data: string) => void;
  className?: string;
}

export function Terminal({ onInput, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new XTerm({
      theme: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#ffffff33',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle input
    if (onInput) {
      terminal.onData(onInput);
    }

    // Write welcome message
    terminal.writeln('\x1b[1;32mRuwt Terminal\x1b[0m');
    terminal.writeln('WebContainer environment ready.\n');
    terminal.write('$ ');

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onInput]);

  // Expose methods to write to terminal
  const write = (data: string) => {
    xtermRef.current?.write(data);
  };

  const writeln = (data: string) => {
    xtermRef.current?.writeln(data);
  };

  const clear = () => {
    xtermRef.current?.clear();
  };

  // Expose terminal instance for external control
  useEffect(() => {
    if (terminalRef.current) {
      (terminalRef.current as HTMLDivElement & {
        terminalInstance?: {
          write: typeof write;
          writeln: typeof writeln;
          clear: typeof clear;
        };
      }).terminalInstance = { write, writeln, clear };
    }
  }, []);

  return (
    <div
      ref={terminalRef}
      className={className}
      style={{ height: '100%', width: '100%' }}
    />
  );
}

// Hook to control terminal from parent
export function useTerminal(ref: React.RefObject<HTMLDivElement | null>) {
  return {
    write: (data: string) => {
      const instance = (ref.current as HTMLDivElement & {
        terminalInstance?: { write: (data: string) => void };
      })?.terminalInstance;
      instance?.write(data);
    },
    writeln: (data: string) => {
      const instance = (ref.current as HTMLDivElement & {
        terminalInstance?: { writeln: (data: string) => void };
      })?.terminalInstance;
      instance?.writeln(data);
    },
    clear: () => {
      const instance = (ref.current as HTMLDivElement & {
        terminalInstance?: { clear: () => void };
      })?.terminalInstance;
      instance?.clear();
    },
  };
}
