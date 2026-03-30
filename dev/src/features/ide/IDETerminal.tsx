/**
 * IDETerminal: xterm-based terminal connected to a RuntimeBackend.
 * Uses backend.connectTerminal() for bidirectional I/O.
 */
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { RuntimeBackend } from '@/lib/sandbox/runtime';
import { arena, arenaTermTheme } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

interface IDETerminalProps {
  backend?: RuntimeBackend;
}

export function IDETerminal({ backend }: IDETerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!containerRef.current) return;

    let disposed = false;

    const term = new Terminal({
      theme: arenaTermTheme,
      fontFamily: fontFamily.mono,
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 1000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;

    // Initial fit
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* container not ready */ }
    });

    // Connect terminal to runtime backend
    let connection: { write: (data: string) => void; resize: (cols: number, rows: number) => void; disconnect: () => void } | null = null;

    if (backend) {
      connection = backend.connectTerminal((data: string) => {
        if (!disposed) term.write(data);
      });

      const onDataDisposable = term.onData((data: string) => {
        connection?.write(data);
      });

      (term as any).__onDataDisposable = onDataDisposable;
    } else {
      term.write('Waiting for runtime...\r\n');
    }

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
      disposed = true;
      (term as any).__onDataDisposable?.dispose();
      connection?.disconnect();
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      term.dispose();
      termRef.current = null;
    };
  }, [backend]);

  return (
    <div
      style={wrapperStyle}
      role="region"
      aria-label="Terminal"
      data-testid="ide-terminal"
    >
      <div style={headerStyle}>
        <span style={headerTitleStyle}>Terminal</span>
      </div>
      <div
        ref={containerRef}
        onClick={/* istanbul ignore next -- @preserve */ () => termRef.current?.focus()}
        role="application"
        aria-roledescription="terminal"
        aria-label="Interactive terminal"
        tabIndex={0}
        style={termBodyStyle}
      />
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
};

const headerStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: arena.textMuted,
};

const termBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  background: arena.bg,
  padding: '4px 0 0 4px',
  overflow: 'hidden',
};
