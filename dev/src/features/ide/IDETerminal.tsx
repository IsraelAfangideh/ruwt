/**
 * IDETerminal: xterm-based terminal connected to a WebContainer shell.
 * Spawns `jsh` (WebContainer's built-in shell) on mount.
 */
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { spawnWithInput } from '@/lib/sandbox/webcontainer';
import { arena, arenaTermTheme } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

export function IDETerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (!containerRef.current) return;

    let disposed = false;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let writer: WritableStreamDefaultWriter<string> | null = null;

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

    // Spawn shell and wire streams
    async function startShell() {
      try {
        const proc = await spawnWithInput('jsh');

        if (disposed) return;

        writer = proc.input.getWriter();
        reader = proc.output.getReader();

        // Pipe output → terminal
        async function pumpOutput() {
          /* istanbul ignore next -- @preserve */
          if (!reader) return;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done || disposed) break;
              term.write(value);
            }
          } catch {
            // Stream closed or disposed
          }
        }
        pumpOutput();

        // Pipe terminal input → shell stdin
        const onDataDisposable = term.onData((data: string) => {
          /* istanbul ignore next -- @preserve */
          writer?.write(data).catch(() => {});
        });

        // Store for cleanup
        (term as any).__onDataDisposable = onDataDisposable;
      } catch {
        /* istanbul ignore next -- @preserve */
        if (!disposed) {
          term.write('\r\n\x1b[31mFailed to start shell.\x1b[0m\r\n');
        }
      }
    }
    startShell();

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
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      reader?.cancel().catch(() => {});
      writer?.close().catch(() => {});
      term.dispose();
      termRef.current = null;
    };
  }, []);

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
