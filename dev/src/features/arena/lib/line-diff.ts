/**
 * Simple line-level diff computation for visual decorations.
 * Returns 1-indexed line numbers of added and changed lines.
 */

export interface LineDiffResult {
  /** Lines that were added (not present in old code). 1-indexed. */
  added: number[];
  /** Lines that were modified (present in both but different). 1-indexed. */
  changed: number[];
}

/**
 * Compute line-level diff between old and new code.
 * Uses a simple LCS-inspired approach: aligns lines by matching,
 * marks unmatched new lines as added, and matched-but-different as changed.
 *
 * For visual hints this is fast and sufficient — no need for full Myers diff.
 */
export function computeLineDiff(oldCode: string, newCode: string): LineDiffResult {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const added: number[] = [];
  const changed: number[] = [];

  // Build a set of old lines for quick lookups
  const oldLineSet = new Set(oldLines);

  // Simple comparison: walk new lines against old lines
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < newLines.length; i++) {
    const lineNum = i + 1; // 1-indexed

    if (i >= oldLines.length) {
      // Line beyond old code length — it's added
      added.push(lineNum);
    } else if (newLines[i] !== oldLines[i]) {
      // Line exists in both but is different
      if (!oldLineSet.has(newLines[i])) {
        // Truly new content
        added.push(lineNum);
      } else {
        // Line existed somewhere in old code but moved — mark as changed
        changed.push(lineNum);
      }
    }
    // else: identical line, no decoration
  }

  // Don't mark lines if it looks like a full rewrite (>80% changed)
  if (maxLen > 5 && (added.length + changed.length) / maxLen > 0.8) {
    return { added: [], changed: [] };
  }

  return { added, changed };
}
