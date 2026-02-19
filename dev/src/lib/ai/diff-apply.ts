/**
 * SEARCH/REPLACE diff parser and applier for AI code edits.
 * Replaces the "output complete file" approach with targeted edits.
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
    blocks.push({
      search: match[1],
      replace: match[2],
    });
  }

  return blocks;
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
