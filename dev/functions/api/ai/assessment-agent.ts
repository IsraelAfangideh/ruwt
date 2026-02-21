/**
 * POST /api/ai/assessment-agent
 * Streaming AI agent for building assessments.
 * Uses Cloudflare Workers AI with tool-call parsing.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { getUserOrg } from '../../_shared/org';
import { streamCloudflareAIWithFallback } from '../../_shared/ai-stream';
import { buildAssessmentAgentPrompt } from '../../_shared/assessment-agent/system-prompt';
import { parseToolCalls, executeToolCall } from '../../_shared/assessment-agent/tool-executor';
import {
  challenges, assessments, assessmentChallenges, customChallenges,
  agentConversations,
} from '../../../drizzle/schema.d1';

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  assessmentId: z.string().optional(),
  conversationId: z.string().optional(),
});

// Use a capable instruction-following model for the agent
const AGENT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

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

    const { messages, assessmentId, conversationId } = parsed.data;
    const db = getDb(context.env);

    // Load challenge catalog
    const catalog = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        difficulty: challenges.difficulty,
        category: challenges.category,
        skillTested: challenges.skillTested,
        language: challenges.language,
        tags: challenges.tags,
      })
      .from(challenges);

    // Load assessment state if editing
    let assessmentState = null;
    if (assessmentId) {
      const [assessment] = await db
        .select()
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);
      if (assessment) {
        const asmtChallenges = await db
          .select({ challengeId: assessmentChallenges.challengeId })
          .from(assessmentChallenges)
          .where(eq(assessmentChallenges.assessmentId, assessmentId));

        let weights = { modelSelection: 20, promptEfficiency: 20, debugging: 20, strategy: 20, speed: 20 };
        try {
          if (assessment.categoryWeights) weights = JSON.parse(assessment.categoryWeights);
        } catch {}

        assessmentState = {
          title: assessment.title,
          description: assessment.description,
          timeLimit: assessment.timeLimit,
          selectedChallengeIds: asmtChallenges.map((c) => c.challengeId),
          weights,
          companyName: assessment.companyName,
          welcomeMessage: assessment.welcomeMessage,
        };
      }
    }

    // Load org custom challenges
    const orgResult = await getUserOrg(db, user.id);
    const orgId = orgResult?.org.id;
    let orgCustom: { id: string; title: string; difficulty: string; category: string; status: string }[] = [];
    if (orgId) {
      orgCustom = await db
        .select({
          id: customChallenges.id,
          title: customChallenges.title,
          difficulty: customChallenges.difficulty,
          category: customChallenges.category,
          status: customChallenges.status,
        })
        .from(customChallenges)
        .where(eq(customChallenges.orgId, orgId));
    }

    // Build system prompt
    const systemPrompt = buildAssessmentAgentPrompt({
      challengeCatalog: catalog,
      currentAssessment: assessmentState,
      orgCustomChallenges: orgCustom,
    });

    // Build messages for the model
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const gen = streamCloudflareAIWithFallback(
            context.env, AGENT_MODEL, aiMessages,
            { maxTokens: 4096, temperature: 0.7 }
          );

          let fullContent = '';
          while (true) {
            const { value, done } = await gen.next();
            if (done) break;

            if (value.phase === 'thinking') {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: value.text })}\n\n`)
              );
            } else {
              fullContent += value.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: value.text })}\n\n`)
              );
            }
          }

          // Parse and execute tool calls
          const toolCalls = parseToolCalls(fullContent);
          for (const call of toolCalls) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: call.tool, params: call.params })}\n\n`)
            );

            const result = await executeToolCall(db, context.env as any, call, {
              assessmentId,
              orgId,
              userId: user.id,
            });

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', ...result })}\n\n`)
            );
          }

          // Save conversation
          const convId = conversationId || crypto.randomUUID();
          const allMessages = [
            ...messages,
            { role: 'assistant' as const, content: fullContent },
          ];

          if (conversationId) {
            await db
              .update(agentConversations)
              .set({
                messages: JSON.stringify(allMessages),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(agentConversations.id, conversationId));
          } else {
            await db.insert(agentConversations).values({
              id: convId,
              assessmentId: assessmentId || null,
              orgId: orgId || null,
              userId: user.id,
              messages: JSON.stringify(allMessages),
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              model: AGENT_MODEL,
              conversationId: convId,
              toolCallCount: toolCalls.length,
            })}\n\n`)
          );
          controller.close();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error('Assessment agent error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
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
    console.error('Assessment agent error:', error);
    return Response.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
