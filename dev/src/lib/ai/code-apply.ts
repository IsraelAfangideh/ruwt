/**
 * Shared code application utility.
 * Extracts and applies code edits from AI responses.
 * Used by both Chat UI (ArenaIDE) and Terminal UI (RuwtTUI).
 *
 * Pipeline:
 * 1. SEARCH/REPLACE blocks (exact -> fuzzy match)
 * 2. Unified diff hunks
 * 3. If structured edits were present but ALL failed -> needsApplyModel = true
 * 4. Code block extraction (with harness protection)
 * 5. No code found
 */

import {
  parseEditBlocks,
  applyEditBlocks,
  hasEditBlocks,
  parseUnifiedDiff,
  hasUnifiedDiff,
} from './diff-apply';

export interface CodeApplyResult {
  applied: boolean;
  newCode: string;
  method: 'search_replace' | 'unified_diff' | 'code_block' | 'none';
  message: string;
  needsApplyModel: boolean;
}

/**
 * Extract the best code block from an AI response.
 * Prefers blocks matching the challenge language.
 * Includes harness protection: if current code has solve() but the
 * extracted block doesn't, splices the implementation function in.
 */
export function extractBestCodeBlock(
  text: string,
  language: string,
  currentCode?: string
): string | null {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let bestMatch: string | null = null;
  let bestLangMatch: string | null = null;
  let bestLen = 0;
  let bestLangLen = 0;

  // Detect the TODO function name from current code (e.g. "function resolveEnv")
  const todoMatch = currentCode?.match(
    /\/\/\s*(?:TODO|Your code here)[^\n]*[\s\S]*?^(function\s+(\w+))/m
  );
  const todoFnName = todoMatch?.[2];

  while ((match = regex.exec(text)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2];
    // Skip code blocks that contain diff/SEARCH markers — these are edit instructions, not code
    if (
      /<<<<<<< SEARCH|>>>>>>> REPLACE|^---\s+a\/|^\+\+\+\s+b\//m.test(code)
    )
      continue;

    // Prefer blocks containing the TODO function name
    const hasTodoFn = todoFnName && code.includes(todoFnName);
    const score = code.length + (hasTodoFn ? 100000 : 0);

    if (score > bestLen) {
      bestMatch = code;
      bestLen = score;
    }
    if ((lang === language || lang === '') && score > bestLangLen) {
      bestLangMatch = code;
      bestLangLen = score;
    }
  }

  const chosen = bestLangMatch ?? bestMatch;
  if (!chosen) return null;

  // Harness protection: if current code has solve() but the chosen block doesn't,
  // the model only wrote the TODO function — don't replace the whole file
  if (
    currentCode &&
    /^function solve\b/m.test(currentCode) &&
    !/^function solve\b/m.test(chosen)
  ) {
    if (todoFnName) {
      const fnRegex = new RegExp(
        `(function ${todoFnName}\\b[\\s\\S]*?^\\})`,
        'm'
      );
      const currentFnMatch = currentCode.match(fnRegex);
      const newFnMatch = chosen.match(fnRegex);
      if (currentFnMatch && newFnMatch) {
        return currentCode.replace(currentFnMatch[0], newFnMatch[0]);
      }
    }
  }

  return chosen;
}

/**
 * Apply code from an AI response. Tries structured edits first,
 * then falls back to code block extraction.
 *
 * @param responseText - Full AI response text (may contain tool calls, markdown, etc.)
 * @param currentCode - Current code in the editor/VFS
 * @param language - Programming language for code block matching
 * @param mode - AI mode ('ask' mode skips code application)
 * @returns CodeApplyResult with the outcome
 */
export function applyCodeFromResponse(
  responseText: string,
  currentCode: string,
  language: string,
  mode: string
): CodeApplyResult {
  const noChange: CodeApplyResult = {
    applied: false,
    newCode: currentCode,
    method: 'none',
    message: '',
    needsApplyModel: false,
  };

  // Skip code application in ask mode
  if (mode === 'ask') return noChange;

  let hadStructuredEdits = false;

  // 1. Try SEARCH/REPLACE blocks
  if (hasEditBlocks(responseText)) {
    hadStructuredEdits = true;
    const blocks = parseEditBlocks(responseText);
    if (blocks.length > 0) {
      const result = applyEditBlocks(currentCode, blocks);
      if (result.applied > 0) {
        const msg =
          result.failed > 0
            ? `${result.applied} edit(s) applied, ${result.failed} failed`
            : `${result.applied} edit(s) applied`;
        return {
          applied: true,
          newCode: result.newCode,
          method: 'search_replace',
          message: msg,
          needsApplyModel: false,
        };
      }
      // All blocks failed — signal that apply model should be tried
      if (result.failed > 0) {
        return {
          applied: false,
          newCode: currentCode,
          method: 'none',
          message: 'All SEARCH/REPLACE blocks failed to match',
          needsApplyModel: true,
        };
      }
    }
  }

  // 2. Try unified diff format (--- a/ / +++ b/ / @@)
  if (hasUnifiedDiff(responseText)) {
    hadStructuredEdits = true;
    const blocks = parseUnifiedDiff(responseText);
    if (blocks.length > 0) {
      const result = applyEditBlocks(currentCode, blocks);
      if (result.applied > 0) {
        return {
          applied: true,
          newCode: result.newCode,
          method: 'unified_diff',
          message: `${result.applied} diff hunk(s) applied`,
          needsApplyModel: false,
        };
      }
      // Diff hunks present but none matched
      if (result.failed > 0) {
        return {
          applied: false,
          newCode: currentCode,
          method: 'none',
          message: 'Unified diff hunks failed to match',
          needsApplyModel: true,
        };
      }
    }
  }

  // 3. If structured edits were present but all failed, signal apply model
  if (hadStructuredEdits) {
    return {
      applied: false,
      newCode: currentCode,
      method: 'none',
      message: 'Structured edits failed',
      needsApplyModel: true,
    };
  }

  // 4. Fallback: extract best code block (with harness protection)
  const codeBlock = extractBestCodeBlock(responseText, language, currentCode);
  if (codeBlock) {
    return {
      applied: true,
      newCode: codeBlock,
      method: 'code_block',
      message: 'Code updated',
      needsApplyModel: false,
    };
  }

  // 5. No code found
  return noChange;
}
