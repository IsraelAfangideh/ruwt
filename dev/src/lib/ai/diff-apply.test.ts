import { describe, it, expect } from 'vitest';
import {
  parseEditBlocks,
  applyEditBlocks,
  hasEditBlocks,
  parseUnifiedDiff,
  hasUnifiedDiff,
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
