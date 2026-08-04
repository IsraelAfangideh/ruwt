import React from 'react';
import { arena } from '@/shared/theme/colors';
import ModalOverlay, { OVERLAY_TITLE, overlayActions, overlayButton } from '@/shared/ui/ModalOverlay';

interface TakeHomeSubmitGuardProps {
  /** True when the candidate has not changed any starter file. */
  untouched: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms the take-home submission.
 *
 * Unlike an Arena attempt — one row among many, and restartable — this one
 * POST ends the assessment for good: the server sets status 'completed' and
 * rejects every later submit. A reviewer then reads the result. So the
 * confirmation is unconditional, not a one-time nudge.
 *
 * An untouched scaffold adds a warning but does not block. A candidate is
 * allowed to hand in nothing; they just should not do it by accident.
 */
function TakeHomeSubmitGuard({ untouched, onCancel, onConfirm }: TakeHomeSubmitGuardProps) {
  return (
    <ModalOverlay label="Submit and end the assessment?" onDismiss={onCancel}>
      <h2 style={OVERLAY_TITLE}>Submit and end the assessment?</h2>
      <p style={s.body}>
        This ends your take-home. You cannot reopen it, change your files, or
        submit again. Your reviewer sees exactly what you submit now.
      </p>
      {untouched && (
        <p style={s.warning} data-testid="takehome-untouched-warning">
          You have not changed any of the starter files yet.
        </p>
      )}
      <div style={overlayActions()}>
        <button style={overlayButton('primary')} onClick={onCancel} data-testid="takehome-keep-working">
          Keep Working
        </button>
        <button style={overlayButton('secondary', 'sm')} onClick={onConfirm} data-testid="takehome-confirm-submit">
          Submit and Finish
        </button>
      </div>
    </ModalOverlay>
  );
}

export default React.memo(TakeHomeSubmitGuard);

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  body: {
    fontSize: 13,
    color: arena.textMuted,
    margin: '0 0 16px',
    lineHeight: '1.5',
  },
  warning: {
    fontSize: 13,
    color: arena.error,
    margin: '0 0 24px',
    lineHeight: '1.5',
  },
};
