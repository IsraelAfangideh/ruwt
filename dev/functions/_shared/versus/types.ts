export type VersusOpponentStatus =
  | 'queued'
  | 'thinking'
  | 'writing'
  | 'testing'
  | 'passed'
  | 'failed'
  | 'aborted';

export type VersusWinner = 'user' | 'opponent';

export const MAX_VERSUS_TICKS = 5;

/** Rough tokens per opponent tick used for lobby cost estimates. */
export const VERSUS_TICK_INPUT_TOKENS = 2000;
export const VERSUS_TICK_OUTPUT_TOKENS = 1500;

export interface VersusMatchPublic {
  id: string;
  userId: string;
  challengeId: string;
  userAttemptId: string;
  opponentModel: string;
  opponentStatus: VersusOpponentStatus;
  opponentThinking: string;
  opponentIteration: number;
  opponentCost: number;
  opponentInputTokens: number;
  opponentOutputTokens: number;
  userPassedAt: string | null;
  opponentPassedAt: string | null;
  winner: VersusWinner | null;
  createdAt: string;
  finishedAt: string | null;
  teaser: string;
}

export type VersusSseEvent =
  | { type: 'thinking'; content: string }
  | { type: 'chunk'; content: string }
  | { type: 'status'; status: VersusOpponentStatus; teaser?: string }
  | { type: 'done'; match: VersusMatchPublic; continue: boolean }
  | { type: 'error'; error: string };
