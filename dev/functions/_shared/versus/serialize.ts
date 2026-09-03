import type { VersusMatch } from '../../../drizzle/schema.d1';
import type { VersusMatchPublic, VersusOpponentStatus, VersusWinner } from './types';

export function versusTeaser(thinking: string, status: string): string {
  const trimmed = thinking.trim();
  if (!trimmed) {
    if (status === 'testing') return 'running tests…';
    if (status === 'writing') return 'writing code…';
    if (status === 'thinking') return 'figuring out the puzzle…';
    if (status === 'passed') return 'submitted a solution';
    if (status === 'failed') return 'could not finish';
    if (status === 'aborted') return 'stopped';
    return 'waiting to start…';
  }
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? '';
  return last.length > 80 ? `${last.slice(0, 77)}…` : last;
}

export function serializeVersusMatch(row: VersusMatch): VersusMatchPublic {
  const status = (row.opponentStatus ?? 'queued') as VersusOpponentStatus;
  const thinking = row.opponentThinking ?? '';
  return {
    id: row.id,
    userId: row.userId,
    challengeId: row.challengeId,
    userAttemptId: row.userAttemptId,
    opponentModel: row.opponentModel,
    opponentStatus: status,
    opponentThinking: thinking,
    opponentIteration: row.opponentIteration ?? 0,
    opponentCost: row.opponentCost ?? 0,
    opponentInputTokens: row.opponentInputTokens ?? 0,
    opponentOutputTokens: row.opponentOutputTokens ?? 0,
    userPassedAt: row.userPassedAt ?? null,
    opponentPassedAt: row.opponentPassedAt ?? null,
    winner: (row.winner as VersusWinner | null) ?? null,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt ?? null,
    teaser: versusTeaser(thinking, status),
  };
}
