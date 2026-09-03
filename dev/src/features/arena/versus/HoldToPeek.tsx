import { useCallback, useEffect, useRef, useState } from 'react';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

interface HoldToPeekProps {
  thinking: string;
  isStreaming?: boolean;
  lockedOpen?: boolean;
  label?: string;
}

export function HoldToPeek({
  thinking,
  isStreaming,
  lockedOpen = false,
  label = 'Hold to watch them think',
}: HoldToPeekProps) {
  const [held, setHeld] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const visible = lockedOpen || held;

  const release = useCallback(() => {
    setHeld(false);
  }, []);

  const press = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (lockedOpen) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom and some touch targets omit pointer capture */
    }
    setHeld(true);
  }, [lockedOpen]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (lockedOpen) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setHeld(true);
    }
  }, [lockedOpen]);

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setHeld(false);
    }
  }, []);

  useEffect(() => {
    if (!held) return;
    const onBlur = () => setHeld(false);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [held]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        data-testid="hold-to-peek"
        aria-pressed={visible}
        aria-label={lockedOpen ? 'Opponent thinking' : label}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        style={{
          background: visible ? `${arena.accent}22` : 'transparent',
          border: `1px solid ${arena.accent}55`,
          borderRadius: 8,
          color: arena.accent,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: fontFamily.mono,
          cursor: lockedOpen ? 'default' : 'pointer',
          width: '100%',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {lockedOpen ? 'How they thought' : label}
      </button>
      {visible && (
        <div
          data-testid="peek-trace"
          role="status"
          aria-live="polite"
          style={{
            position: lockedOpen ? 'relative' : 'absolute',
            zIndex: 20,
            left: 0,
            right: 0,
            top: lockedOpen ? 8 : 'calc(100% + 6px)',
            maxHeight: 220,
            overflowY: 'auto',
            padding: '8px 10px',
            background: arena.surface,
            border: `1px solid ${arena.accent}40`,
            borderLeft: '2px solid #a78bfa',
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.45,
            color: arena.textMuted,
            fontFamily: fontFamily.mono,
            whiteSpace: 'pre-wrap',
            boxShadow: lockedOpen ? 'none' : '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {thinking.trim() || (isStreaming ? 'Thinking…' : 'No thoughts yet.')}
        </div>
      )}
    </div>
  );
}
