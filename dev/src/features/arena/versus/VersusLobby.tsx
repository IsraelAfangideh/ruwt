import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import {
  TIER_ORDER,
  getModelsForTier,
  TIER_MODELS,
  formatCostFromHundredths,
  estimateVersusMatchCost,
  defaultVersusTier,
  friendlyModelName,
  type ModelTier,
} from '@/shared/lib/ai/pricing';

interface VersusLobbyProps {
  mode: 'union' | 'versus';
  onMode: (mode: 'union' | 'versus') => void;
  difficulty: string;
  language: string;
  opponentModel: string;
  onOpponentModel: (id: string) => void;
}

export function VersusLobby({
  mode,
  onMode,
  difficulty,
  language,
  opponentModel,
  onOpponentModel,
}: VersusLobbyProps) {
  const defaultTier = defaultVersusTier(difficulty);
  const estimated = estimateVersusMatchCost(opponentModel);

  return (
    <div style={{ width: '100%', maxWidth: 400, marginBottom: 24 }}>
      <div
        role="tablist"
        aria-label="Play mode"
        style={{
          display: 'flex',
          border: `1px solid ${arena.border}`,
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        {(['union', 'versus'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            data-testid={`mode-${m}`}
            onClick={() => onMode(m)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              background: mode === m ? arena.accent : 'transparent',
              color: mode === m ? '#0d1117' : arena.textMuted,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: fontFamily.body,
            }}
          >
            {m === 'union' ? 'Union' : 'Versus'}
          </button>
        ))}
      </div>

      {mode === 'versus' && (
        <div data-testid="versus-lobby" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: arena.textMuted, lineHeight: 1.55, margin: 0, textAlign: 'center' }}>
            Prove you're not replaceable. You code unaided. First correct submit wins.
            Hold to watch them think — it's a hint.
          </p>
          <div style={{ fontSize: 12, color: arena.textSubtle, fontFamily: fontFamily.mono, textAlign: 'center' }}>
            Language: {language}
          </div>
          <label style={{ fontSize: 11, color: arena.textSubtle, fontFamily: fontFamily.mono }}>
            Opponent
            <select
              data-testid="versus-model"
              value={opponentModel}
              onChange={(e) => onOpponentModel(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '8px 10px',
                background: arena.surface,
                color: arena.text,
                border: `1px solid ${arena.border}`,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {TIER_ORDER.map((tier: ModelTier) => (
                <optgroup key={tier} label={tier === defaultTier ? `${tier} (suggested)` : tier}>
                  {getModelsForTier(tier).map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 12, color: arena.textMuted, textAlign: 'center' }}>
            Est. opponent cost {formatCostFromHundredths(estimated)} — we cover it.
            Racing {friendlyModelName(opponentModel || TIER_MODELS[defaultTier].id)}.
          </div>
        </div>
      )}
    </div>
  );
}
