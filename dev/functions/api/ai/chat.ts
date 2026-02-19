/**
 * POST /api/ai/chat
 * Unified streaming AI chat. Supports three model sources:
 * - Cloudflare Workers AI (free for practice)
 * - Platform-hosted commercial models (credits always deducted, 2x markup)
 * - BYOK models (user's own API keys, SSE streaming)
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { validateConstraints, checkPreCallConstraints } from '../../_shared/constraints';
import {
  getModelPricing, calculateCost, calculateActualCost, countMessageTokens,
  isHostedModel, isBYOKModel, getHostedProvider, getActualModelId,
} from '../../_shared/ai-pricing';
import type { BYOKProvider } from '../../_shared/ai-pricing';
import { streamCloudflareAIWithFallback } from '../../_shared/ai-stream';
import { streamHostedModel } from '../../_shared/hosted-stream';
import { checkPlatformDailyLimit, cleanupOldPlatformUsage } from '../../_shared/platform-limits';
import { profiles, attempts, aiCalls, attemptMessages, apiKeys } from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  attemptId: z.string().uuid().nullable().optional(),
  userMessage: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

// --- BYOK key decryption (shared with chat-byok.ts) ---

async function deriveAESKey(encryptionKey: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const hash = await crypto.subtle.digest('SHA-256', keyBytes);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptKey(encrypted: string, encryptionKey: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertextWithTag = combined.slice(12);
  const aesKey = await deriveAESKey(encryptionKey);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertextWithTag);
  return new TextDecoder().decode(plaintext);
}

function getPlatformApiKey(env: Env, provider: BYOKProvider | null): string | null {
  switch (provider) {
    case 'openai': return env.OPENAI_API_KEY || null;
    case 'anthropic': return env.ANTHROPIC_API_KEY || null;
    case 'google': return env.GOOGLE_AI_API_KEY || null;
    default: return null;
  }
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

    const { model, messages, attemptId, userMessage, maxTokens, temperature } = parsed.data;

    const pricing = getModelPricing(model);
    if (!pricing) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
    }

    // Determine model source
    const isHosted = isHostedModel(model);
    const isByok = isBYOKModel(model);
    const isCloudflare = pricing.source === 'cloudflare';

    if (!isCloudflare && !isHosted && !isByok) {
      return Response.json({ error: 'Unrecognized model source' }, { status: 400 });
    }

    const estimatedInputTokens = countMessageTokens(messages);
    const estimatedOutputTokens = Math.min(
      Math.ceil(estimatedInputTokens * 1.5),
      maxTokens || 4096
    );
    const estimatedCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

    const db = getDb(context.env);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if this is an assessment attempt (B2B — credit-gated)
    let isAssessmentAttempt = false;
    if (attemptId) {
      const [attempt] = await db
        .select({ assessmentSessionId: attempts.assessmentSessionId })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
        .limit(1);
      isAssessmentAttempt = !!attempt?.assessmentSessionId;
    }

    // Credit check: hosted models ALWAYS cost credits; Cloudflare only for assessments
    const requiresCredits = isHosted || isAssessmentAttempt;
    if (requiresCredits && profile.credits < estimatedCost) {
      return Response.json(
        {
          error: 'Insufficient credits',
          required: estimatedCost,
          available: profile.credits,
        },
        { status: 402 }
      );
    }

    // Daily platform limit for hosted models
    if (isHosted) {
      const limitCheck = await checkPlatformDailyLimit(db.all ? (context.env.DB) : context.env.DB, user.id);
      if (!limitCheck.allowed) {
        return Response.json(
          {
            error: 'Daily hosted model limit reached',
            message: limitCheck.message,
            resetsAt: limitCheck.resetsAt,
          },
          { status: 429 }
        );
      }
    }

    // BYOK: decrypt user's API key
    let byokApiKey: string | null = null;
    if (isByok) {
      const allUserKeys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, user.id));
      const provider = pricing.provider;
      const providerKey = allUserKeys.find((k) => k.provider === provider);
      if (!providerKey) {
        return Response.json(
          { error: `No ${provider} API key configured. Add one in Settings > API Keys.` },
          { status: 400 }
        );
      }
      if (!context.env.ENCRYPTION_KEY) {
        return Response.json({ error: 'Server encryption not configured' }, { status: 500 });
      }
      byokApiKey = await decryptKey(providerKey.encryptedKey, context.env.ENCRYPTION_KEY);
    }

    // Hosted: get platform API key
    let hostedApiKey: string | null = null;
    if (isHosted) {
      const provider = getHostedProvider(model);
      hostedApiKey = getPlatformApiKey(context.env, provider);
      if (!hostedApiKey) {
        return Response.json(
          { error: 'Platform API key not configured for this provider' },
          { status: 503 }
        );
      }
    }

    // Pre-call constraint check
    if (attemptId) {
      const constraintCheck = await checkPreCallConstraints(
        db, attemptId, estimatedInputTokens, estimatedOutputTokens, estimatedCost
      );
      if (!constraintCheck.valid) {
        return Response.json(
          {
            error: 'Constraint violation',
            violation: constraintCheck.violation,
            message: constraintCheck.message,
          },
          { status: 403 }
        );
      }
    }

    // --- SSE Streaming (shared across all three paths) ---
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Store user message for replay
          let nextSequence = 0;
          if (attemptId && userMessage) {
            const seqResult = await db
              .select({ maxSeq: sql<number>`COALESCE(MAX(${attemptMessages.sequence}), -1)` })
              .from(attemptMessages)
              .where(eq(attemptMessages.attemptId, attemptId));
            nextSequence = (seqResult[0]?.maxSeq ?? -1) + 1;

            await db.insert(attemptMessages).values({
              id: crypto.randomUUID(),
              attemptId,
              role: 'user',
              content: userMessage,
              sequence: nextSequence,
            });
            nextSequence++;
          }

          // Create the appropriate streaming generator
          let gen: AsyncGenerator<string, { inputTokens: number; outputTokens: number; model: string }>;

          if (isCloudflare) {
            gen = streamCloudflareAIWithFallback(
              context.env, model, messages, { maxTokens, temperature }
            );
          } else if (isHosted) {
            const provider = getHostedProvider(model)!;
            const actualModelId = getActualModelId(model);
            gen = streamHostedModel(
              { provider, apiKey: hostedApiKey! },
              actualModelId, messages, { maxTokens, temperature }
            );
          } else {
            // BYOK — stream with user's key
            const provider = pricing.provider as 'openai' | 'anthropic' | 'google';
            gen = streamHostedModel(
              { provider, apiKey: byokApiKey! },
              model, messages, { maxTokens, temperature }
            );
          }

          // Stream chunks
          let result: { inputTokens: number; outputTokens: number; model: string } | null = null;
          let fullContent = '';
          while (true) {
            const { value, done } = await gen.next();
            if (done) {
              result = value as { inputTokens: number; outputTokens: number; model: string };
              break;
            }
            fullContent += value;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'chunk', content: value })}\n\n`
              )
            );
          }

          if (!result) throw new Error('No result from stream');

          // For hosted/BYOK, the model in result is the actual API model ID.
          // For cost calculation, use the original model ID (which has correct pricing).
          const costModel = isHosted || isByok ? model : result.model;
          const actualCost = calculateCost(costModel, result.inputTokens, result.outputTokens);

          // Credit deduction: hosted always, Cloudflare only for assessments
          if (isHosted || isAssessmentAttempt) {
            await db
              .update(profiles)
              .set({ credits: sql`${profiles.credits} - ${actualCost}` })
              .where(eq(profiles.id, user.id));
          }

          // Platform usage tracking for hosted models
          if (isHosted) {
            const platformActualCost = calculateActualCost(model, result.inputTokens, result.outputTokens);
            const provider = getHostedProvider(model);
            const actualModelId = getActualModelId(model);
            await context.env.DB.prepare(
              'INSERT INTO platform_usage (id, user_id, provider, model, input_tokens, output_tokens, user_cost, actual_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
            ).bind(
              crypto.randomUUID(),
              user.id,
              provider,
              actualModelId,
              result.inputTokens,
              result.outputTokens,
              actualCost,
              platformActualCost,
            ).run();

            cleanupOldPlatformUsage(context.env.DB);
          }

          // Track cost on attempt
          if (attemptId) {
            const updateFields: Record<string, unknown> = {
              totalCost: sql`${attempts.totalCost} + ${actualCost}`,
              inputTokens: sql`${attempts.inputTokens} + ${result.inputTokens}`,
              outputTokens: sql`${attempts.outputTokens} + ${result.outputTokens}`,
            };
            if (isByok) updateFields.usedByok = 1;
            if (isHosted) updateFields.usedHosted = 1;

            await db
              .update(attempts)
              .set(updateFields)
              .where(eq(attempts.id, attemptId));

            await db.insert(aiCalls).values({
              id: crypto.randomUUID(),
              attemptId,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              cost: actualCost,
            });

            // Store assistant message for replay
            if (userMessage) {
              await db.insert(attemptMessages).values({
                id: crypto.randomUUID(),
                attemptId,
                role: 'assistant',
                content: fullContent,
                model: result.model,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                cost: actualCost,
                sequence: nextSequence,
              });
            }

            const postCheck = await validateConstraints(db, attemptId);
            if (!postCheck.valid) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'constraint_warning',
                    violation: postCheck.violation,
                    message: postCheck.message,
                  })}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                cost: actualCost,
                model: result.model,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          console.error('AI chat stream error:', err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: err instanceof Error ? err.message : 'Unknown error',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
