import React from 'react';
import { arena } from '@/theme/colors';
import { fontFamily } from '@/theme/tokens';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface ExpiryOverlayProps {
  totalTokens: number;
  totalCost: number;
  isMobile: boolean;
  onReview: () => void;
  onRestart?: () => void;
}

function ExpiryOverlay({ totalTokens, totalCost, isMobile, onReview, onRestart }: ExpiryOverlayProps) {
  return (
    <div style={s.expiryOverlay}>
      <div style={isMobile ? { ...s.expiryCard, padding: '24px 20px' } : s.expiryCard}>
        <h2 style={s.expiryTitle}>Time's Up!</h2>
        <div style={s.expiryStats}>
          <div style={s.expiryStat}>
            <span style={s.expiryStatValue}>{totalTokens.toLocaleString()}</span>
            <span style={s.expiryStatLabel}>tokens used</span>
          </div>
          <div style={s.expiryStat}>
            <span style={s.expiryStatValue}>{formatCostFromHundredths(totalCost)}</span>
            <span style={s.expiryStatLabel}>cost</span>
          </div>
        </div>
        <div style={isMobile ? { ...s.expiryActions, flexDirection: 'column' } : s.expiryActions}>
          <button
            style={s.expiryReviewBtn}
            onClick={onReview}
          >
            Review Code
          </button>
          {onRestart && (
            <button
              style={s.expiryRestartBtn}
              onClick={onRestart}
            >
              Start New Attempt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ExpiryOverlay);

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  expiryOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  expiryCard: {
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 400,
    width: '90%',
    textAlign: 'center' as const,
  },
  expiryTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: arena.error,
    margin: '0 0 20px',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
  },
  expiryStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  expiryStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  expiryStatValue: {
    fontSize: 16,
    fontWeight: 600,
    color: arena.accent,
    fontFamily: fontFamily.mono,
  },
  expiryStatLabel: {
    fontSize: 11,
    color: arena.textMuted,
  },
  expiryActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  expiryReviewBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 8,
    color: arena.text,
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  expiryRestartBtn: {
    background: arena.accent,
    border: 'none',
    borderRadius: 8,
    color: '#0d1117',
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
