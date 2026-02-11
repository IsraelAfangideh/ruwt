/**
 * Generates seed-d1.sql for D1. Run the output with:
 *   npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql
 * For local D1 (pages dev):
 *   npx wrangler d1 execute <DB_NAME> --local --file=./scripts/seed-d1.sql
 *
 * DB_NAME is the name in wrangler.toml under [d1_databases] (e.g. ruwt-dev).
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

const sampleChallenges: Array<{
  id: string;
  title: string;
  description: string;
  difficulty: string;
  starterCode: string;
  testCases: Array<{ input: string; expectedOutput: string }>;
  execTimeLimit: number;
  execMemoryLimit: number;
  maxTokens: number;
  maxCost: number;
  wallClockLimit: number;
}> = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] == 9, so return [0, 1].`,
    difficulty: 'easy',
    starterCode: `function twoSum(nums, target) {
  // Your code here
}

module.exports = { twoSum };`,
    testCases: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]' },
      { input: '[3,3]\n6', expectedOutput: '[0,1]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: 50000,
    maxCost: 1000,
    wallClockLimit: 1800,
  },
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz',
    description: `Write a function that returns an array of strings from 1 to n based on the following rules:
- For multiples of 3, return "Fizz"
- For multiples of 5, return "Buzz"
- For multiples of both 3 and 5, return "FizzBuzz"
- For all other numbers, return the number as a string

Example:
Input: n = 15
Output: ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]`,
    difficulty: 'easy',
    starterCode: `function fizzBuzz(n) {
  // Your code here
}

module.exports = { fizzBuzz };`,
    testCases: [
      { input: '3', expectedOutput: '["1","2","Fizz"]' },
      { input: '5', expectedOutput: '["1","2","Fizz","4","Buzz"]' },
      { input: '15', expectedOutput: '["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: 30000,
    maxCost: 500,
    wallClockLimit: 900,
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Example:
Input: s = "()[]{}"
Output: true

Input: s = "(]"
Output: false`,
    difficulty: 'medium',
    starterCode: `function isValid(s) {
  // Your code here
}

module.exports = { isValid };`,
    testCases: [
      { input: '()', expectedOutput: 'true' },
      { input: '()[]{}', expectedOutput: 'true' },
      { input: '(]', expectedOutput: 'false' },
      { input: '([)]', expectedOutput: 'false' },
      { input: '{[]}', expectedOutput: 'true' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: 75000,
    maxCost: 2000,
    wallClockLimit: 1800,
  },
  {
    id: 'merge-sorted-arrays',
    title: 'Merge Sorted Arrays',
    description: `You are given two integer arrays nums1 and nums2, sorted in non-decreasing order, and two integers m and n, representing the number of elements in nums1 and nums2 respectively.

Merge nums1 and nums2 into a single array sorted in non-decreasing order.

The final sorted array should be stored inside nums1. To accommodate this, nums1 has a length of m + n, where the first m elements denote the elements that should be merged, and the last n elements are set to 0.

Return the merged array.

Example:
Input: nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3
Output: [1,2,2,3,5,6]`,
    difficulty: 'medium',
    starterCode: `function merge(nums1, m, nums2, n) {
  // Your code here
  return nums1;
}

module.exports = { merge };`,
    testCases: [
      { input: '[1,2,3,0,0,0]\n3\n[2,5,6]\n3', expectedOutput: '[1,2,2,3,5,6]' },
      { input: '[1]\n1\n[]\n0', expectedOutput: '[1]' },
      { input: '[0]\n0\n[1]\n1', expectedOutput: '[1]' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: 75000,
    maxCost: 2000,
    wallClockLimit: 1800,
  },
  {
    id: 'longest-substring-without-repeating',
    title: 'Longest Substring Without Repeating Characters',
    description: `Given a string s, find the length of the longest substring without repeating characters.

Example:
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.

Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.`,
    difficulty: 'hard',
    starterCode: `function lengthOfLongestSubstring(s) {
  // Your code here
}

module.exports = { lengthOfLongestSubstring };`,
    testCases: [
      { input: 'abcabcbb', expectedOutput: '3' },
      { input: 'bbbbb', expectedOutput: '1' },
      { input: 'pwwkew', expectedOutput: '3' },
      { input: '', expectedOutput: '0' },
    ],
    execTimeLimit: 5000,
    execMemoryLimit: 256,
    maxTokens: 100000,
    maxCost: 5000,
    wallClockLimit: 2700,
  },
];

function main() {
  const lines: string[] = [
    '-- D1 seed: challenges. Generated by scripts/seed-d1.ts',
    '-- Run: npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql',
    '',
  ];

  for (const c of sampleChallenges) {
    const testCasesJson = escapeSql(JSON.stringify(c.testCases));
    const row = `INSERT OR REPLACE INTO challenges (id, title, description, difficulty, starter_code, test_cases, exec_time_limit, exec_memory_limit, max_tokens, max_cost, wall_clock_limit) VALUES ('${escapeSql(c.id)}', '${escapeSql(c.title)}', '${escapeSql(c.description)}', '${escapeSql(c.difficulty)}', '${escapeSql(c.starterCode)}', '${testCasesJson}', ${c.execTimeLimit}, ${c.execMemoryLimit}, ${c.maxTokens}, ${c.maxCost}, ${c.wallClockLimit});`;
    lines.push(row);
  }

  const outPath = join(__dirname, 'seed-d1.sql');
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  console.log('Run against remote D1: npx wrangler d1 execute <DB_NAME> --remote --file=./scripts/seed-d1.sql');
  console.log('Run against local D1:  npx wrangler d1 execute <DB_NAME> --local --file=./scripts/seed-d1.sql');
}

main();
