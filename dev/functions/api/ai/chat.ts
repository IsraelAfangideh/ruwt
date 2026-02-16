/**
 * POST /api/ai/chat
 * Streaming AI chat. Supports Cloudflare AI models; auth and credits required.
 */
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { validateConstraints, checkPreCallConstraints } from '../../_shared/constraints';
import { getModelPricing, calculateCost, countMessageTokens } from '../../_shared/ai-pricing';
import { streamCloudflareAIWithFallback } from '../../_shared/ai-stream';
import { profiles, attempts, aiCalls } from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  attemptId: z.string().uuid().nullable().optional(),
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

    const { model, messages, attemptId, maxTokens, temperature } = parsed.data;

    const pricing = getModelPricing(model);
    if (!pricing) {
      return Response.json({ error: 'Unknown model' }, { status: 400 });
    }
    if (pricing.provider !== 'cloudflare') {
      return Response.json(
        {
          error: 'Invalid model. Select a model from the model selector (Budget, Mid, or Premium tier).',
        },
        { status: 400 }
      );
    }

    const estimatedInputTokens = countMessageTokens(messages);
    const estimatedOutputTokens = Math.min(
      Math.ceil(estimatedInputTokens * 1.5),
      maxTokens || 4096
    );
    const estimatedCost = calculateCost(
      model,
      estimatedInputTokens,
      estimatedOutputTokens
    );

    const db = getDb(context.env);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.credits < estimatedCost) {
      return Response.json(
        {
          error: 'Insufficient credits',
          required: estimatedCost,
          available: profile.credits,
        },
        { status: 402 }
      );
    }

    if (attemptId) {
      const constraintCheck = await checkPreCallConstraints(
        db,
        attemptId,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const gen = streamCloudflareAIWithFallback(
            context.env,
            model,
            messages,
            { maxTokens, temperature }
          );

          let result: { inputTokens: number; outputTokens: number; model: string } | null =
            null;
          while (true) {
            const { value, done } = await gen.next();
            if (done) {
              result = value as { inputTokens: number; outputTokens: number; model: string };
              break;
            }
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'chunk', content: value })}\n\n`
              )
            );
          }

          if (!result) throw new Error('No result from stream');

          // Use the actual model that responded (may differ from requested if fallback kicked in)
          const actualModel = result.model;
          const actualCost = calculateCost(
            actualModel,
            result.inputTokens,
            result.outputTokens
          );

          await db
            .update(profiles)
            .set({ credits: sql`${profiles.credits} - ${actualCost}` })
            .where(eq(profiles.id, user.id));

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
              model: actualModel,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              cost: actualCost,
            });

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
                model: actualModel,
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
