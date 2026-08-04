import React, { useEffect } from 'react';
import { arena } from '@/shared/theme/colors';
import ArenaOverlay, { OVERLAY_TITLE, overlayActions, overlayButton } from '@/features/arena/ArenaOverlay';

/**
 * Reason the guard appeared.
 * - 'untouched': the editor still holds the challenge starter code. That code
 *   cannot pass, and the server rejects it too, so there is no way through —
 *   this variant offers no confirm button.
 * - 'never-ran': the user has not run the public tests on this attempt yet.
 *   Warned once, then the user is left alone.
 */
export type SubmitGuardReason = 'untouched' | 'never-ran';

interface SubmitGuardOverlayProps {
  reason: SubmitGuardReason;
  isMobile: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * A reason without a confirmLabel has no way through. Keep that in step with
 * the server check in functions/api/submissions.ts, which rejects unedited
 * starter code outright.
 */
const COPY: Record<SubmitGuardReason, { title: string; body: string; cancelLabel: string; confirmLabel?: string }> = {
  untouched: {
    title: 'This is still the starter code',
    body: 'You have not changed the code yet, so it cannot pass and the server will not accept it. Open the AI Chat tab to ask for help, or edit the code and run the tests.',
    cancelLabel: 'Got It',
  },
  'never-ran': {
    title: 'Submit without running the tests?',
    body: 'Run Tests checks your code against the public tests, and it costs you nothing. A submission runs every test and records the result on your profile.',
    cancelLabel: 'Keep Working',
    confirmLabel: 'Submit Anyway',
  },
};

function SubmitGuardOverlay({ reason, isMobile, onCancel, onConfirm }: SubmitGuardOverlayProps) {
  const { title, body, cancelLabel, confirmLabel } = COPY[reason];

  // Escape cancels — the safe choice, since confirming is what costs the user.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <ArenaOverlay isMobile={isMobile} label={title}>
      <h2 style={OVERLAY_TITLE}>{title}</h2>
      <p style={s.body}>{body}</p>
      <div style={overlayActions(isMobile)}>
        <button style={overlayButton('primary')} onClick={onCancel}>
          {cancelLabel}
        </button>
        {confirmLabel && (
          <button style={overlayButton('secondary', 'sm')} onClick={onConfirm}>
            {confirmLabel}
          </button>
        )}
      </div>
    </ArenaOverlay>
  );
}

export default React.memo(SubmitGuardOverlay);

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  body: {
    fontSize: 13,
    color: arena.textMuted,
    margin: '0 0 24px',
    lineHeight: '1.5',
  },
};
