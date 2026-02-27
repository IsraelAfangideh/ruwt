-- 0031_qr_sprint_harnesses.sql
-- Fix: Add test_harness + clean starter_code for 7 simple JS qr-* challenges.
-- Root cause: judge.ts line 218 runs JSON.parse on test inputs, converting
-- "12345" → number 12345, "121" → number 121, etc. String challenges then fail
-- because .split() / .toLowerCase() don't exist on numbers.
-- Solution: Add solve() harnesses that coerce types correctly before calling
-- the user's function, and update starter_code to export clean functions
-- (no readline boilerplate).
--
-- Run: npx wrangler d1 execute ruwt-dev --remote --file=./drizzle/migrations-d1/0031_qr_sprint_harnesses.sql

-- ============================================================
-- 1. qr-reverse-string — string input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  return reverseString(String(input));
}
module.exports = { solve };',
  starter_code = 'function reverseString(str) {
  // Your code here — do NOT use .reverse()
}

module.exports = { reverseString };'
WHERE id = 'qr-reverse-string';

-- ============================================================
-- 2. qr-is-palindrome — string input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  const result = isPalindrome(String(input));
  return String(result);
}
module.exports = { solve };',
  starter_code = 'function isPalindrome(str) {
  // Your code here — ignore case and non-alphanumeric chars
  // Return true or false
}

module.exports = { isPalindrome };'
WHERE id = 'qr-is-palindrome';

-- ============================================================
-- 3. qr-sum-array — JSON array input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  const arr = typeof input === "string" ? JSON.parse(input) : input;
  return String(sumArray(arr));
}
module.exports = { solve };',
  starter_code = 'function sumArray(arr) {
  // Your code here — return the sum of all numbers
}

module.exports = { sumArray };'
WHERE id = 'qr-sum-array';

-- ============================================================
-- 4. qr-find-max — JSON array input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  const arr = typeof input === "string" ? JSON.parse(input) : input;
  return String(findMax(arr));
}
module.exports = { solve };',
  starter_code = 'function findMax(arr) {
  // Your code here — do NOT use Math.max
}

module.exports = { findMax };'
WHERE id = 'qr-find-max';

-- ============================================================
-- 5. qr-count-vowels — string input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  return String(countVowels(String(input)));
}
module.exports = { solve };',
  starter_code = 'function countVowels(str) {
  // Your code here — count a, e, i, o, u (case-insensitive)
}

module.exports = { countVowels };'
WHERE id = 'qr-count-vowels';

-- ============================================================
-- 6. qr-capitalize-words — string input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  return capitalizeWords(String(input));
}
module.exports = { solve };',
  starter_code = 'function capitalizeWords(str) {
  // Your code here
}

module.exports = { capitalizeWords };'
WHERE id = 'qr-capitalize-words';

-- ============================================================
-- 7. qr-remove-duplicates — JSON array input
-- ============================================================
UPDATE challenges SET
  test_harness = 'function solve(input) {
  const arr = typeof input === "string" ? JSON.parse(input) : input;
  return JSON.stringify(removeDuplicates(arr));
}
module.exports = { solve };',
  starter_code = 'function removeDuplicates(arr) {
  // Your code here — preserve original order
}

module.exports = { removeDuplicates };'
WHERE id = 'qr-remove-duplicates';
