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
import { callApplyModel } from './apply-model';
import type { VirtualFileSystem } from '../VirtualFileSystem';

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
 *
 * When `isSolutionFile` is provided, FILE: blocks targeting the solution file
 * are left in the remaining text so they go through the normal diff-apply
 * pipeline (SEARCH/REPLACE → unified diff → code block → apply model).
 * This prevents the bug where a model targets "main.js" (the executor filename)
 * instead of the actual solution filename, causing the edit to write to the
 * wrong path in the virtual filesystem.
 */
export function extractFileEdits(
  responseText: string,
  isSolutionFile?: (path: string) => boolean,
): { fileEdits: FileEdit[]; remaining: string } {
  const fileEdits: FileEdit[] = [];
  let remaining = responseText;

  // Match: FILE: <path>\n```<lang>\n<content>\n```
  const fileBlockPattern = /FILE:\s*(\S+)\s*\n```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = fileBlockPattern.exec(responseText)) !== null) {
    if (isSolutionFile && isSolutionFile(match[1])) {
      continue; // Leave in remaining for the diff apply pipeline
    }
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

/* ── Full AI response → solution code pipeline ─────────────────────── */

export interface ApplyAIResponseResult {
  /** Whether the solution code was changed */
  codeChanged: boolean;
  /** Number of failed edit blocks in structured apply */
  failedCount: number;
  /** Paths of helper files written by FILE: blocks */
  helperFilesWritten: string[];
  /** Solution code before any changes */
  oldCode: string;
  /** Solution code after changes (same as oldCode if !codeChanged) */
  newCode: string;
  /** Human-readable message about what happened */
  message: string;
  /** Apply model returned verified=false (caller should show error UI) */
  applyModelVerifyFailed: boolean;
  /** Apply model cost tracking (only set when apply model was used) */
  applyModelCost?: number;
  applyModelInputTokens?: number;
  applyModelOutputTokens?: number;
}

/**
 * Full pipeline: parse AI response → apply edits to solution code.
 * Handles FILE: blocks, structured diffs, and apply-model fallback.
 * Both ArenaIDE and RuwtTUI call this instead of duplicating the logic.
 */
export async function applyAIResponse(
  fs: VirtualFileSystem,
  responseText: string,
  language: string,
  mode: string,
  attemptId: string | null,
  challengeId?: string,
  challengeTitle?: string,
): Promise<ApplyAIResponseResult> {
  // 1. Extract FILE: blocks, skipping solution-targeted ones
  const { fileEdits, remaining } = extractFileEdits(
    responseText,
    (path) => fs.isSolutionPath(path),
  );
  const helperFilesWritten: string[] = [];
  for (const edit of fileEdits) {
    fs.writeFile(edit.path, edit.content);
    helperFilesWritten.push(edit.path);
  }

  // 2. Try structured parsing (SEARCH/REPLACE, unified diff, code block)
  const oldCode = fs.getSolutionCode();
  const result = applyCodeFromResponse(remaining || responseText, oldCode, language, mode);

  const base: ApplyAIResponseResult = {
    codeChanged: false,
    failedCount: result.failedCount,
    helperFilesWritten,
    oldCode,
    newCode: oldCode,
    message: '',
    applyModelVerifyFailed: false,
  };

  if (result.applied) {
    fs.setSolutionCode(result.newCode);
    return { ...base, codeChanged: true, newCode: result.newCode, message: result.message };
  }

  // 3. Fall back to apply model when structured parsing can't handle the format
  if (result.needsApplyModel && attemptId) {
    const applyResult = await callApplyModel({
      attemptId,
      currentCode: oldCode,
      aiResponse: remaining || responseText,
      language,
      challengeId,
      challengeTitle,
    });

    if (applyResult.cost) {
      base.applyModelCost = applyResult.cost;
      base.applyModelInputTokens = applyResult.inputTokens;
      base.applyModelOutputTokens = applyResult.outputTokens;
    }

    if (applyResult.verified === false) {
      return { ...base, applyModelVerifyFailed: true, codeChanged: helperFilesWritten.length > 0 };
    }

    if (applyResult.success && applyResult.mergedCode) {
      if (applyResult.mergedCode.trim() !== oldCode.trim()) {
        fs.setSolutionCode(applyResult.mergedCode);
        return { ...base, codeChanged: true, newCode: applyResult.mergedCode, message: 'Code updated' };
      }
      return { ...base, codeChanged: helperFilesWritten.length > 0 };
    }

    return { ...base, codeChanged: helperFilesWritten.length > 0 };
  }

  return { ...base, codeChanged: helperFilesWritten.length > 0 };
}
