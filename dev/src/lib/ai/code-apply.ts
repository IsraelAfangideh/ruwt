/**
 * Shared code application utility.
 * Used by both Chat UI (ArenaIDE) and Terminal UI (RuwtTUI).
 *
 * Tries structured parsing first (SEARCH/REPLACE, unified diff, fenced code blocks).
 * Only falls back to the apply model when structured parsing fails.
 */

import {
  hasEditBlocks,
  parseEditBlocks,
  hasBareConflictMarkers,
  parseBareConflictBlocks,
  hasUnifiedDiff,
  parseUnifiedDiff,
  applyEditBlocks,
} from './diff-apply';

export interface CodeApplyResult {
  applied: boolean;
  newCode: string;
  method: 'search_replace' | 'unified_diff' | 'code_block' | 'apply_model' | 'none';
  message: string;
  needsApplyModel: boolean;
}

export interface FileEdit {
  path: string;
  content: string;
}

/**
 * Extract FILE: prefixed code blocks from AI response.
 * Returns the extracted file edits and the remaining response text.
 */
export function extractFileEdits(responseText: string): { fileEdits: FileEdit[]; remaining: string } {
  const fileEdits: FileEdit[] = [];
  let remaining = responseText;

  // Match: FILE: <path>\n```<lang>\n<content>\n```
  const fileBlockPattern = /FILE:\s*(\S+)\s*\n```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = fileBlockPattern.exec(responseText)) !== null) {
    fileEdits.push({ path: match[1], content: match[2].trimEnd() });
    remaining = remaining.replace(match[0], '');
  }

  return { fileEdits, remaining: remaining.trim() };
}

/**
 * Extract the largest fenced code block from AI response.
 * Returns the code content or null if none found.
 */
function extractFencedCode(responseText: string): string | null {
  const codeBlockPattern = /```(?:\w*)\n([\s\S]*?)```/g;
  let best: string | null = null;
  let bestLen = 0;
  let match;

  while ((match = codeBlockPattern.exec(responseText)) !== null) {
    const content = match[1].trimEnd();
    if (content.length > bestLen) {
      best = content;
      bestLen = content.length;
    }
  }

  return best;
}

/**
 * Try to apply code from an AI response using structured parsing.
 * Falls through to apply model only when all parsing strategies fail.
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

  // 1. Try SEARCH/REPLACE blocks (most precise, character-perfect)
  if (hasEditBlocks(responseText)) {
    const blocks = parseEditBlocks(responseText);
    if (blocks.length > 0) {
      const result = applyEditBlocks(currentCode, blocks);
      if (result.applied > 0) {
        const msg = result.failed > 0
          ? `Applied ${result.applied} edit(s), ${result.failed} failed`
          : `Applied ${result.applied} edit(s)`;
        return {
          applied: true,
          newCode: result.newCode,
          method: 'search_replace',
          message: msg,
          needsApplyModel: false,
        };
      }
      // All blocks failed — fall through to other strategies
    }
  }

  // 2. Try bare conflict markers: <<<<<<< ... >>>>>>> pairs without SEARCH/REPLACE labels
  //    Models like Llama 3.1 produce this format (first block = original, second = replacement)
  if (hasBareConflictMarkers(responseText)) {
    const bareBlocks = parseBareConflictBlocks(responseText);
    if (bareBlocks.length > 0) {
      const result = applyEditBlocks(currentCode, bareBlocks);
      if (result.applied > 0) {
        const msg = result.failed > 0
          ? `Applied ${result.applied} edit(s), ${result.failed} failed`
          : `Applied ${result.applied} edit(s)`;
        return {
          applied: true,
          newCode: result.newCode,
          method: 'search_replace',
          message: msg,
          needsApplyModel: false,
        };
      }
    }
  }

  // 3. Try unified diff (also character-perfect)
  if (hasUnifiedDiff(responseText)) {
    const blocks = parseUnifiedDiff(responseText);
    if (blocks.length > 0) {
      const result = applyEditBlocks(currentCode, blocks);
      if (result.applied > 0) {
        return {
          applied: true,
          newCode: result.newCode,
          method: 'unified_diff',
          message: `Applied ${result.applied} diff hunk(s)`,
          needsApplyModel: false,
        };
      }
    }
  }

  // 4. Try extracting full code from fenced block (preserves exact characters)
  const extracted = extractFencedCode(responseText);
  if (extracted && extracted.trim().length >= 20) {
    // Only use direct extraction if the block looks like a complete file,
    // not a tiny snippet. A complete file should be a substantial portion
    // of the current code, or contain function/class definitions.
    const looksComplete =
      extracted.length >= currentCode.length * 0.3 ||
      /(?:^function |^class |^const |^def |^import |module\.exports)/m.test(extracted);

    if (looksComplete) {
      return {
        applied: true,
        newCode: extracted,
        method: 'code_block',
        message: 'Code applied',
        needsApplyModel: false,
      };
    }
  }

  // 5. Check if there's any code-like content that we couldn't parse
  const hasCode =
    /```/.test(responseText) ||
    /<{2,}\s*SEARCH\b/i.test(responseText) ||
    /^@@\s*-\d/m.test(responseText) ||
    (/^<{3,}\s*$/m.test(responseText) && /^>{3,}\s*$/m.test(responseText));

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
