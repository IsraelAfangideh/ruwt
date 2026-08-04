import React, { useEffect } from 'react';
import { arena } from '@/shared/theme/colors';

/**
 * Reason the guard appeared.
 * - 'untouched': the editor still holds the challenge starter code, so the
 *   submission cannot pass. Always guarded.
 * - 'never-ran': the user has not run the public tests on this attempt yet.
 *   Guarded once, then the user is left alone.
 */
export type SubmitGuardReason = 'untouched' | 'never-ran';

interface SubmitGuardOverlayProps {
  reason: SubmitGuardReason;
  isMobile: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const COPY: Record<SubmitGuardReason, { title: string; body: string }> = {
  untouched: {
    title: 'This is still the starter code',
    body: 'You have not changed the code yet, so it cannot pass. Submitting records a failed attempt on your profile. Open the AI Chat tab to ask for help, or edit the code and run the tests first.',
  },
  'never-ran': {
    title: 'Submit without running the tests?',
    body: 'Run Tests checks your code against the public tests, and it costs you nothing. A submission runs every test and records the result on your profile.',
  },
};

function SubmitGuardOverlay({ reason, isMobile, onCancel, onConfirm }: SubmitGuardOverlayProps) {
  const { title, body } = COPY[reason];

  // Escape cancels — the safe choice, since confirming is what costs the user.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div style={isMobile ? { ...s.card, padding: '24px 20px' } : s.card}>
        <h2 style={s.title}>{title}</h2>
        <p style={s.body}>{body}</p>
        <div style={isMobile ? { ...s.actions, flexDirection: 'column' } : s.actions}>
          <button style={s.keepBtn} onClick={onCancel}>
            Keep Working
          </button>
          <button style={s.submitBtn} onClick={onConfirm}>
            Submit Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(SubmitGuardOverlay);

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 420,
    width: '90%',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: arena.text,
    margin: '0 0 12px',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
  },
  body: {
    fontSize: 13,
    color: arena.textMuted,
    margin: '0 0 24px',
    lineHeight: '1.5',
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  keepBtn: {
    background: arena.accent,
    border: 'none',
    borderRadius: 8,
    color: '#0d1117',
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  submitBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 8,
    color: arena.text,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
