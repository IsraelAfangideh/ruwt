/**
 * Fill-in-the-middle (FIM) prompt builder for inline completions.
 *
 * Builds a prompt from the code before and after the cursor,
 * formatted for the model to generate the missing middle.
 */

const MAX_PREFIX_CHARS = 2000;  // ~500 tokens
const MAX_SUFFIX_CHARS = 1000;  // ~250 tokens

export interface FIMPromptOptions {
  prefix: string;
  suffix: string;
  language: string;
  filePath?: string;
}

export interface FIMPromptResult {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  stopSequences?: string[];
}

export function buildFIMPrompt(opts: FIMPromptOptions): FIMPromptResult {
  const prefix = opts.prefix.length > MAX_PREFIX_CHARS
    ? opts.prefix.slice(-MAX_PREFIX_CHARS)
    : opts.prefix;

  const suffix = opts.suffix.length > MAX_SUFFIX_CHARS
    ? opts.suffix.slice(0, MAX_SUFFIX_CHARS)
    : opts.suffix;

  const fileContext = opts.filePath ? ` in file ${opts.filePath}` : '';

  const systemPrompt = `You are a code completion engine for ${opts.language}${fileContext}. Complete the code at the [CURSOR] position. Return ONLY the code to insert — no explanations, no markdown, no backticks. If unsure, return an empty string.`;

  const userPrompt = suffix
    ? `${prefix}[CURSOR]${suffix}`
    : `${prefix}[CURSOR]`;

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stopSequences: ['\n\n', '[CURSOR]', '```'],
  };
}
