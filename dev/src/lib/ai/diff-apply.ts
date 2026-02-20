/**
 * Diff parser and applier for AI code edits.
 * Supports two formats:
 * 1. SEARCH/REPLACE blocks (preferred, instructed in system prompt)
 * 2. Unified diff (--- a/ / +++ b/ / @@) — fallback for models that naturally output it
 */

export interface EditBlock {
  search: string;
  replace: string;
}

export interface ApplyResult {
  newCode: string;
  applied: number;
  failed: number;
  failedBlocks: EditBlock[];
}

/**
 * Parse SEARCH/REPLACE blocks from AI response text.
 *
 * Format:
 * <<<<<<< SEARCH
 * // exact code to find
 * =======
 * // replacement code
 * >>>>>>> REPLACE
 */
export function parseEditBlocks(text: string): EditBlock[] {
  const blocks: EditBlock[] = [];
  // \n? before ======= handles empty SEARCH (no extra newline between SEARCH and =======)
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n?=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push(cleanDiffContamination({
      search: match[1],
      replace: match[2],
    }));
  }

  return blocks;
}

/**
 * Strip unified-diff-style +/- prefixes from SEARCH/REPLACE block content.
 * Models sometimes mix formats, e.g. using +/- prefixes inside SEARCH/REPLACE:
 *   <<<<<<< SEARCH
 *   function foo() {
 *   =======
 *   function foo() {
 *   +  // added line
 *   +  newCode();
 *   >>>>>>> REPLACE
 */
function cleanDiffContamination(block: EditBlock): EditBlock {
  let { search, replace } = block;
  let cleaned = false;

  // Check REPLACE for + prefixes (model outputting additions as diff lines)
  const replaceLines = replace.split('\n');
  const plusCount = replaceLines.filter(l => l.startsWith('+') && !l.startsWith('++')).length;
  const replaceNonEmpty = replaceLines.filter(l => l.trim() !== '').length;

  if (plusCount >= 2 && replaceNonEmpty > 0 && plusCount / replaceNonEmpty >= 0.4) {
    replace = replaceLines
      .filter(l => !(l.startsWith('-') && !l.startsWith('--'))) // drop removal lines
      .map(l => (l.startsWith('+') && !l.startsWith('++')) ? l.slice(1) : l)
      .join('\n');
    cleaned = true;
  }

  // Check SEARCH for - prefixes (model outputting removals as diff lines)
  const searchLines = search.split('\n');
  const minusCount = searchLines.filter(l => l.startsWith('-') && !l.startsWith('--')).length;
  const searchNonEmpty = searchLines.filter(l => l.trim() !== '').length;

  if (minusCount >= 2 && searchNonEmpty > 0 && minusCount / searchNonEmpty >= 0.4) {
    search = searchLines
      .filter(l => !(l.startsWith('+') && !l.startsWith('++'))) // drop addition lines
      .map(l => (l.startsWith('-') && !l.startsWith('--')) ? l.slice(1) : l)
      .join('\n');
    cleaned = true;
  }

  return cleaned ? { search, replace } : block;
}

/**
 * Parse unified diff hunks from AI response text.
 * Handles format like:
 * ```diff
 * --- a/solution.js
 * +++ b/solution.js
 * @@ -1,5 +1,8 @@
 *  context line
 * -removed line
 * +added line
 * ```
 */
export function parseUnifiedDiff(text: string): EditBlock[] {
  const blocks: EditBlock[] = [];

  // Match unified diff hunks — look for @@ markers
  // The diff may be inside a code block or bare in the response
  const hunkRegex = /@@\s*-(\d+)(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@[^\n]*\n([\s\S]*?)(?=\n@@|\n```|$)/g;
  let match: RegExpExecArray | null;

  while ((match = hunkRegex.exec(text)) !== null) {
    const hunkBody = match[2];
    const lines = hunkBody.split('\n');

    const searchLines: string[] = [];
    const replaceLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('-')) {
        searchLines.push(line.slice(1));
      } else if (line.startsWith('+')) {
        replaceLines.push(line.slice(1));
      } else if (line.startsWith(' ')) {
        searchLines.push(line.slice(1));
        replaceLines.push(line.slice(1));
      } else if (line === '') {
        // Empty line in diff = context line with no prefix
        searchLines.push('');
        replaceLines.push('');
      }
      // Skip lines starting with \ (no newline at end of file markers)
    }

    // Trim trailing empty lines from both
    while (searchLines.length > 0 && searchLines[searchLines.length - 1] === '') searchLines.pop();
    while (replaceLines.length > 0 && replaceLines[replaceLines.length - 1] === '') replaceLines.pop();

    if (searchLines.length > 0 || replaceLines.length > 0) {
      blocks.push({
        search: searchLines.join('\n'),
        replace: replaceLines.join('\n'),
      });
    }
  }

  return blocks;
}

/** Check if text contains unified diff markers. */
export function hasUnifiedDiff(text: string): boolean {
  return /^[-+]{3}\s+[ab]\//m.test(text) && /^@@\s*-\d/m.test(text);
}

/**
 * Normalize whitespace for fuzzy matching: collapse runs of whitespace
 * to single spaces within each line, and trim trailing whitespace per line.
 */
function normalizeWhitespace(code: string): string {
  return code
    .split('\n')
    .map((line) => line.replace(/\s+$/, '').replace(/\t/g, '  '))
    .join('\n');
}

/**
 * Apply edit blocks to the current code. Tries exact match first,
 * then falls back to whitespace-normalized fuzzy matching.
 */
export function applyEditBlocks(currentCode: string, blocks: EditBlock[]): ApplyResult {
  let code = currentCode;
  let applied = 0;
  let failed = 0;
  const failedBlocks: EditBlock[] = [];

  for (const block of blocks) {
    // Empty search = prepend/full replace (for new files or complete rewrites)
    if (block.search.trim() === '') {
      if (currentCode.trim() === '' || blocks.length === 1) {
        code = block.replace;
        applied++;
        continue;
      }
    }

    // Try exact match first
    const idx = code.indexOf(block.search);
    if (idx !== -1) {
      code = code.slice(0, idx) + block.replace + code.slice(idx + block.search.length);
      applied++;
      continue;
    }

    // Fuzzy match: normalize whitespace
    const normalizedCode = normalizeWhitespace(code);
    const normalizedSearch = normalizeWhitespace(block.search);
    const fuzzyIdx = normalizedCode.indexOf(normalizedSearch);

    if (fuzzyIdx !== -1) {
      // Map fuzzy index back to original code position
      // Find the original substring that corresponds to the normalized match
      const lines = code.split('\n');
      const normalizedLines = normalizedCode.split('\n');
      const searchLines = normalizedSearch.split('\n');

      let startLine = -1;
      for (let i = 0; i <= normalizedLines.length - searchLines.length; i++) {
        let match = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (normalizedLines[i + j] !== searchLines[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          startLine = i;
          break;
        }
      }

      if (startLine !== -1) {
        const before = lines.slice(0, startLine).join('\n');
        const after = lines.slice(startLine + searchLines.length).join('\n');
        code = before + (before ? '\n' : '') + block.replace + (after ? '\n' : '') + after;
        applied++;
        continue;
      }
    }

    // Both exact and fuzzy failed
    failed++;
    failedBlocks.push(block);
  }

  return { newCode: code, applied, failed, failedBlocks };
}

/** Check if a response contains SEARCH/REPLACE blocks. */
export function hasEditBlocks(text: string): boolean {
  return /<<<<<<< SEARCH/.test(text);
}
