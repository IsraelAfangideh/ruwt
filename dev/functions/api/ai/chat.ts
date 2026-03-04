/**
 * POST /api/ai/chat
 * Streaming AI chat via Cloudflare Workers AI.
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { validateConstraints, checkPreCallConstraints } from '../../_shared/constraints';
import { getModelPricing, calculateCost, countMessageTokens } from '../../_shared/ai-pricing';
import { streamCloudflareAIWithFallback, ModelUnavailableError } from '../../_shared/ai-stream';
import { logError } from '../../_shared/error-monitor';
import { profiles, attempts, aiCalls, attemptMessages } from '../../../drizzle/schema.d1';

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
  codeSnapshot: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

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

    const { model, messages, attemptId, userMessage, codeSnapshot, maxTokens, temperature } = parsed.data;

    const pricing = getModelPricing(model);
    if (!pricing) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
    }

    const estimatedInputTokens = countMessageTokens(messages);
    const estimatedOutputTokens = Math.min(maxTokens || 1024, 1024);
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

    // Verify attempt ownership and check if assessment
    let isAssessmentAttempt = false;
    if (attemptId) {
      const [attempt] = await db
        .select({ userId: attempts.userId, assessmentSessionId: attempts.assessmentSessionId })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
        .limit(1);
      if (!attempt) {
        return Response.json({ error: 'Attempt not found' }, { status: 404 });
      }
      if (attempt.userId !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      isAssessmentAttempt = !!attempt.assessmentSessionId;
    }

    // Credit check only for assessment attempts (practice is free)
    if (isAssessmentAttempt && profile.credits < estimatedCost) {
      return Response.json(
        {
          error: 'Insufficient credits',
          required: estimatedCost,
          available: profile.credits,
        },
        { status: 402 }
      );
    }

    // Pre-call constraint check
    if (attemptId) {
      const constraintCheck = await checkPreCallConstraints(
        db, attemptId, estimatedCost
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

    // --- SSE Streaming ---
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
              codeSnapshot: codeSnapshot || null,
              sequence: nextSequence,
            });
            nextSequence++;
          }

          const gen = streamCloudflareAIWithFallback(
            context.env, model, messages, { maxTokens, temperature },
            undefined, // fallbackChain
            false      // allowFallback — user selected this model
          );

          // Stream chunks — separate thinking (reasoning) from content (answer)
          let result: { inputTokens: number; outputTokens: number; model: string } | null = null;
          let fullContent = '';
          let fullReasoning = '';
          let wasThinking = false;
          while (true) {
            const { value, done } = await gen.next();
            if (done) {
              result = value as { inputTokens: number; outputTokens: number; model: string };
              // Emit thinking_done if the stream ended while still in thinking phase
              if (wasThinking) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'thinking_done' })}\n\n`)
                );
              }
              break;
            }
            // value is StreamChunk { text, phase }
            if (value.phase === 'thinking') {
              wasThinking = true;
              fullReasoning += value.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'thinking', content: value.text })}\n\n`
                )
              );
            } else {
              // Emit thinking_done on transition from thinking to content
              if (wasThinking) {
                wasThinking = false;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'thinking_done' })}\n\n`)
                );
              }
              fullContent += value.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', content: value.text })}\n\n`
                )
              );
            }
          }

          if (!result) throw new Error('No result from stream');

          const actualCost = calculateCost(result.model, result.inputTokens, result.outputTokens);

          // Track cost + deduct credits. Credit deduction first so if it fails,
          // we don't record phantom costs. MAX(0,...) prevents negative balances.
          if (attemptId) {
            if (isAssessmentAttempt) {
              await db
                .update(profiles)
                .set({ credits: sql`MAX(0, ${profiles.credits} - ${actualCost})` })
                .where(eq(profiles.id, user.id));
            }

            await db
              .update(attempts)
              .set({
                totalCost: sql`${attempts.totalCost} + ${actualCost}`,
                inputTokens: sql`${attempts.inputTokens} + ${result.inputTokens}`,
                outputTokens: sql`${attempts.outputTokens} + ${result.outputTokens}`,
              })
              .where(eq(attempts.id, attemptId));

            await db.insert(aiCalls).values({
              id: crypto.randomUUID(),
              attemptId,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              cost: actualCost,
            });

            // Store assistant message for replay (answer only; reasoning is internal)
            if (userMessage) {
              await db.insert(attemptMessages).values({
                id: crypto.randomUUID(),
                attemptId,
                role: 'assistant',
                content: fullContent || fullReasoning,
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
          // Model unavailable — tell user to pick another model (no error logging)
          if (err instanceof ModelUnavailableError) {
            const pricing = getModelPricing(err.modelId);
            const displayName = pricing?.displayName || err.modelId;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'model_unavailable',
                  model: err.modelId,
                  displayName,
                  message: `${displayName} is currently unavailable \u2014 pick another model`,
                })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const error = err instanceof Error ? err : new Error(String(err));
          console.error('AI chat stream error:', error);

          // Log to error monitoring (fire-and-forget)
          logError(context.env.DB, context.env, {
            endpoint: '/api/ai/chat',
            method: 'POST',
            userId: user.id,
            errorMessage: error.message,
            errorStack: error.stack,
            level: 'error',
            metadata: { model, attemptId, isAssessmentAttempt, messageCount: messages.length },
          }).catch(() => {});

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: error.message,
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
