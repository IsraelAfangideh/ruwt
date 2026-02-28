import { describe, it, expect } from 'vitest';
import {
  parseEditBlocks,
  applyEditBlocks,
  hasEditBlocks,
  parseUnifiedDiff,
  hasUnifiedDiff,
  hasBareConflictMarkers,
  parseBareConflictBlocks,
} from './diff-apply';

describe('parseEditBlocks', () => {
  it('parses standard format with separator', () => {
    const text = `
<<<<<<< SEARCH
function hello() {
  return 'hello';
}
=======
function hello() {
  return 'world';
}
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe("function hello() {\n  return 'hello';\n}");
    expect(blocks[0].replace).toBe("function hello() {\n  return 'world';\n}");
  });

  it('parses format B (no separator, REPLACE as divider)', () => {
    const text = `
<<<<SEARCH
old code
>>>>>>> REPLACE
new code
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe('old code');
    expect(blocks[0].replace).toBe('new code');
  });

  it('handles multiple blocks', () => {
    const text = `
<<<<<<< SEARCH
line1
=======
line1_updated
>>>>>>> REPLACE

<<<<<<< SEARCH
line2
=======
line2_updated
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].search).toBe('line1');
    expect(blocks[0].replace).toBe('line1_updated');
    expect(blocks[1].search).toBe('line2');
    expect(blocks[1].replace).toBe('line2_updated');
  });

  it('handles case-insensitive markers with varying chevron counts', () => {
    const text = `
<<search
old
=======
new
>>replace
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe('old');
    expect(blocks[0].replace).toBe('new');
  });

  it('cleans diff contamination (+ prefixes in replace)', () => {
    const text = `
<<<<<<< SEARCH
function foo() {
=======
function foo() {
+  // added line
+  newCode();
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].replace).toContain('newCode()');
    // + prefix should be stripped
    expect(blocks[0].replace).not.toContain('+  newCode()');
  });

  it('returns empty array for text with no blocks', () => {
    const text = 'Just some regular text with no markers';
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(0);
  });
});

describe('applyEditBlocks', () => {
  it('applies exact match replacement', () => {
    const code = "const x = 1;\nconst y = 2;\nconst z = 3;";
    const blocks = [{ search: 'const y = 2;', replace: 'const y = 42;' }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.newCode).toContain('const y = 42;');
    expect(result.newCode).toContain('const x = 1;');
    expect(result.newCode).toContain('const z = 3;');
  });

  it('applies whitespace-normalized match', () => {
    const code = "function foo() {\n\treturn 1;\n}";
    const blocks = [{ search: 'function foo() {\n  return 1;\n}', replace: 'function foo() {\n  return 2;\n}' }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.newCode).toContain('return 2');
  });

  it('handles empty search (full replacement)', () => {
    const code = '';
    const blocks = [{ search: '', replace: 'new content' }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.newCode).toBe('new content');
  });

  it('reports failed blocks that do not match', () => {
    const code = 'const a = 1;';
    const blocks = [{ search: 'const b = 2;', replace: 'const b = 3;' }];
    const result = applyEditBlocks(code, blocks);
    expect(result.failed).toBe(1);
    expect(result.failedBlocks).toHaveLength(1);
    expect(result.newCode).toBe('const a = 1;');
  });

  it('applies fuzzy line-level similarity match', () => {
    const code = "function greet(name) {\n  console.log('Hello ' + name);\n  return true;\n}";
    // Slightly different whitespace and a changed line
    const blocks = [{
      search: "function greet(name) {\n  console.log('Hello ' + name);\n  return true;\n}",
      replace: "function greet(name) {\n  console.log('Hi ' + name);\n  return true;\n}",
    }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.newCode).toContain("'Hi '");
  });
});

describe('hasEditBlocks', () => {
  it('detects SEARCH markers', () => {
    expect(hasEditBlocks('<<<<<<< SEARCH')).toBe(true);
    expect(hasEditBlocks('<< SEARCH')).toBe(true);
    expect(hasEditBlocks('<<<<search')).toBe(true);
  });

  it('returns false for non-matching text', () => {
    expect(hasEditBlocks('no markers here')).toBe(false);
    expect(hasEditBlocks('< SEARCH')).toBe(false); // only 1 chevron
  });
});

describe('parseUnifiedDiff', () => {
  it('parses unified diff hunks', () => {
    const text = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 42;
 const c = 3;`;
    const blocks = parseUnifiedDiff(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toContain('const b = 2;');
    expect(blocks[0].replace).toContain('const b = 42;');
  });
});

describe('hasUnifiedDiff', () => {
  it('detects unified diff markers', () => {
    expect(hasUnifiedDiff('--- a/file.js\n+++ b/file.js\n@@ -1 +1 @@')).toBe(true);
  });

  it('returns false for non-diff text', () => {
    expect(hasUnifiedDiff('just some text')).toBe(false);
  });
});

describe('isLikelyProse (via parseEditBlocks format-B behavior)', () => {
  it('does NOT misclassify code starting with capitals as prose', () => {
    // This is a regression test: Object.keys() was previously detected as prose
    const text = `
<<<<SEARCH
old code
>>>>>>> REPLACE
Object.keys(data).forEach(k => {
  console.log(k);
});
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    // The replacement should include the Object.keys code, not be cut short
    expect(blocks[0].replace).toContain('Object.keys');
  });

  it('does NOT misclassify Class.method() as prose', () => {
    const text = `
<<<<SEARCH
old
>>>>>>> REPLACE
Array.from(items).map(x => x.id)

This is actual prose that should end the block.
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].replace).toContain('Array.from');
  });

  it('correctly detects actual prose to end replacement', () => {
    const text = `
<<<<SEARCH
old
>>>>>>> REPLACE
new code here

This change fixes the bug by updating the logic.
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].replace).toBe('new code here');
  });
});

// ---------------------------------------------------------------------------
// Strategy 3: Space-stripped matching
// ---------------------------------------------------------------------------

describe('applyEditBlocks — space-stripped matching (strategy 3)', () => {
  it('matches when all whitespace differs but characters are the same', () => {
    // Code has different spacing that won't match exact or whitespace-normalized
    const code = "function   foo()  {\n    return   1;\n}";
    const blocks = [{
      search: "function foo() {\n  return 1;\n}",
      replace: "function foo() {\n  return 2;\n}",
    }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.newCode).toContain('return 2');
  });
});

// ---------------------------------------------------------------------------
// Strategy 4: Line-level similarity matching
// ---------------------------------------------------------------------------

describe('applyEditBlocks — similarity matching (strategy 4)', () => {
  it('matches code with ~90% line similarity after stripping', () => {
    // 10 lines, 9 match exactly, 1 differs = 90% similarity (above 85% threshold)
    const code = [
      'function greet(name) {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '  const d = 4;',
      '  const e = 5;',
      '  const f = 6;',
      '  const g = 7;',
      '  const msg = "hello";',  // code has "hello"
      '}',
    ].join('\n');
    const blocks = [{
      search: [
        'function greet(name) {',
        '  const a = 1;',
        '  const b = 2;',
        '  const c = 3;',
        '  const d = 4;',
        '  const e = 5;',
        '  const f = 6;',
        '  const g = 7;',
        '  const msg = "hi";',   // search has "hi" — only this line differs
        '}',
      ].join('\n'),
      replace: [
        'function greet(name) {',
        '  const a = 1;',
        '  const b = 2;',
        '  const c = 3;',
        '  const d = 4;',
        '  const e = 5;',
        '  const f = 6;',
        '  const g = 7;',
        '  const msg = "hi";',
        '}',
      ].join('\n'),
    }];
    const result = applyEditBlocks(code, blocks);
    expect(result.applied).toBe(1);
    expect(result.newCode).toContain('"hi"');
  });

  it('fails when similarity is below 85% threshold', () => {
    const code = "line1\nline2\nline3\nline4\nline5";
    const blocks = [{
      search: "totally\ndifferent\ncode\nhere\nnow",
      replace: "replacement",
    }];
    const result = applyEditBlocks(code, blocks);
    expect(result.failed).toBe(1);
    expect(result.applied).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Empty search with non-empty code and multiple blocks
// ---------------------------------------------------------------------------

describe('applyEditBlocks — empty search edge cases', () => {
  it('does not apply empty search as full replacement when there are multiple blocks', () => {
    const code = "existing code";
    const blocks = [
      { search: '', replace: 'new code' },
      { search: 'existing code', replace: 'updated code' },
    ];
    const result = applyEditBlocks(code, blocks);
    // First block: empty search with non-empty code and multiple blocks -> skip
    // Second block: exact match -> applies
    expect(result.newCode).toContain('updated code');
  });
});

// ---------------------------------------------------------------------------
// hasBareConflictMarkers
// ---------------------------------------------------------------------------

describe('hasBareConflictMarkers', () => {
  it('detects bare conflict markers without SEARCH/REPLACE labels', () => {
    const text = '<<<<<<\noriginal code\n>>>>>>\n<<<<<<\nnew code\n>>>>>>';
    expect(hasBareConflictMarkers(text)).toBe(true);
  });

  it('returns false when SEARCH labels are present (not bare)', () => {
    const text = '<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE';
    expect(hasBareConflictMarkers(text)).toBe(false);
  });

  it('returns false when text has no conflict markers', () => {
    expect(hasBareConflictMarkers('just regular text')).toBe(false);
  });

  it('returns false when only opening markers exist', () => {
    const text = '<<<<<<<\nsome code';
    expect(hasBareConflictMarkers(text)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseBareConflictBlocks
// ---------------------------------------------------------------------------

describe('parseBareConflictBlocks', () => {
  it('pairs consecutive bare conflict blocks as SEARCH/REPLACE', () => {
    const text = `Some intro text
<<<<
function old() {
  return 1;
}
>>>>
<<<<
function old() {
  return 2;
}
>>>>
`;
    const blocks = parseBareConflictBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toContain('return 1');
    expect(blocks[0].replace).toContain('return 2');
  });

  it('handles multiple pairs of bare conflict blocks', () => {
    const text = `
<<<
old1
>>>
<<<
new1
>>>
<<<
old2
>>>
<<<
new2
>>>
`;
    const blocks = parseBareConflictBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].search).toBe('old1');
    expect(blocks[0].replace).toBe('new1');
    expect(blocks[1].search).toBe('old2');
    expect(blocks[1].replace).toBe('new2');
  });

  it('trims trailing blank lines from block content', () => {
    const text = `
<<<
code line


>>>
<<<
new code
>>>
`;
    const blocks = parseBareConflictBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe('code line');
  });

  it('returns empty array when no conflict markers are present', () => {
    expect(parseBareConflictBlocks('no markers')).toEqual([]);
  });

  it('ignores unpaired (odd) blocks', () => {
    const text = `
<<<
only one block
>>>
`;
    const blocks = parseBareConflictBlocks(text);
    expect(blocks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// cleanDiffContamination via parseEditBlocks
// ---------------------------------------------------------------------------

describe('cleanDiffContamination (via parseEditBlocks)', () => {
  it('strips - prefix lines from SEARCH when heavily contaminated', () => {
    const text = `
<<<<<<< SEARCH
-function old() {
-  return 1;
-}
=======
+function old() {
+  return 2;
+}
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    // The - prefixes should be stripped from search
    expect(blocks[0].search).toContain('function old()');
    expect(blocks[0].search).not.toContain('-function');
    // The + prefixes should be stripped from replace
    expect(blocks[0].replace).toContain('function old()');
    expect(blocks[0].replace).not.toContain('+function');
  });

  it('does not clean when contamination is below 40% threshold', () => {
    const text = `
<<<<<<< SEARCH
function foo() {
  return 1;
}
regular line
another line
=======
function foo() {
  return 2;
}
+one added line
regular line
another line
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    // Only 1 out of 5 lines has + prefix = 20%, below 40% threshold
    // So the + should NOT be stripped
    expect(blocks[0].replace).toContain('+one added line');
  });
});

// ---------------------------------------------------------------------------
// parseUnifiedDiff — additional edge cases
// ---------------------------------------------------------------------------

describe('parseUnifiedDiff — edge cases', () => {
  it('handles multiple hunks in a single diff', () => {
    const text = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 42;
 const c = 3;
@@ -10,3 +10,3 @@
 function foo() {
-  return 1;
+  return 2;
 }`;
    const blocks = parseUnifiedDiff(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].search).toContain('const b = 2;');
    expect(blocks[1].search).toContain('return 1;');
  });

  it('handles pure additions (no context or removal lines)', () => {
    const text = `--- a/file.js
+++ b/file.js
@@ -0,0 +1,2 @@
+const newVar = 1;
+console.log(newVar);`;
    const blocks = parseUnifiedDiff(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe('');
    expect(blocks[0].replace).toContain('newVar');
  });

  it('handles empty lines (no prefix) as context in a hunk body', () => {
    // An empty line in a unified diff hunk (no space, +, or - prefix) is treated
    // as a context line that appears in both search and replace
    const text = `--- a/file.js
+++ b/file.js
@@ -1,5 +1,5 @@
 function foo() {
-  return 1;
+  return 2;

 }`;
    const blocks = parseUnifiedDiff(text);
    expect(blocks).toHaveLength(1);
    // The empty line should appear in both search and replace
    expect(blocks[0].search).toContain('function foo()');
    expect(blocks[0].search).toContain('return 1;');
    expect(blocks[0].replace).toContain('function foo()');
    expect(blocks[0].replace).toContain('return 2;');
    // The closing brace after the empty line should also be present
    expect(blocks[0].search).toContain('}');
    expect(blocks[0].replace).toContain('}');
  });
});

