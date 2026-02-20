/**
 * Diff parser and applier for AI code edits.
 * Supports two formats:
 * 1. SEARCH/REPLACE blocks (preferred, instructed in system prompt)
 * 2. Unified diff (--- a/ / +++ b/ / @@) — fallback for models that naturally output it
 *
 * The parser is deliberately lenient with marker format because models
 * (especially small ones) produce wildly inconsistent variations:
 *   - <<<<SEARCH, <<<<<<< SEARCH, << SEARCH, <<<< search
 *   - With or without ======= separator
 *   - >>>>REPLACE, >>>>>>> REPLACE, >> REPLACE
 * A state machine parser handles all these variants robustly.
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

// ---------------------------------------------------------------------------
// Marker detection helpers — intentionally very flexible
// ---------------------------------------------------------------------------

/** Matches lines like: <<<<<<< SEARCH, <<<<SEARCH, << SEARCH, <<search, etc. */
function isSearchMarker(line: string): boolean {
  return /^<{2,}\s*SEARCH\b/i.test(line.trim());
}

/** Matches lines like: >>>>>>> REPLACE, >>>>REPLACE, >> REPLACE, >>replace, etc. */
function isReplaceMarker(line: string): boolean {
  return /^>{2,}\s*REPLACE\b/i.test(line.trim());
}

/** Matches separator lines: =======, ===, --------, etc. */
function isSeparator(line: string): boolean {
  const t = line.trim();
  return /^={3,}\s*$/.test(t) || /^-{5,}\s*$/.test(t);
}

/**
 * Heuristic: does this line look like prose (not code)?
 * Used to detect end-of-replacement for the no-separator format,
 * where there's no closing marker after the replacement content.
 */
