export type VersusOpponentStatus =
  | 'queued'
  | 'thinking'
  | 'writing'
  | 'testing'
  | 'passed'
  | 'failed'
  | 'aborted';

export type VersusWinner = 'user' | 'opponent';

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
