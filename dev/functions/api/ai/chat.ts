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
import { streamCloudflareAIWithFallback } from '../../_shared/ai-stream';
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

    const { model, messages, attemptId, userMessage, maxTokens, temperature } = parsed.data;

    const pricing = getModelPricing(model);
    if (!pricing) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
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
              sequence: nextSequence,
            });
            nextSequence++;
          }

          const gen = streamCloudflareAIWithFallback(
            context.env, model, messages, { maxTokens, temperature }
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

          // Credit deduction only for assessment attempts
          if (isAssessmentAttempt) {
            await db
              .update(profiles)
              .set({ credits: sql`${profiles.credits} - ${actualCost}` })
              .where(eq(profiles.id, user.id));
          }

          // Track cost on attempt
          if (attemptId) {
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
