/**
 * Shared code application utility.
 * Used by both Chat UI (ArenaIDE) and Terminal UI (RuwtTUI).
 *
 * Single path: if the AI response contains code, the apply model
 * merges it into the current file. No client-side parsing.
 */

export interface CodeApplyResult {
  applied: boolean;
  newCode: string;
  method: 'apply_model' | 'none';
  message: string;
  needsApplyModel: boolean;
}

/**
 * Check if an AI response contains code that should be applied.
 * If yes, signals the caller to use the apply model.
 */
export function applyCodeFromResponse(
  responseText: string,
  currentCode: string,
  _language: string,
  mode: string
): CodeApplyResult {
  const noChange: CodeApplyResult = {
    applied: false,
    newCode: currentCode,
    method: 'none',
    message: '',
    needsApplyModel: false,
  };

  if (mode === 'ask') return noChange;

  // Any code-like content → apply model handles it
  const hasCode =
    /```/.test(responseText) ||
    /<{2,}\s*SEARCH\b/i.test(responseText) ||
    /^@@\s*-\d/m.test(responseText);

  if (hasCode) {
    return {
      applied: false,
      newCode: currentCode,
      method: 'none',
      message: '',
      needsApplyModel: true,
    };
  }

  return noChange;
}
