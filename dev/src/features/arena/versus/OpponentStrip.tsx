import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { friendlyModelName } from '@/shared/lib/ai/pricing';
import { HoldToPeek } from './HoldToPeek';
import type { VersusMatchPublic } from './types';

const STATUS_LABEL: Record<string, string> = {
  queued: 'queued',
  thinking: 'thinking',
  writing: 'writing',
  testing: 'running tests',
  passed: 'submitted',
  failed: 'stuck',
  aborted: 'stopped',
};

function formatElapsed(createdAt: string, finishedAt: string | null): string {
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.max(0, Math.floor((end - new Date(createdAt).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface OpponentStripProps {
  match: VersusMatchPublic;
  compact?: boolean;
}

export function OpponentStrip({ match, compact }: OpponentStripProps) {
  const finished = !!match.winner;
  return (
    <div
      data-testid="opponent-strip"
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: compact ? 10 : 8,
        alignItems: compact ? 'center' : 'stretch',
        padding: compact ? '8px 10px' : 12,
        background: arena.surface,
        border: `1px solid ${arena.border}`,
        borderRadius: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: arena.textSubtle, fontFamily: fontFamily.mono, letterSpacing: 0.4 }}>
            OPPONENT
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: arena.text, fontFamily: fontFamily.mono }} data-testid="opponent-model">
            {friendlyModelName(match.opponentModel)}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: fontFamily.mono, fontSize: 11, color: arena.textMuted }}>
          <div data-testid="opponent-status">{STATUS_LABEL[match.opponentStatus] ?? match.opponentStatus}</div>
          <div data-testid="opponent-elapsed">{formatElapsed(match.createdAt, match.finishedAt)}</div>
        </div>
      </div>
      {!finished && (
        <div style={{ fontSize: 12, color: arena.textSubtle, fontStyle: 'italic' }} data-testid="opponent-teaser">
          {match.teaser || 'figuring out the puzzle…'}
        </div>
      )}
      <HoldToPeek
        thinking={match.opponentThinking}
        isStreaming={match.opponentStatus === 'thinking'}
        lockedOpen={finished}
      />
    </div>
  );
}
