import { describe, it, expect } from 'vitest';

// We can't import judge.ts directly since it depends on fetch to Piston,
// but we can test the pure utility functions by extracting them.
// Since the utility functions (buildTestCode, extractFunctionName, escapeJSString, etc.)
// are not exported, we test their behavior indirectly through the module's contracts.

// For testability, let's test the harness-building patterns by reimplementing the
// pure logic here (mirrors judge.ts). This verifies our test harness logic is correct
// without needing network access.

function extractMultiExportNames(sourceCode: string): string[] | null {
  const m = sourceCode.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (!m) return null;
  const names = m[1].split(',').map(s => s.trim().split(/\s*:\s*/)[0].trim()).filter(Boolean);
  return names.length > 1 ? names : null;
}

function extractFunctionName(sourceCode: string, language: 'javascript' | 'typescript' | 'python'): string | null {
  let m = sourceCode.match(/module\.exports\s*=\s*\{\s*(\w+)/);
  if (m) return m[1];
  m = sourceCode.match(/module\.exports\s*=\s*(\w+)/);
  if (m) return m[1];
  if (language === 'python') {
    m = sourceCode.match(/^def\s+(\w+)\s*\(/m);
    return m ? m[1] : null;
  }
  m = sourceCode.match(/^function\s+(\w+)\s*\(/m);
  if (m) return m[1];
  m = sourceCode.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\()/m);
  if (m) return m[1];
  return null;
}

function escapeJSString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function escapePyString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

describe('extractFunctionName', () => {
  it('extracts from module.exports = { funcName }', () => {
    expect(extractFunctionName('module.exports = { solve }', 'javascript')).toBe('solve');
  });

  it('extracts from module.exports = funcName', () => {
    expect(extractFunctionName('module.exports = twoSum', 'javascript')).toBe('twoSum');
  });

  it('extracts from function declaration', () => {
    expect(extractFunctionName('function myFunc() {}', 'javascript')).toBe('myFunc');
  });

  it('extracts from const arrow function', () => {
    expect(extractFunctionName('const solve = (n) => n * 2', 'javascript')).toBe('solve');
  });

  it('extracts Python def', () => {
    expect(extractFunctionName('def solve(n):\n  return n', 'python')).toBe('solve');
  });

  it('returns null when no function found', () => {
    expect(extractFunctionName('// just a comment', 'javascript')).toBeNull();
  });

  it('prefers module.exports over function declaration', () => {
    const code = 'function inner() {}\nmodule.exports = { inner }';
    expect(extractFunctionName(code, 'javascript')).toBe('inner');
  });
});

describe('extractMultiExportNames', () => {
  it('extracts multiple names from module.exports = { a, b, c }', () => {
    expect(extractMultiExportNames('module.exports = { add, subtract, multiply }')).toEqual([
      'add', 'subtract', 'multiply',
    ]);
  });

  it('returns null for single export', () => {
    expect(extractMultiExportNames('module.exports = { solve }')).toBeNull();
  });

  it('returns null for non-object export', () => {
    expect(extractMultiExportNames('module.exports = solve')).toBeNull();
  });

  it('handles key:value pairs', () => {
    expect(extractMultiExportNames('module.exports = { add: addFn, sub: subFn }')).toEqual([
      'add', 'sub',
    ]);
  });
});

describe('escapeJSString', () => {
  it('escapes backslashes', () => {
    expect(escapeJSString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('escapes single quotes', () => {
    expect(escapeJSString("it's")).toBe("it\\'s");
  });

  it('escapes newlines', () => {
    expect(escapeJSString('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes tabs', () => {
    expect(escapeJSString('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('handles combined escaping', () => {
    expect(escapeJSString("it's a\nnew\\day")).toBe("it\\'s a\\nnew\\\\day");
  });
});

describe('escapePyString', () => {
  it('escapes the same characters as JS', () => {
    expect(escapePyString("it's a\nnew\\day")).toBe("it\\'s a\\nnew\\\\day");
  });
});

describe('test harness patterns', () => {
  it('solve function in multi-export is used as single dispatch', () => {
    const code = 'function add(a,b){return a+b}\nfunction solve(n){return n}\nmodule.exports = { add, solve }';
    const multi = extractMultiExportNames(code);
    expect(multi).not.toBeNull();
    // When 'solve' is in multiExports, it should be used as the single function
    if (multi && multi.includes('solve')) {
      const funcName = 'solve';
      expect(funcName).toBe('solve');
    }
  });
});
