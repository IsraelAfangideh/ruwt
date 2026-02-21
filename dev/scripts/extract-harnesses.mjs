/**
 * Extract test harnesses from solve()-based challenges.
 *
 * Reads challenges dump from D1, splits starter code at the solve() boundary:
 *   - Everything before solve() → new starter_code (implementation skeleton)
 *   - solve() + module.exports → test_harness (secret, server-side)
 *
 * Also reclassifies the last 2 of 5+ public test cases as hidden.
 *
 * Outputs: dev/drizzle/migrations-d1/0021_populate_harnesses.sql
 *
 * Usage:
 *   1. npx wrangler d1 execute ruwt-dev --remote --command \
 *        "SELECT id, title, starter_code, test_cases, hidden_test_cases, language FROM challenges ORDER BY id" \
 *        --json > /tmp/challenges-raw.txt
 *   2. node dev/scripts/extract-harnesses.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load challenge data ──────────────────────────────────────────────

const raw = readFileSync('/tmp/challenges-raw.txt', 'utf-8');
const data = JSON.parse(raw);
const allChallenges = data[0].results;

// ── Filter: extractable = has solve() and is NOT a QA challenge ─────

const extractable = allChallenges.filter(ch => {
  if (!ch.starter_code) return false;
  if (ch.id.startsWith('qa-')) return false; // QA: user writes solve()
  const hasSolveJS = ch.starter_code.includes('function solve(');
  const hasSolvePy = ch.starter_code.includes('def solve(');
  return hasSolveJS || hasSolvePy;
});

console.log(`Found ${extractable.length} extractable challenges (out of ${allChallenges.length} total)`);

// ── SQL escaping ────────────────────────────────────────────────────

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// ── Extract harness from JavaScript challenges ──────────────────────

function extractJS(code) {
  // Find the start of function solve(
  const solveIdx = code.indexOf('function solve(');
  if (solveIdx < 0) return null;

  let starterCode = code.substring(0, solveIdx).trim();
  let harness = code.substring(solveIdx).trim();

  // Remove module.exports from starter code (it's in the harness now)
  starterCode = starterCode.replace(/module\.exports\s*=\s*[^;]+;?\s*/g, '').trim();

  // Ensure harness ends with module.exports = { solve }
  if (!harness.includes('module.exports')) {
    harness += '\n\nmodule.exports = { solve };';
  }

  // Extract implementation function names from starter code to build a clean export
  const funcNames = [];
  const funcPattern = /(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\(|class\b))/g;
  let match;
  while ((match = funcPattern.exec(starterCode)) !== null) {
    const name = match[1] || match[2];
    if (name && name !== 'solve') funcNames.push(name);
  }

  // Also look for class declarations
  const classPattern = /class\s+(\w+)/g;
  while ((match = classPattern.exec(starterCode)) !== null) {
    funcNames.push(match[1]);
  }

  // Add module.exports for implementation functions (so they're available but not solve)
  if (funcNames.length > 0) {
    // Check if there's already an exports line we should replace
    starterCode += `\n\nmodule.exports = { ${funcNames.join(', ')} };`;
  }

  return { starterCode, harness };
}

// ── Extract harness from Python challenges ──────────────────────────

function extractPython(code) {
  // Find the start of def solve(
  const solveIdx = code.indexOf('def solve(');
  if (solveIdx < 0) return null;

  const lines = code.split('\n');
  const solveLineIdx = lines.findIndex(l => l.startsWith('def solve('));
  if (solveLineIdx < 0) return null;

  // Find where solve() ends: next top-level (unindented) def/class, or EOF
  let solveEndLineIdx = lines.length;
  for (let i = solveLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // A top-level def or class (not indented, not blank, not a comment)
    if (/^(def |class )/.test(line)) {
      solveEndLineIdx = i;
      break;
    }
  }

  const beforeSolve = lines.slice(0, solveLineIdx).join('\n').trim();
  const solveBody = lines.slice(solveLineIdx, solveEndLineIdx).join('\n').trim();
  const afterSolve = lines.slice(solveEndLineIdx).join('\n').trim();

  // Harness is just the solve() function
  const harness = solveBody;

  // Starter is everything before + everything after solve()
  const parts = [beforeSolve, afterSolve].filter(p => p.length > 0);
  const starterCode = parts.join('\n\n');

  return { starterCode, harness };
}

// ── Process each challenge ──────────────────────────────────────────

const sqlStatements = [];
let successCount = 0;
let hiddenMoveCount = 0;

for (const ch of extractable) {
  const lang = ch.language || 'javascript';
  const isPython = lang === 'python';

  const result = isPython
    ? extractPython(ch.starter_code)
    : extractJS(ch.starter_code);

  if (!result) {
    console.warn(`  SKIP ${ch.id}: could not find solve() boundary`);
    continue;
  }

  const { starterCode, harness } = result;

  // Sanity checks
  if (starterCode.length < 10) {
    console.warn(`  SKIP ${ch.id}: starter code too short after extraction (${starterCode.length} chars)`);
    continue;
  }
  if (harness.length < 20) {
    console.warn(`  SKIP ${ch.id}: harness too short (${harness.length} chars)`);
    continue;
  }

  // Build SQL update for starter_code and test_harness
  let sql = `UPDATE challenges SET starter_code = '${escapeSql(starterCode)}', test_harness = '${escapeSql(harness)}'`;

  // Reclassify last 2 public tests as hidden (if 5+ public tests and no hidden tests yet)
  let testCases;
  try { testCases = JSON.parse(ch.test_cases); } catch { testCases = []; }

  let existingHidden;
  try { existingHidden = ch.hidden_test_cases ? JSON.parse(ch.hidden_test_cases) : []; } catch { existingHidden = []; }

  if (testCases.length >= 5 && existingHidden.length === 0) {
    const publicKeep = testCases.slice(0, -2);
    const moveToHidden = testCases.slice(-2);
    sql += `, test_cases = '${escapeSql(JSON.stringify(publicKeep))}', hidden_test_cases = '${escapeSql(JSON.stringify(moveToHidden))}'`;
    hiddenMoveCount++;
  }

  sql += ` WHERE id = '${escapeSql(ch.id)}';`;
  sqlStatements.push(sql);
  successCount++;

  console.log(`  OK ${ch.id} (${lang}) — starter: ${starterCode.length} chars, harness: ${harness.length} chars${testCases.length >= 5 && existingHidden.length === 0 ? ', +2 hidden tests' : ''}`);
}

// ── Write output SQL ────────────────────────────────────────────────

const header = `-- Auto-generated by extract-harnesses.mjs
-- Extracts solve() dispatch from starter_code into test_harness column
-- Also reclassifies last 2 public tests as hidden for challenges with 5+ tests
-- Generated: ${new Date().toISOString()}

`;

const outputPath = resolve(__dirname, '../drizzle/migrations-d1/0021_populate_harnesses.sql');
writeFileSync(outputPath, header + sqlStatements.join('\n\n') + '\n');

console.log(`\nDone: ${successCount}/${extractable.length} challenges processed`);
console.log(`Hidden tests reclassified: ${hiddenMoveCount} challenges`);
console.log(`Output: ${outputPath}`);