// ---------------------------------------------------------------------------
// Stray REPLACE marker outside any block (line 162)
// ---------------------------------------------------------------------------

describe('parseEditBlocks — stray REPLACE marker', () => {
  it('ignores stray REPLACE markers that appear outside any SEARCH block', () => {
    const text = `Some intro text
>>>>>>> REPLACE
This is just random text.

<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
`;
    const blocks = parseEditBlocks(text);
    // Only the valid SEARCH/REPLACE block should be parsed
    expect(blocks).toHaveLength(1);
    expect(blocks[0].search).toBe('old code');
    expect(blocks[0].replace).toBe('new code');
  });
});

// ---------------------------------------------------------------------------
// isLikelyProse returning false for non-prose, non-empty lines (line 71)
// ---------------------------------------------------------------------------

describe('isLikelyProse — false return for non-matching content (via parseEditBlocks)', () => {
  it('does not end replacement at blank line followed by lowercase text', () => {
    // A blank line followed by a line starting with lowercase is NOT prose
    // (isLikelyProse requires capital letter start with 3+ words and no code punctuation)
    // So the replacement should continue past the blank line
    const text = `
<<<<SEARCH
old
>>>>>>> REPLACE
first line of replacement

lowercase continuation here
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    // The blank line + lowercase line should be included in the replacement
    expect(blocks[0].replace).toContain('lowercase continuation here');
  });

  it('does not end replacement at blank line followed by a single short word', () => {
    const text = `
<<<<SEARCH
old
>>>>>>> REPLACE
code here

x
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    // "x" is a single word (not 3+ words), so isLikelyProse returns false
    expect(blocks[0].replace).toContain('x');
  });

  it('does not end replacement at blank line followed by code-like capital line', () => {
    // "Config.set(value)" has code punctuation — not prose
    const text = `
<<<<SEARCH
old
>>>>>>> REPLACE
new code

Config.set(value)
`;
    const blocks = parseEditBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].replace).toContain('Config.set(value)');
  });
});
