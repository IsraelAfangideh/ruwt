import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { friendlyModelName } from '@/shared/lib/ai/pricing';
import type { VersusMatchPublic } from './types';

interface VersusEndOverlayProps {
  match: VersusMatchPublic;
  onRematch: () => void;
  onBack: () => void;
}

export function VersusEndOverlay({ match, onRematch, onBack }: VersusEndOverlayProps) {
  const model = friendlyModelName(match.opponentModel);
  const userWon = match.winner === 'user';

  return (
    <div
      data-testid="versus-end-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(8,8,6,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 40,
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: arena.surface,
          border: `1px solid ${arena.border}`,
          borderRadius: 12,
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, fontFamily: fontFamily.mono, color: arena.accent, marginBottom: 8 }}>
          VERSUS
        </div>
        <h2
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 28,
            margin: '0 0 8px',
            color: userWon ? arena.success : arena.error,
          }}
        >
          {userWon ? 'Still here.' : 'That model just took your puzzle.'}
        </h2>
        <p style={{ fontSize: 14, color: arena.textMuted, lineHeight: 1.5, margin: '0 0 20px' }}>
          {userWon
            ? `You beat ${model}. Prove you're not replaceable — again.`
            : `${model} submitted first. Rematch whenever you're ready.`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={onRematch}
            data-testid="versus-rematch"
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 8,
              color: '#0d1117',
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Rematch {model}
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: arena.textSubtle,
              fontSize: 12,
              fontFamily: fontFamily.mono,
              cursor: 'pointer',
            }}
          >
            Back to Problems
          </button>
        </div>
      </div>
    </div>
  );
}
