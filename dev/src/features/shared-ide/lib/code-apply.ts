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
  failedCount: number;
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
 * Heuristic: does this code block content look like a diff rather than raw code?
 * Checks for @@ hunk headers and +/- prefixed lines.
 */
function looksLikeDiff(content: string): boolean {
  /* istanbul ignore next -- @preserve */
  if (/^@@/m.test(content)) return true;
  const lines = content.split('\n');
  const diffLines = lines.filter(l => /^[-+][^-+]/.test(l) || /^[-+]$/.test(l));
  /* istanbul ignore next -- @preserve */
  return diffLines.length >= 3 && diffLines.length / lines.length >= 0.3;
}

/**
 * Extract the largest fenced code block from AI response.
 * Returns the code content or null if none found.
 * Skips blocks that look like diffs — those should be parsed by the diff applier.
 */
function extractFencedCode(responseText: string): string | null {
  const codeBlockPattern = /```(?:\w*)\n([\s\S]*?)```/g;
  let best: string | null = null;
  let bestLen = 0;
  let match;

  while ((match = codeBlockPattern.exec(responseText)) !== null) {
    const content = match[1].trimEnd();
    /* istanbul ignore next -- @preserve */
    if (looksLikeDiff(content)) continue;
    if (content.length > bestLen) {
      best = content;
      bestLen = content.length;
    }
  }

  return best;
}

/** Keywords indicating a code block is a complete file, not an illustrative snippet. */
const CODE_STRUCTURE_RE = /(?:^function |^class |^const |^def |^import |module\.exports)/m;

/** Minimum ratio of extracted code block size to current code size for acceptance. */
const MIN_CODE_BLOCK_RATIO = 0.5;

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
    failedCount: 0,
  };

  if (mode === 'ask') return noChange;

  // Detect structured edit formats upfront. Cache results to avoid re-scanning.
  // If any format is present, fenced code blocks are explanatory snippets,
  // not full replacements (skipped at step 4).
  const detectedEditBlocks = hasEditBlocks(responseText);
  const detectedBareConflict = hasBareConflictMarkers(responseText);
  const detectedUnifiedDiff = hasUnifiedDiff(responseText);
  const hadStructuredEdits = detectedEditBlocks || detectedBareConflict || detectedUnifiedDiff;

  // 1. Try SEARCH/REPLACE blocks (most precise, character-perfect)
  //    Apply only the first block — subsequent blocks are applied in later agent loop
  //    iterations after the model sees the updated file state. This prevents conflicts
  //    where blocks 2–N reference code that block 1 already changed.
  if (detectedEditBlocks) {
    const blocks = parseEditBlocks(responseText);
    if (blocks.length > 0) {
      const result = applyEditBlocks(currentCode, blocks.slice(0, 1));
      if (result.applied > 0) {
        return {
          applied: true,
          newCode: result.newCode,
          method: 'search_replace',
          message: `Applied 1 edit${blocks.length > 1 ? ` (${blocks.length - 1} deferred to next round)` : ''}`,
          needsApplyModel: false,
          failedCount: result.failed,
        };
      }
      // Block failed — fall through to other strategies
    }
  }

  // 2. Try bare conflict markers: <<<<<<< ... >>>>>>> pairs without SEARCH/REPLACE labels
  //    Models like Llama 3.1 produce this format (first block = original, second = replacement)
  if (detectedBareConflict) {
    const bareBlocks = parseBareConflictBlocks(responseText);
    if (bareBlocks.length > 0) {
      const result = applyEditBlocks(currentCode, bareBlocks.slice(0, 1));
      if (result.applied > 0) {
        return {
          applied: true,
          newCode: result.newCode,
          method: 'search_replace',
          message: `Applied 1 edit${bareBlocks.length > 1 ? ` (${bareBlocks.length - 1} deferred to next round)` : ''}`,
          needsApplyModel: false,
          failedCount: result.failed,
        };
      }
    }
  }

  // 3. Try unified diff (also character-perfect)
  if (detectedUnifiedDiff) {
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
          failedCount: result.failed,
        };
      }
    }
  }

  // 4. Try extracting full code from fenced block (preserves exact characters)
  //    SKIP if the response contained structured edits (SEARCH/REPLACE, conflict
  //    markers, unified diff) — fenced code blocks in those responses are
  //    explanatory snippets, not full-file replacements. Applying them would
  //    overwrite the entire file with a partial snippet.
  if (!hadStructuredEdits) {
    const extracted = extractFencedCode(responseText);
    if (extracted && extracted.length >= 20) {
      const hasCodeStructure = CODE_STRUCTURE_RE.test(extracted);
      const isSubstantial = extracted.length >= currentCode.length * MIN_CODE_BLOCK_RATIO;

      if (hasCodeStructure && isSubstantial) {
        return {
          applied: true,
          newCode: extracted,
          method: 'code_block',
          message: 'Code applied',
          needsApplyModel: false,
          failedCount: 0,
        };
      }
    }
  }

  // 5. Check if there's any code-like content that we couldn't parse
  const hasCode =
    /```/.test(responseText) ||
    hadStructuredEdits ||
    /^@@/m.test(responseText);

  if (hasCode) {
    return {
      applied: false,
      newCode: currentCode,
      method: 'none',
      message: '',
      needsApplyModel: true,
      failedCount: 0,
    };
  }

  return noChange;
}
