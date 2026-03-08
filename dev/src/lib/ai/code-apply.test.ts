import { describe, it, expect } from 'vitest';
import { applyCodeFromResponse, extractFileEdits } from './code-apply';

// ---------------------------------------------------------------------------
// extractFileEdits
// ---------------------------------------------------------------------------

describe('extractFileEdits', () => {
  it('extracts a single FILE: block with language tag', () => {
    const response = `Here is the fix:

FILE: src/utils.ts
\`\`\`typescript
export function add(a: number, b: number) {
  return a + b;
}
\`\`\`

Let me know if that works.`;

    const { fileEdits, remaining } = extractFileEdits(response);
    expect(fileEdits).toHaveLength(1);
    expect(fileEdits[0].path).toBe('src/utils.ts');
    expect(fileEdits[0].content).toBe(
      'export function add(a: number, b: number) {\n  return a + b;\n}'
    );
    expect(remaining).toContain('Here is the fix:');
    expect(remaining).toContain('Let me know if that works.');
    expect(remaining).not.toContain('FILE:');
  });

  it('extracts multiple FILE: blocks', () => {
    const response = `FILE: src/a.ts
\`\`\`ts
const a = 1;
\`\`\`

FILE: src/b.ts
\`\`\`ts
const b = 2;
\`\`\``;

    const { fileEdits, remaining } = extractFileEdits(response);
    expect(fileEdits).toHaveLength(2);
    expect(fileEdits[0].path).toBe('src/a.ts');
    expect(fileEdits[0].content).toBe('const a = 1;');
    expect(fileEdits[1].path).toBe('src/b.ts');
    expect(fileEdits[1].content).toBe('const b = 2;');
    expect(remaining).toBe('');
  });

  it('returns empty fileEdits when no FILE: blocks exist', () => {
    const response = 'Just a plain explanation with no code.';
    const { fileEdits, remaining } = extractFileEdits(response);
    expect(fileEdits).toHaveLength(0);
    expect(remaining).toBe(response);
  });

  it('trims trailing whitespace from extracted content', () => {
    const response = `FILE: index.js
\`\`\`js
console.log("hello");

\`\`\``;

    const { fileEdits } = extractFileEdits(response);
    expect(fileEdits[0].content).toBe('console.log("hello");');
  });
});

