import './load-env';
import { db, challenges } from '../drizzle';

const sampleChallenges = [
  {
    title: 'Two Sum',
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] == 9, so return [0, 1].`,
    difficulty: 'easy' as const,
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
    title: 'FizzBuzz',
    description: `Write a function that returns an array of strings from 1 to n based on the following rules:
- For multiples of 3, return "Fizz"
- For multiples of 5, return "Buzz"
- For multiples of both 3 and 5, return "FizzBuzz"
- For all other numbers, return the number as a string

Example:
Input: n = 15
Output: ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]`,
    difficulty: 'easy' as const,
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
    difficulty: 'medium' as const,
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
    title: 'Merge Sorted Arrays',
    description: `You are given two integer arrays nums1 and nums2, sorted in non-decreasing order, and two integers m and n, representing the number of elements in nums1 and nums2 respectively.

Merge nums1 and nums2 into a single array sorted in non-decreasing order.

The final sorted array should be stored inside nums1. To accommodate this, nums1 has a length of m + n, where the first m elements denote the elements that should be merged, and the last n elements are set to 0.

Return the merged array.

Example:
Input: nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3
Output: [1,2,2,3,5,6]`,
    difficulty: 'medium' as const,
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
    title: 'Longest Substring Without Repeating Characters',
    description: `Given a string s, find the length of the longest substring without repeating characters.

Example:
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.

Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.`,
    difficulty: 'hard' as const,
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

async function seed() {
  console.log('Seeding challenges...');

  for (const challenge of sampleChallenges) {
    await db.insert(challenges).values(challenge);
    console.log(`  Created: ${challenge.title}`);
  }

  console.log('Done!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
