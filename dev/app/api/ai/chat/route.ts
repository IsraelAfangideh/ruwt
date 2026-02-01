import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, profiles, attempts, aiCalls } from '@/drizzle';
import { eq, sql } from 'drizzle-orm';
import { streamAI, getProvider } from '@/lib/ai/proxy';
import { getModelPricing, calculateCost } from '@/lib/ai/pricing';
import { countMessageTokens } from '@/lib/ai/tokens';
import { validateConstraints, checkPreCallConstraints } from '@/lib/ai/constraints.server';
import { z } from 'zod';

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  attemptId: z.string().uuid().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { model, messages, attemptId, maxTokens, temperature } = parsed.data;

    // Validate model
    const pricing = getModelPricing(model);
    if (!pricing) {
      return NextResponse.json({ error: 'Unknown model' }, { status: 400 });
    }

    // Estimate cost for pre-flight check
    const estimatedInputTokens = countMessageTokens(messages);
    const estimatedOutputTokens = Math.min(estimatedInputTokens * 1.5, maxTokens || 4096);
    const estimatedCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

    // Get user's profile and check credits
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.credits < estimatedCost) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: estimatedCost,
        available: profile.credits,
      }, { status: 402 });
    }

    // Check attempt constraints if attemptId provided
    if (attemptId) {
      const constraintCheck = await checkPreCallConstraints(
        attemptId,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost
      );

      if (!constraintCheck.valid) {
        return NextResponse.json({
          error: 'Constraint violation',
          violation: constraintCheck.violation,
          message: constraintCheck.message,
        }, { status: 403 });
      }
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = streamAI({
            model,
            messages,
            maxTokens,
            temperature,
          });

          let finalResult;

          while (true) {
            const { value, done } = await generator.next();
            
            if (done) {
              finalResult = value;
              break;
            }

            // Send chunk to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: value })}\n\n`));
          }

          // Deduct credits
          const actualCost = finalResult.cost;
          await db
            .update(profiles)
            .set({
              credits: sql`${profiles.credits} - ${actualCost}`,
            })
            .where(eq(profiles.id, user.id));

          // Update attempt if provided
          if (attemptId) {
            await db
              .update(attempts)
              .set({
                totalCost: sql`${attempts.totalCost} + ${actualCost}`,
                inputTokens: sql`${attempts.inputTokens} + ${finalResult.inputTokens}`,
                outputTokens: sql`${attempts.outputTokens} + ${finalResult.outputTokens}`,
              })
              .where(eq(attempts.id, attemptId));

            // Log the AI call
            await db.insert(aiCalls).values({
              attemptId,
              model,
              inputTokens: finalResult.inputTokens,
              outputTokens: finalResult.outputTokens,
              cost: actualCost,
            });

            // Check if constraints are now violated
            const postCheck = await validateConstraints(attemptId);
            if (!postCheck.valid) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'constraint_warning',
                violation: postCheck.violation,
                message: postCheck.message,
              })}\n\n`));
            }
          }

          // Send final stats
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            inputTokens: finalResult.inputTokens,
            outputTokens: finalResult.outputTokens,
            cost: actualCost,
            model,
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error('AI proxy error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
