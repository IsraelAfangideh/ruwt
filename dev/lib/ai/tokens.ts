// Simple token counting without tiktoken (which has WASM issues in Next.js)
// This is an approximation based on average token length

// Average character per token varies by model/language
// GPT models average about 4 characters per token for English
const CHARS_PER_TOKEN = 4;

export function countTokens(text: string): number {
  // Simple approximation: characters / 4
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function countMessageTokens(messages: Array<{ role: string; content: string }>): number {
  let tokenCount = 0;

  for (const message of messages) {
    // Every message adds overhead for formatting (~4 tokens)
    tokenCount += 4;
    tokenCount += countTokens(message.role);
    tokenCount += countTokens(message.content);
  }

  // Every reply is primed with assistant prefix
  tokenCount += 3;

  return tokenCount;
}

export function estimateOutputTokens(prompt: string): number {
  // Rough estimate: output is typically 1-2x the input for code generation
  const inputTokens = countTokens(prompt);
  return Math.min(inputTokens * 1.5, 4096); // Cap at 4096 for estimation
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + '...';
}