// ---------------------------------------------------------------------------
// applyCodeFromResponse — mode = 'ask' bypass
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — ask mode', () => {
  it('returns no-change result when mode is ask', () => {
    const code = 'const x = 1;';
    const response = `<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE`;

    const result = applyCodeFromResponse(response, code, 'typescript', 'ask');
    expect(result.applied).toBe(false);
    expect(result.newCode).toBe(code);
    expect(result.method).toBe('none');
    expect(result.needsApplyModel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tier 1: SEARCH/REPLACE blocks
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — SEARCH/REPLACE', () => {
  it('applies a standard SEARCH/REPLACE block', () => {
    const code = 'function greet() {\n  return "hello";\n}';
    const response = `Here is the fix:

<<<<<<< SEARCH
function greet() {
  return "hello";
}
=======
function greet() {
  return "world";
}
>>>>>>> REPLACE`;

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.newCode).toContain('"world"');
    expect(result.message).toBe('Applied 1 edit');
    expect(result.needsApplyModel).toBe(false);
  });

  it('reports partial failures in message', () => {
    const code = 'const a = 1;\nconst b = 2;';
    const response = `<<<<<<< SEARCH
const a = 1;
=======
const a = 10;
>>>>>>> REPLACE

<<<<<<< SEARCH
const c = 999;
=======
const c = 0;
>>>>>>> REPLACE`;

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.message).toBe('Applied 1 edit (1 deferred to next round)');
  });

  it('falls through when all SEARCH/REPLACE blocks fail to match', () => {
    const code = 'const x = 1;';
    // SEARCH text does not exist in code, and response also has backticks so hasCode is true
    const response = `<<<<<<< SEARCH
nonexistent code
=======
new code
>>>>>>> REPLACE

\`\`\`
some fallback
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    // Should fall through past SEARCH/REPLACE since all blocks failed
    // The fenced block "some fallback" is only 13 chars (< 20), so it skips tier 4
    // Tier 5 detects hasCode (backticks present) and sets needsApplyModel
    expect(result.needsApplyModel).toBe(true);
  });

  it('applies bare conflict markers (Llama-style)', () => {
    const code = 'let val = "old";';
    const response = `<<<<<<<
let val = "old";
>>>>>>>

<<<<<<<
let val = "new";
>>>>>>>`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.newCode).toContain('"new"');
  });

  it('falls through when bare conflict blocks all fail to apply', () => {
    const code = 'let x = 1;';
    // Two bare blocks that pair up, but the search text does not match the code
    const response = `<<<<<<<
nonexistent line
>>>>>>>

<<<<<<<
replacement line
>>>>>>>`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // Bare conflict parsed but search did not match → falls through
    // Tier 5 sees bare markers → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('reports partial failures for bare conflict markers', () => {
    const code = 'let a = 1;\nlet b = 2;';
    // Two pairs: first matches, second does not
    const response = `<<<<<<<
let a = 1;
>>>>>>>

<<<<<<<
let a = 10;
>>>>>>>

<<<<<<<
nonexistent line
>>>>>>>

<<<<<<<
replacement for nonexistent
>>>>>>>`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.message).toBe('Applied 1 edit (1 deferred to next round)');
  });
});

// ---------------------------------------------------------------------------
// Tier 2: Unified diff
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — unified diff', () => {
  it('falls through when hasUnifiedDiff is true but no hunks are parsed', () => {
    const code = 'const x = 1;';
    // Has --- a/ and +++ b/ and @@ markers, but @@ line has no valid hunk body
    const response = `--- a/file.js
+++ b/file.js
@@ -1 +1 @@`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // parseUnifiedDiff returns empty (no hunk body after @@)
    // Falls through to tier 4 (no fenced code), tier 5 sees @@ → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('falls through when unified diff hunks are parsed but none apply', () => {
    const code = 'const x = 1;\nconst y = 2;';
    // Bare unified diff (no fenced code block) so it does not trigger tier 4
    const response = `--- a/solution.js
+++ b/solution.js
@@ -1,2 +1,2 @@
 this line does not exist in code
-also not present
+replacement`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // Diff parsed but could not be applied — falls through
    // Tier 5 sees @@ marker → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('applies a unified diff hunk', () => {
    const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const response = `Here is the patch:

\`\`\`diff
--- a/solution.js
+++ b/solution.js
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 42;
 const c = 3;
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('unified_diff');
    expect(result.newCode).toContain('const b = 42;');
    expect(result.message).toBe('Applied 1 diff hunk(s)');
  });
});

// ---------------------------------------------------------------------------
// Tier 3: Fenced code block extraction
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — fenced code block', () => {
  it('extracts the largest code block when it looks like a complete file', () => {
    const code = 'function old() { return 1; }';
    const response = `Try this complete solution:

\`\`\`javascript
function newSolution() {
  const result = computeValue();
  return result * 2;
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
    expect(result.newCode).toContain('newSolution');
    expect(result.message).toBe('Code applied');
  });

  it('skips smaller code blocks in favor of the largest', () => {
    // Tests the branch where content.length is NOT > bestLen (the smaller block seen second)
    const code = 'old()';
    const response = `Full solution first:

\`\`\`js
function fullSolution() {
  const data = fetchData();
  const processed = processData(data);
  return formatOutput(processed);
}
\`\`\`

Small snippet:

\`\`\`js
x()
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
    expect(result.newCode).toContain('fullSolution');
    expect(result.newCode).not.toContain('x()');
  });

  it('selects the largest code block when multiple are present', () => {
    const code = 'old()';
    const response = `Small example:

\`\`\`js
x()
\`\`\`

Full solution:

\`\`\`js
function fullSolution() {
  const data = fetchData();
  const processed = processData(data);
  return formatOutput(processed);
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
    expect(result.newCode).toContain('fullSolution');
  });

  it('rejects tiny code blocks under 20 characters', () => {
    const code = 'const longExistingCode = "something quite substantial here";';
    const response = `Here is the fix:

\`\`\`js
x = 1;
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // Block is < 20 chars, so tier 4 skips it; tier 5 sees backticks → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('rejects code block that does not look complete (no definition keywords)', () => {
    // Block is >= 20 chars but has no function/class/import/const/def keywords
    const code = 'a'.repeat(500);
    const response = `\`\`\`js
let result = data.map(
  x => x.toString()
);
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // No function/class/const/import/def → not complete
    // Tier 5 sees backticks → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('accepts code block with function keyword when substantial (>=50% of current)', () => {
    const code = 'function old() { return 1; }';
    const response = `\`\`\`js
function solve(input) {
  return input.split('').reverse().join('');
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
    expect(result.newCode).toContain('function solve');
  });

  it('rejects code block with function keyword when too small (<50% of current)', () => {
    // Simulates the corrupted-json-parser bug: AI shows a single inner function
    // for analysis, diff applier should NOT replace the entire file with it
    const code = 'x'.repeat(500);
    const response = `\`\`\`js
function solve(input) {
  return input.split('').reverse().join('');
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('accepts code block with import keyword when substantial', () => {
    const code = 'const x = 1;';
    const response = `\`\`\`ts
import { readFile } from 'fs/promises';
const data = await readFile('input.txt', 'utf-8');
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
  });

  it('accepts code block with class keyword when substantial', () => {
    const code = 'const x = 1;';
    const response = `\`\`\`ts
class Solution {
  solve() { return 42; }
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
  });

  it('accepts code block with module.exports when substantial', () => {
    const code = 'const x = 1;';
    const response = `\`\`\`js
module.exports = function handler(req, res) {
  res.send('ok');
};
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('code_block');
  });

  it('does not extract fenced code block when SEARCH/REPLACE blocks were present but failed', () => {
    // AI response has SEARCH/REPLACE that fails to match, plus a fenced code block
    // showing an inner function for analysis. The fenced block should NOT replace the file.
    const code = 'function parseJSON(str) {\n  let i = 0;\n  function parseString() { /* ... */ }\n  function parseObject() { /* ... */ }\n  return parseValue();\n}';
    const response = `The issue is in parseObject. Here is the fix:

<<<<<<< SEARCH
nonexistent code that wont match
=======
replacement
>>>>>>> REPLACE

Current parseObject:

\`\`\`js
function parseObject() {
  i++;
  const obj = {};
  return obj;
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // SEARCH/REPLACE was detected (hadStructuredEdits=true), so fenced code block
    // extraction is skipped entirely. Falls through to needsApplyModel.
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
    // Most importantly: the original code must NOT be replaced with the snippet
    expect(result.newCode).toBe(code);
  });
});

// ---------------------------------------------------------------------------
// Tier 3b: Fenced diff blocks should NOT be treated as raw code
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — fenced diff block skipping', () => {
  it('does not dump a fenced diff block as raw code into the editor', () => {
    const code = `const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });

function deepEqual(a, b) {
  // Your code here — handle primitives, arrays, and plain objects
}

rl.on("line", (line) => { rl.close(); });`;

    const response = `FILE: solution.js
\`\`\`diff
@@
 function deepEqual(a, b) {
-  // Your code here — handle primitives, arrays, and plain objects
+  if (a === b) return true;
+  if (a === null || b === null) return false;
+  return false;
 }
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // Should either parse as unified diff or fall through to apply model — NOT dump raw diff as code
    if (result.applied) {
      expect(result.newCode).not.toContain('@@');
      expect(result.newCode).not.toMatch(/^[-+]/m);
    } else {
      expect(result.needsApplyModel).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tier 5: Fallback — code-like content detected but unparseable
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — fallback detection', () => {
  it('detects unparseable backtick blocks and sets needsApplyModel', () => {
    const code = 'const original = true;';
    // Has backticks but the block is too small / not complete
    const response = 'Try changing it to:\n```\nfoo\n```';

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('detects stray SEARCH marker in unparseable response', () => {
    const code = 'original';
    const response = '<< SEARCH\nbut no proper block structure';

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('detects stray @@ diff marker in unparseable response', () => {
    const code = 'original';
    const response = '@@ -1 +1 @@\ngarbled content';

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });

  it('detects bare conflict markers as code-like content', () => {
    const code = 'original';
    // Bare markers that cannot be paired (only one block, not two)
    const response = '<<<\nsomething\n>>>';

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // hasBareConflictMarkers would match, but parseBareConflictBlocks yields 1 block
    // which cannot be paired (needs 2). Then hasCode sees the bare markers and sets needsApplyModel.
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No code in response
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — no code', () => {
  it('returns no-change when response has no code-like content', () => {
    const code = 'const x = 1;';
    const response = 'The solution looks correct. No changes needed.';

    const result = applyCodeFromResponse(response, code, 'typescript', 'code');
    expect(result.applied).toBe(false);
    expect(result.newCode).toBe(code);
    expect(result.method).toBe('none');
    expect(result.needsApplyModel).toBe(false);
    expect(result.message).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tier priority: SEARCH/REPLACE beats unified diff beats code block
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — tier priority', () => {
  it('prefers SEARCH/REPLACE over a code block in the same response', () => {
    const code = 'const x = 1;';
    const response = `<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE

\`\`\`javascript
function completelyDifferent() {
  return "this is the code block";
}
\`\`\``;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.method).toBe('search_replace');
    expect(result.newCode).toBe('const x = 2;');
  });
});

