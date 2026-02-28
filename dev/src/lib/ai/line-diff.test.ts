import { describe, it, expect } from 'vitest';
import { computeLineDiff } from './line-diff';

describe('computeLineDiff', () => {
  // -----------------------------------------------------------------------
  // Identical and empty inputs
  // -----------------------------------------------------------------------

  it('returns empty arrays for identical code', () => {
    const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const result = computeLineDiff(code, code);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it('returns empty arrays when both inputs are empty strings', () => {
    const result = computeLineDiff('', '');
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Added lines (new content not present anywhere in old code)
  // -----------------------------------------------------------------------

  it('detects lines added at the end', () => {
    const oldCode = 'line1\nline2';
    const newCode = 'line1\nline2\nline3\nline4';
    const result = computeLineDiff(oldCode, newCode);
    // Lines 3 and 4 are beyond old code length — added
    expect(result.added).toContain(3);
    expect(result.added).toContain(4);
    expect(result.changed).toEqual([]);
  });

  it('detects a completely new line inserted in the middle', () => {
    const oldCode = 'aaa\nccc';
    const newCode = 'aaa\nbbb\nccc';
    // Line 2: "bbb" is different from old line 2 "ccc", and "bbb" is not in oldLineSet → added
    // Line 3: "ccc" is beyond old length (2 lines) → added
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toContain(2);
    expect(result.added).toContain(3);
  });

  it('marks a changed line as added when new content is truly new', () => {
    const oldCode = 'const x = 1;\nconst y = 2;';
    const newCode = 'const x = 1;\nconst y = 99;';
    // Line 2 differs, and "const y = 99;" is not in the old set → added
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toContain(2);
    expect(result.changed).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Changed lines (line existed somewhere in old code but moved)
  // -----------------------------------------------------------------------

  it('marks reordered lines as changed', () => {
    const oldCode = 'alpha\nbeta\ngamma';
    const newCode = 'beta\nalpha\ngamma';
    // Line 1: "beta" differs from "alpha" at position 0, but "beta" IS in oldLineSet → changed
    // Line 2: "alpha" differs from "beta" at position 1, but "alpha" IS in oldLineSet → changed
    // Line 3: identical → no decoration
    const result = computeLineDiff(oldCode, newCode);
    expect(result.changed).toContain(1);
    expect(result.changed).toContain(2);
    expect(result.added).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Mixed: some added, some changed
  // -----------------------------------------------------------------------

  it('distinguishes added from changed lines in a mixed edit', () => {
    const oldCode = 'a\nb\nc';
    const newCode = 'a\nnew_content\nb';
    // Line 1: "a" === "a" → identical
    // Line 2: "new_content" !== "b", "new_content" not in oldLineSet → added
    // Line 3: "b" !== "c", but "b" IS in oldLineSet → changed
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toContain(2);
    expect(result.changed).toContain(3);
  });

  // -----------------------------------------------------------------------
  // 80% rewrite suppression
  // -----------------------------------------------------------------------

  it('suppresses diff decorations when more than 80% of lines changed (full rewrite)', () => {
    // 10 lines, all different → (added + changed) / maxLen > 0.8
    const oldCode = Array.from({ length: 10 }, (_, i) => `old_line_${i}`).join('\n');
    const newCode = Array.from({ length: 10 }, (_, i) => `new_line_${i}`).join('\n');
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it('does NOT suppress when changed ratio is at or below 80%', () => {
    // 10 lines, first 7 identical, last 3 changed → 3/10 = 30%
    const oldLines = Array.from({ length: 10 }, (_, i) => `line_${i}`);
    const newLines = [...oldLines];
    newLines[7] = 'changed_7';
    newLines[8] = 'changed_8';
    newLines[9] = 'changed_9';
    const result = computeLineDiff(oldLines.join('\n'), newLines.join('\n'));
    expect(result.added.length + result.changed.length).toBe(3);
  });

  it('does NOT suppress for short code (maxLen <= 5) even if 100% changed', () => {
    // 5 lines exactly, all different → maxLen = 5 which is NOT > 5, so no suppression
    const oldCode = 'a\nb\nc\nd\ne';
    const newCode = 'v\nw\nx\ny\nz';
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added.length + result.changed.length).toBe(5);
  });

  it('suppresses when new code is significantly longer than old and mostly new', () => {
    // Old has 2 lines, new has 10 lines, all different → maxLen = 10 > 5
    // All 10 new lines are different: 2 differ from old positions, 8 beyond old length
    // (added + changed) / maxLen = 10/10 = 100% > 80% → suppressed
    const oldCode = 'old_a\nold_b';
    const newCode = Array.from({ length: 10 }, (_, i) => `brand_new_${i}`).join('\n');
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Edge: new code shorter than old code
  // -----------------------------------------------------------------------

  it('handles new code being shorter than old code', () => {
    const oldCode = 'a\nb\nc\nd\ne';
    const newCode = 'a\nX';
    // Line 1: identical
    // Line 2: "X" !== "b" and "X" not in oldLineSet → added
    // Only 2 new lines, maxLen = 5, (1 / 5) = 0.2 < 0.8 → not suppressed
    const result = computeLineDiff(oldCode, newCode);
    expect(result.added).toEqual([2]);
    expect(result.changed).toEqual([]);
  });
});
