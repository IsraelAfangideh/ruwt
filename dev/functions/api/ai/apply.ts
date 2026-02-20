/**
 * POST /api/ai/apply
 * Non-streaming apply model endpoint.
 * When structured edit parsing fails, calls a cheap model to merge
 * the AI's intended changes into the current code.
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { calculateCost } from '../../_shared/ai-pricing';
import { attempts, aiCalls } from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  attemptId: z.string().uuid(),
  currentCode: z.string(),
  aiResponse: z.string(),
  language: z.string(),
});

const APPLY_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.2',
  '@cf/meta/llama-3.2-1b-instruct',
];

const SYSTEM_PROMPT = `You are a code merge tool. Your ONLY job is to output the complete, merged file.
You will receive the current file and an AI response containing code edits.
Apply the intended changes to the current file.
Output ONLY the raw file content. No markdown. No backticks. No explanation. No commentary.`;

/** Strip accidental markdown fences from model output. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  // Match ```lang\n...\n``` or ```\n...\n```
  const fenceMatch = trimmed.match(/^```\w*\n([\s\S]*?)\n```$/);
  if (fenceMatch) return fenceMatch[1];
  // Match leading ``` without closing
  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    lines.shift(); // remove opening fence
    if (lines[lines.length - 1]?.trim() === '```') lines.pop();
    return lines.join('\n');
  }
  return trimmed;
}

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

    const { attemptId, currentCode, aiResponse, language } = parsed.data;
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
        content: `## Current file (${language})\n\`\`\`${language}\n${currentCode}\n\`\`\`\n\n## AI response with edits\n${aiResponse}\n\nOutput the complete merged file:`,
      },
    ];

    // Try models in order
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
              max_tokens: 4096,
              temperature: 0.0,
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
          // Too short — likely garbage, try next model
          if (modelId !== APPLY_MODELS[APPLY_MODELS.length - 1]) continue;
          return Response.json({ error: 'Apply model returned empty result' }, { status: 502 });
        }

        mergedCode = stripFences(content);
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
        // Try next model
        continue;
      }
    }

    if (!mergedCode) {
      return Response.json({ error: 'All apply models failed' }, { status: 502 });
    }

    // Calculate cost and track it
    let cost = 0;
    try {
      cost = calculateCost(usedModel, inputTokens, outputTokens);
    } catch {
      // Model not in pricing table — estimate at budget rate
      cost = Math.ceil((inputTokens + outputTokens) * 0.01 / 1_000_000 * 10000);
    }

    const db = getDb(context.env);
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

    return Response.json({
      mergedCode,
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