// ---------------------------------------------------------------------------
// Colon-style SEARCH/REPLACE via applyCodeFromResponse
// ---------------------------------------------------------------------------

describe('applyCodeFromResponse — colon-style SEARCH/REPLACE', () => {
  it('applies inline colon-style SEARCH/REPLACE', () => {
    const code = 'right = arr.length;';
    const response = `Here is the fix:

SEARCH: right = arr.length;
REPLACE: right = arr.length - 1;`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.newCode).toBe('right = arr.length - 1;');
  });

  it('applies multi-line colon-style SEARCH/REPLACE', () => {
    const code = 'function solve() {\n  return 1;\n}';
    const response = `SEARCH:
function solve() {
  return 1;
}
REPLACE:
function solve() {
  return 2;
}`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    expect(result.applied).toBe(true);
    expect(result.method).toBe('search_replace');
    expect(result.newCode).toBe('function solve() {\n  return 2;\n}');
  });

  it('falls back to needsApplyModel when colon-style block cannot match', () => {
    const code = 'const x = 1;';
    const response = `SEARCH: nonexistent code
REPLACE: new code`;

    const result = applyCodeFromResponse(response, code, 'javascript', 'code');
    // Block parsed but search doesn't match → falls through
    // hasCode detects the colon markers → needsApplyModel
    expect(result.applied).toBe(false);
    expect(result.needsApplyModel).toBe(true);
  });
});
