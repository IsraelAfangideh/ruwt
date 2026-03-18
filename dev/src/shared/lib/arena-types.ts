/** AI vs manual solver comparison stats, returned by POST /api/submissions for passed solves. */
export interface AiComparison {
  aiSolves: number;
  manualSolves: number;
  aiAvgTimeSecs: number | null;
  manualAvgTimeSecs: number | null;
  aiAvgCost: number | null;
  userUsedAi: boolean;
  userSolveTimeSecs: number;
}