function isLikelyProse(line: string): boolean {
  const t = line.trim();
  if (t === '') return false;
  // Numbered steps/lists: "1. ..." or "Step 1:"
  if (/^\d+[\.\):]/.test(t)) return true;
  if (/^Step\s+\d/i.test(t)) return true;
  // Markdown headers
  if (/^#{1,6}\s/.test(t)) return true;
  // Bullet lists starting with prose
  if (/^[-*]\s+[A-Z]/.test(t)) return true;
  // Markdown bold/emphasis openers: **Fix**, *Note*
  if (/^\*{1,2}[A-Z]/.test(t)) return true;
  // Sentence-like: starts with capital + lowercase, no code punctuation.
  // Exclude code patterns like Object.keys(), Array.from(), Class.method().
  // Require 3+ words to distinguish prose from identifiers.
  // Allow sentence-ending periods but reject dots followed by word chars (method calls).
  if (/^[A-Z][a-z]/.test(t) && !/[{};()=<>\[\]:]/.test(t) && !/\.\w/.test(t) && (t.split(/\s+/).length >= 3)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// SEARCH/REPLACE block parser — state machine
// ---------------------------------------------------------------------------

/**
 * Parse SEARCH/REPLACE blocks from AI response text.
 *
 * Handles two formats that models commonly produce:
 *
 * Format A (standard, with separator):
 *   <<<<<<< SEARCH
 *   old code
 *   =======
 *   new code
 *   >>>>>>> REPLACE
 *
 * Format B (no separator — REPLACE marker acts as divider):
 *   <<<<SEARCH
 *   old code
 *   >>>>>>> REPLACE
 *   new code
 *   (ends at next SEARCH marker, blank-line + prose, or end of text)
 *
 * Marker detection is case-insensitive and accepts any number of </>
 * (minimum 2), with or without a space before the keyword.
 */
export function parseEditBlocks(text: string): EditBlock[] {
  const lines = text.split('\n');
  const blocks: EditBlock[] = [];

  type State = 'outside' | 'in_search' | 'in_replace';
  let state: State = 'outside';
  let searchLines: string[] = [];
  let replaceLines: string[] = [];
  let hasSep = false; // true = standard format (has ======= separator)

  function emitBlock() {
    // Trim trailing blank lines from both sides
    while (searchLines.length > 0 && searchLines[searchLines.length - 1] === '') searchLines.pop();
    while (replaceLines.length > 0 && replaceLines[replaceLines.length - 1] === '') replaceLines.pop();

    if (searchLines.length > 0 || replaceLines.length > 0) {
      blocks.push(cleanDiffContamination({
        search: searchLines.join('\n'),
        replace: replaceLines.join('\n'),
      }));
    }
    searchLines = [];
    replaceLines = [];
    hasSep = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- SEARCH marker: starts a new block ---
    if (isSearchMarker(line)) {
      // If we were mid-block, emit what we have
      if (state === 'in_replace') emitBlock();
      state = 'in_search';
      searchLines = [];
      replaceLines = [];
      hasSep = false;
      continue;
    }

    // --- Separator (=======) while collecting search content ---
    if (state === 'in_search' && isSeparator(line)) {
      state = 'in_replace';
      hasSep = true;
      continue;
    }

    // --- REPLACE marker ---
    if (isReplaceMarker(line)) {
      if (state === 'in_search') {
        // No separator found: Format B (REPLACE marker acts as divider)
        state = 'in_replace';
        hasSep = false;
        continue;
      }
      if (state === 'in_replace') {
        // Standard format: closing REPLACE marker, or duplicate in no-sep
        emitBlock();
        state = 'outside';
        continue;
      }
      // Stray REPLACE marker outside any block — ignore
      continue;
    }

    // --- Accumulate content ---
    if (state === 'in_search') {
      searchLines.push(line);
    } else if (state === 'in_replace') {
      // For no-separator format, detect end-of-replacement heuristically:
      // a blank line followed by a line that looks like prose → end block
      if (
        !hasSep &&
        line.trim() === '' &&
        i + 1 < lines.length &&
        isLikelyProse(lines[i + 1])
      ) {
        emitBlock();
        state = 'outside';
        continue;
      }
      replaceLines.push(line);
    }
  }

  // Emit final block if we ended mid-block
  if (state === 'in_replace') {
    emitBlock();
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

// ---------------------------------------------------------------------------
// Fuzzy matching utilities
// ---------------------------------------------------------------------------

/**
 * Level 1: Normalize whitespace — tabs to spaces, trim trailing per line.
 */
function normalizeWhitespace(code: string): string {
  return code
    .split('\n')
    .map((line) => line.replace(/\s+$/, '').replace(/\t/g, '  '))
    .join('\n');
}

/**
 * Level 3: Line-level similarity matching.
 * For each possible window of code lines, compute what fraction of search
 * lines match (after stripping whitespace). Returns the start line index of
 * the best match, or -1 if no match meets the threshold.
 */
function findSimilarLines(
  codeLines: string[],
  searchLines: string[],
  threshold = 0.6
): number {
  if (searchLines.length === 0) return -1;
  const stripped = searchLines.map(l => l.replace(/\s+/g, ''));

  let bestStart = -1;
  let bestScore = 0;

  for (let i = 0; i <= codeLines.length - searchLines.length; i++) {
    let matches = 0;
    for (let j = 0; j < searchLines.length; j++) {
      const codeLine = codeLines[i + j].replace(/\s+/g, '');
      if (codeLine === stripped[j]) matches++;
    }
    const score = matches / searchLines.length;
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestStart = i;
    }
  }

  return bestStart;
}

// ---------------------------------------------------------------------------
// Block application
// ---------------------------------------------------------------------------

/**
 * Apply edit blocks to the current code. Tries four matching strategies
 * in order of strictness:
 *   1. Exact substring match
 *   2. Whitespace-normalized match (tabs→spaces, trim trailing)
 *   3. Space-stripped match (all whitespace removed per line)
 *   4. Line-level similarity match (60%+ lines must match after stripping)
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

    // --- Strategy 1: Exact match ---
    const idx = code.indexOf(block.search);
    if (idx !== -1) {
      code = code.slice(0, idx) + block.replace + code.slice(idx + block.search.length);
      applied++;
      continue;
    }

    // --- Strategy 2: Whitespace-normalized match ---
    const normalizedCode = normalizeWhitespace(code);
    const normalizedSearch = normalizeWhitespace(block.search);
    let matched = false;

    {
      const cLines = normalizedCode.split('\n');
      const sLines = normalizedSearch.split('\n');
      const startLine = findExactLineMatch(cLines, sLines);
      if (startLine !== -1) {
        code = spliceLines(code, startLine, sLines.length, block.replace);
        applied++;
        matched = true;
      }
    }
    if (matched) continue;

    // --- Strategy 3: Space-stripped match ---
    {
      const cLines = code.split('\n');
      const sLines = block.search.split('\n');
      const strippedCode = cLines.map(l => l.replace(/\s+/g, ''));
      const strippedSearch = sLines.map(l => l.replace(/\s+/g, ''));
      const startLine = findExactLineMatch(strippedCode, strippedSearch);
      if (startLine !== -1) {
        code = spliceLines(code, startLine, sLines.length, block.replace);
        applied++;
        matched = true;
      }
    }
    if (matched) continue;

    // --- Strategy 4: Line-level similarity match (60% threshold) ---
    {
      const cLines = code.split('\n');
      const sLines = block.search.split('\n');
      const startLine = findSimilarLines(cLines, sLines);
      if (startLine !== -1) {
        code = spliceLines(code, startLine, sLines.length, block.replace);
        applied++;
        matched = true;
      }
    }
    if (matched) continue;

    // All strategies failed
    failed++;
    failedBlocks.push(block);
  }

  return { newCode: code, applied, failed, failedBlocks };
}

/** Find the first position where searchLines exactly match a window of codeLines. */
function findExactLineMatch(codeLines: string[], searchLines: string[]): number {
  for (let i = 0; i <= codeLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (codeLines[i + j] !== searchLines[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/** Replace lines [startLine..startLine+count) with replacement text. */
function spliceLines(code: string, startLine: number, count: number, replacement: string): string {
  const lines = code.split('\n');
  const before = lines.slice(0, startLine).join('\n');
  const after = lines.slice(startLine + count).join('\n');
  return before + (before ? '\n' : '') + replacement + (after ? '\n' : '') + after;
}

/** Check if a response contains SEARCH/REPLACE blocks (flexible detection). */
export function hasEditBlocks(text: string): boolean {
  return /<{2,}\s*SEARCH\b/i.test(text);
}
