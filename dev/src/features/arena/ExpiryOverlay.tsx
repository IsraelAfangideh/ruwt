import React from 'react';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import ArenaOverlay, { OVERLAY_TITLE, overlayActions, overlayButton } from '@/features/arena/ArenaOverlay';

interface ExpiryOverlayProps {
  totalTokens: number;
  totalCost: number;
  isMobile: boolean;
  onReview: () => void;
  onSubmit?: () => void;
  onRestart?: () => void;
}

function ExpiryOverlay({ totalTokens, totalCost, isMobile, onReview, onSubmit, onRestart }: ExpiryOverlayProps) {
  const testsPassed = !!onSubmit;
  return (
    <ArenaOverlay isMobile={isMobile} label={testsPassed ? 'Time is up, tests passed' : 'Time is up'}>
      <h2 style={testsPassed ? { ...s.title, color: arena.accent, margin: '0 0 8px' } : s.title}>
        {testsPassed ? 'Time\'s Up — But You Solved It!' : 'Time\'s Up!'}
      </h2>
      {testsPassed && (
        <p style={s.passedHint}>
          All tests passed. Submit now to lock in your score.
        </p>
      )}
      <div style={s.stats}>
        <div style={s.stat}>
          <span style={s.statValue}>{totalTokens.toLocaleString()}</span>
          <span style={s.statLabel}>tokens used</span>
        </div>
        <div style={s.stat}>
          <span style={s.statValue}>{formatCostFromHundredths(totalCost)}</span>
          <span style={s.statLabel}>cost</span>
        </div>
      </div>
      <div style={overlayActions(isMobile)}>
        {onSubmit && (
          <button style={overlayButton('primary')} onClick={onSubmit}>
            Submit Solution
          </button>
        )}
        <button style={overlayButton('secondary', 'sm')} onClick={onReview}>
          Review Code
        </button>
        {onRestart && (
          <button style={overlayButton('primary', 'sm')} onClick={onRestart}>
            Start New Attempt
          </button>
        )}
      </div>
    </ArenaOverlay>
  );
}

export default React.memo(ExpiryOverlay);

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  title: {
    ...OVERLAY_TITLE,
    color: arena.error,
    margin: '0 0 20px',
  },
  passedHint: {
    fontSize: 13,
    color: arena.textMuted,
    margin: '0 0 20px',
    lineHeight: '1.4',
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 600,
    color: arena.accent,
    fontFamily: fontFamily.mono,
  },
  statLabel: {
    fontSize: 11,
    color: arena.textMuted,
  },
};
