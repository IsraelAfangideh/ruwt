/**
 * POST /api/ai/apply
 * Non-streaming apply model endpoint.
 * When structured edit parsing fails, calls a code-specialized model to merge
 * the AI's intended changes into the current code.
 *
 * Three-layer reliability:
 *   Layer 1 (client): Parsing cascade (SEARCH/REPLACE, unified diff, fenced blocks)
 *   Layer 2 (here):   Qwen2.5-Coder-32B merge model
 *   Layer 3 (here):   Verification — detects corruption before returning to client
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { calculateCost } from '../../_shared/ai-pricing';
import { logError } from '../../_shared/error-monitor';
import { attempts, aiCalls } from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  attemptId: z.string().uuid(),
  currentCode: z.string(),
  aiResponse: z.string(),
  language: z.string(),
  challengeId: z.string().optional(),
  challengeTitle: z.string().optional(),
});

// Best code model first, general models as fallback
const APPLY_MODELS = [
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
];

// Kortix FastApply-inspired prompt: show original, show update, ask for merge
const SYSTEM_PROMPT = `You are a precise code merge tool. You receive an ORIGINAL file and an UPDATE containing changes described by an AI assistant. Your job is to produce the complete, final MERGED file.

Rules:
- Apply EXACTLY the changes the AI intended. Reproduce every character faithfully.
- Pay special attention to special syntax: regex patterns (especially lookbehinds like (?<=), lookaheads like (?=)), template literals, escape sequences, unicode. Copy these EXACTLY character-for-character.
- Do NOT paraphrase, simplify, or "improve" any code. Your job is to merge, not to edit.
- Preserve ALL existing code that wasn't changed: function signatures, exports, imports, comments.
- If the update contains no clear code changes, output the original file unchanged.
- Output a JSON object with a single key "mergedCode" containing the complete merged file content as a string.`;

// JSON schema for structured output
const APPLY_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    type: 'object',
    properties: {
      mergedCode: { type: 'string', description: 'The complete merged file content' },
    },
    required: ['mergedCode'],
  },
};

// ---------------------------------------------------------------------------
// Verification — Layer 3: detect corruption before returning to client
// ---------------------------------------------------------------------------

interface VerifyResult {
  verified: boolean;
  errors: string[];
}

/**
 * Extract code blocks from AI response text (the changes to apply).
 */
function extractCodeFromResponse(aiResponse: string): string[] {
  const blocks: string[] = [];
  const fencePattern = /```(?:\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = fencePattern.exec(aiResponse)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

/**
 * Normalize a line for comparison: collapse whitespace, trim.
 */
function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/**
 * Extract "new" lines from the AI's code — lines present in AI code blocks
 * but NOT in the original code. These represent the AI's intended changes
 * and MUST survive the merge.
 */
function extractNewLines(aiCodeBlocks: string[], originalCode: string): string[] {
  const originalNormalized = new Set(
    originalCode.split('\n').map(normalizeLine).filter(l => l.length > 0)
  );

  const newLines: string[] = [];
  for (const block of aiCodeBlocks) {
    for (const line of block.split('\n')) {
      const normalized = normalizeLine(line);
      // Skip empty lines, very short lines (braces, etc.), and lines already in original
      if (normalized.length < 4) continue;
      if (originalNormalized.has(normalized)) continue;
      newLines.push(normalized);
    }
  }

  return [...new Set(newLines)]; // dedupe
}

/**
 * Extract distinctive tokens from AI code that don't appear in original.
 * Catches things like (?<= being corrupted to (?< even if the line
 * is otherwise slightly reformatted.
 */
function extractDistinctiveTokens(aiCodeBlocks: string[], originalCode: string): string[] {
  const tokens: string[] = [];

  for (const block of aiCodeBlocks) {
    // Regex literals: /.../ (at least 3 chars inside)
    const regexMatches = block.matchAll(/\/(?:[^/\\]|\\.){3,}\/[gimsuy]*/g);
    for (const m of regexMatches) {
      if (!originalCode.includes(m[0])) tokens.push(m[0]);
    }

    // String literals: '...' or "..." (at least 4 chars inside)
    const stringMatches = block.matchAll(/(['"])(?:[^'"\\\n]|\\.){4,}\1/g);
    for (const m of stringMatches) {
      if (!originalCode.includes(m[0])) tokens.push(m[0]);
    }

    // Template literals: `...` (at least 4 chars inside)
    const templateMatches = block.matchAll(/`(?:[^`\\]|\\.){4,}`/g);
    for (const m of templateMatches) {
      if (!originalCode.includes(m[0])) tokens.push(m[0]);
    }

    // Special regex syntax that models commonly corrupt
    const specialPatterns = [
      /\(\?<=([^)]*)\)/g,  // lookbehind (?<=...)
      /\(\?<!([^)]*)\)/g,  // negative lookbehind (?<!...)
      /\(\?=([^)]*)\)/g,   // lookahead (?=...)
      /\(\?!([^)]*)\)/g,   // negative lookahead (?!...)
    ];
    for (const pat of specialPatterns) {
      const matches = block.matchAll(pat);
      for (const m of matches) {
        if (!originalCode.includes(m[0])) tokens.push(m[0]);
      }
    }
  }

  return [...new Set(tokens)];
}

/**
 * Verify merged code faithfully reproduces the AI's intended changes.
 *
 * Checks:
 * 1. Size sanity — not severely truncated or hallucinated
 * 2. Structure preservation — function/class names from original survive
 * 3. New content survival — AI's new code appears in merged output
 * 4. Distinctive token survival — special syntax (regex, strings) preserved
 * 5. Bracket balance — not truncated mid-expression
 */
function verifyMergedCode(
  originalCode: string,
  aiResponse: string,
  mergedCode: string,
): VerifyResult {
  const errors: string[] = [];

  // 1. Size sanity
  const origLines = originalCode.split('\n').length;
  const mergedLines = mergedCode.split('\n').length;
  if (origLines > 5 && mergedLines < origLines * 0.3) {
    errors.push(`Severe truncation: merged has ${mergedLines} lines vs original ${origLines}`);
  }

  // 2. Structure preservation — function/class names from original must survive
  const namePattern = /(?:function\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\())/g;
  const originalNames: string[] = [];
  let nameMatch;
  while ((nameMatch = namePattern.exec(originalCode)) !== null) {
    const name = nameMatch[1] || nameMatch[2] || nameMatch[3];
    if (name) originalNames.push(name);
  }
  for (const name of originalNames) {
    if (!mergedCode.includes(name)) {
      errors.push(`Missing function/class from original: "${name}"`);
    }
  }

  // 3. New content survival — AI's intended changes must appear in merged output
  const aiCodeBlocks = extractCodeFromResponse(aiResponse);
  if (aiCodeBlocks.length > 0) {
    const newLines = extractNewLines(aiCodeBlocks, originalCode);
    const mergedNormalized = new Set(
      mergedCode.split('\n').map(normalizeLine).filter(l => l.length > 0)
    );

    let missing = 0;
    const missingLines: string[] = [];
    for (const line of newLines) {
      if (!mergedNormalized.has(line)) {
        missing++;
        if (missingLines.length < 5) missingLines.push(line);
      }
    }

    // If more than 30% of new lines are missing, something went wrong
    if (newLines.length > 0 && missing / newLines.length > 0.3) {
      errors.push(
        `${missing}/${newLines.length} new code lines missing from merge. ` +
        `Examples: ${missingLines.map(l => `"${l.substring(0, 60)}"`).join(', ')}`
      );
    }
  }

  // 4. Distinctive token survival — special syntax preserved character-for-character
  if (aiCodeBlocks.length > 0) {
    const tokens = extractDistinctiveTokens(aiCodeBlocks, originalCode);
    const missingTokens: string[] = [];
    for (const token of tokens) {
      if (!mergedCode.includes(token)) {
        missingTokens.push(token);
      }
    }
    if (missingTokens.length > 0) {
      errors.push(
        `Critical tokens corrupted: ${missingTokens.map(t => `"${t.substring(0, 40)}"`).join(', ')}`
      );
    }
  }

  // 5. Bracket balance — catch truncation mid-expression
  let curlyBalance = 0;
  let parenBalance = 0;
  for (const ch of mergedCode) {
    if (ch === '{') curlyBalance++;
    else if (ch === '}') curlyBalance--;
    else if (ch === '(') parenBalance++;
    else if (ch === ')') parenBalance--;
  }
  // Allow small imbalances (template literals, regex, etc.) but flag severe ones
  if (Math.abs(curlyBalance) > 3) {
    errors.push(`Unbalanced curly braces: ${curlyBalance > 0 ? '+' : ''}${curlyBalance}`);
  }
  if (Math.abs(parenBalance) > 3) {
    errors.push(`Unbalanced parentheses: ${parenBalance > 0 ? '+' : ''}${parenBalance}`);
  }

  return { verified: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Fence stripping
// ---------------------------------------------------------------------------

/**
 * Extract raw code from model output, stripping markdown fences and
 * any prose the model added despite instructions.
 */
function stripFences(text: string): string {
  const trimmed = text.trim();

  // Try to extract the largest fenced code block from anywhere in the output.
  const fenceMatches = [...trimmed.matchAll(/```\w*\n([\s\S]*?)```/g)];
  if (fenceMatches.length > 0) {
    let best = '';
    for (const m of fenceMatches) {
      if (m[1].length > best.length) best = m[1];
    }
    return best.replace(/\n$/, '');
  }

  // No fences — check if it starts with ``` (unclosed fence)
  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    lines.shift();
    if (lines[lines.length - 1]?.trim() === '```') lines.pop();
    return lines.join('\n');
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { attemptId, currentCode, aiResponse, language, challengeId, challengeTitle } = parsed.data;

    // Verify attempt ownership
    const db = getDb(context.env);
    const [attempt] = await db
      .select({ userId: attempts.userId, challengeId: attempts.challengeId })
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);
    if (!attempt) {
      return Response.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.userId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accountId = context.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = context.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return Response.json(
        { error: 'AI credentials not configured' },
        { status: 500 }
      );
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `<ORIGINAL>\n${currentCode}\n</ORIGINAL>\n\n<UPDATE>\n${aiResponse}\n</UPDATE>\n\nOutput the complete merged file now:`,
      },
    ];

    // Try models in order (best code model first)
    let mergedCode: string | null = null;
    let usedModel = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for (const modelId of APPLY_MODELS) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages,
              max_tokens: 8192,
              temperature: 0.0,
              response_format: APPLY_RESPONSE_FORMAT,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.text();
          const isUnavailable =
            response.status === 404 ||
            response.status === 400 ||
            err.toLowerCase().includes('not found');
          if (isUnavailable && modelId !== APPLY_MODELS[APPLY_MODELS.length - 1]) {
            continue;
          }
          throw new Error(`Model error: ${response.status} - ${err}`);
        }

        const json = (await response.json()) as Record<string, unknown>;

        // Extract content from response (non-streaming)
        let content = '';
        const result = json.result as Record<string, unknown> | undefined;
        if (result) {
          if (typeof result.response === 'string') {
            content = result.response;
          } else if (Array.isArray(result.choices) && result.choices.length > 0) {
            const msg = (result.choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
            content = typeof msg?.content === 'string' ? msg.content : '';
          }
        }

        if (!content || content.trim().length < 10) {
          if (modelId !== APPLY_MODELS[APPLY_MODELS.length - 1]) continue;
          return Response.json({ error: 'Apply model returned empty result' }, { status: 502 });
        }

        // Try JSON parse first (response_format should produce valid JSON)
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed.mergedCode === 'string' && parsed.mergedCode.trim().length > 0) {
            mergedCode = parsed.mergedCode;
          } else {
            // JSON parsed but no mergedCode field — fall back to fence stripping
            mergedCode = stripFences(content);
          }
        } catch {
          // JSON mode not respected — fall back to fence stripping
          mergedCode = stripFences(content);
        }
        usedModel = modelId;

        // Estimate tokens
        const inputText = messages.map((m) => m.content).join(' ');
        inputTokens = Math.ceil(inputText.length / 4);
        outputTokens = Math.ceil(content.length / 4);
        break;
      } catch (err) {
        if (modelId === APPLY_MODELS[APPLY_MODELS.length - 1]) {
          throw err;
        }
        continue;
      }
    }

    if (!mergedCode) {
      return Response.json({ error: 'All apply models failed' }, { status: 502 });
    }

    // --- Layer 3: Verification ---
    const verification = verifyMergedCode(currentCode, aiResponse, mergedCode);

    // Calculate cost and track it (even for failed verifications — model still ran)
    let cost = 0;
    try {
      cost = calculateCost(usedModel, inputTokens, outputTokens);
    } catch {
      cost = Math.ceil((inputTokens + outputTokens) * 0.01 / 1_000_000 * 10000);
    }

    await db
      .update(attempts)
      .set({
        totalCost: sql`${attempts.totalCost} + ${cost}`,
        inputTokens: sql`${attempts.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${attempts.outputTokens} + ${outputTokens}`,
      })
      .where(eq(attempts.id, attemptId));

    await db.insert(aiCalls).values({
      id: crypto.randomUUID(),
      attemptId,
      model: usedModel,
      inputTokens,
      outputTokens,
      cost,
    });

    // If verification failed, send alert email and return failure to client
    if (!verification.verified) {
      // Fire-and-forget: log error + send email
      logError(db, context.env, {
        endpoint: '/api/ai/apply',
        method: 'POST',
        userId: user.id,
        errorMessage: `Apply model verification FAILED: ${verification.errors.join('; ')}`,
        level: 'fatal',
        metadata: {
          challengeId: challengeId || attempt.challengeId,
          challengeTitle: challengeTitle || 'unknown',
          attemptId,
          model: usedModel,
          language,
          verificationErrors: verification.errors,
          originalCodeLength: currentCode.length,
          mergedCodeLength: mergedCode.length,
          aiResponseSnippet: aiResponse.substring(0, 2000),
          mergedCodeSnippet: mergedCode.substring(0, 2000),
        },
      }).catch(() => { /* never block response */ });

      return Response.json({
        mergedCode: null,
        verified: false,
        verificationErrors: verification.errors,
        model: usedModel,
        inputTokens,
        outputTokens,
        cost,
      });
    }

    return Response.json({
      mergedCode,
      verified: true,
      verificationErrors: [],
      model: usedModel,
      inputTokens,
      outputTokens,
      cost,
    });
  } catch (error) {
    console.error('Apply model error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
