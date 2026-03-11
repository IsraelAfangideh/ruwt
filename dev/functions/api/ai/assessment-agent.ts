/**
 * POST /api/ai/assessment-agent
 * AI agent for building assessments using Cloudflare Workers AI native function calling.
 * Makes non-streaming calls with tools, executes tool calls in a loop (max 3 iterations),
 * then emits results via SSE.
 */
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../_shared/db';
import { getUser } from '../../_shared/auth';
import { getUserOrg } from '../../_shared/org';
import { getToolCapableFallbackChain } from '../../_shared/ai-pricing';
import { buildAssessmentAgentPrompt, getAssessmentAgentTools } from '../../_shared/assessment-agent/system-prompt';
import { executeToolCall, type ToolCall } from '../../_shared/assessment-agent/tool-executor';
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
  assessmentId: z.string().nullish(),
  conversationId: z.string().nullish(),
});

// Primary model for the agent — must support native function calling.
// GPT-OSS 120B has the most reliable tool use; Mistral Small 3.1 as fallback.
const AGENT_MODEL = '@cf/openai/gpt-oss-120b';
const MAX_TOOL_ITERATIONS = 8;
const AI_CALL_TIMEOUT_MS = 30_000; // 30s timeout per individual AI call
const MAX_CONVERSATION_MESSAGES = 20; // Keep last N messages to avoid blowing context window

// Tools that require an assessmentId — auto-create draft if needed
const ASSESSMENT_TOOLS = new Set([
  'select_challenges', 'remove_challenges', 'set_weights',
  'set_time_limit', 'set_branding', 'set_pass_threshold',
]);

interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

/**
 * Call Cloudflare AI (non-streaming) with native tools support.
 * Returns the response text and any tool_calls.
 */
async function callWithTools(
  env: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  modelId: string,
  messages: AIMessage[],
  tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
): Promise<{
  response: string;
  toolCalls: ToolCall[];
  model: string;
}> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('Cloudflare AI credentials not configured');

  // Build fallback chain: primary model, then tool-capable fallbacks
  const fallbacks = getToolCapableFallbackChain('reasoning');
  const models = [modelId, ...fallbacks.filter((m) => m !== modelId)];

  for (const model of models) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), AI_CALL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            // Cloudflare Workers AI expects OpenAI-compatible tool format
            tools: tools.map((t) => ({
              type: 'function' as const,
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
            max_tokens: 4096,
            temperature: 0.7,
          }),
          signal: timeoutController.signal,
        }
      );
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      // Timeout or network error — try next model
      if (model !== models[models.length - 1]) continue;
      throw new Error(`AI call failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      const isUnavailable =
        res.status === 404 || res.status === 400 ||
        err.toLowerCase().includes('not found');
      if (isUnavailable && model !== models[models.length - 1]) continue;
      throw new Error(`Cloudflare AI error: ${res.status} - ${err}`);
    }

    const json = await res.json() as Record<string, unknown>;
    const result = json.result as Record<string, unknown> | undefined;
    if (!result) {
      if (model !== models[models.length - 1]) continue;
      throw new Error('Empty result from model');
    }

    // Extract response text
    // Handle string, number, and boolean tokens (Cloudflare API can return non-string values)
    let response = '';
    if (typeof result.response === 'string') {
      response = result.response;
    } else if (typeof result.response === 'number' || typeof result.response === 'boolean') {
      response = String(result.response);
    } else if (Array.isArray(result.choices) && result.choices.length > 0) {
      const msg = (result.choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
      const rawContent = msg?.content;
      response = typeof rawContent === 'string' ? rawContent
        : (typeof rawContent === 'number' || typeof rawContent === 'boolean') ? String(rawContent)
        : '';
    }

    // Extract tool_calls (Cloudflare native format)
    const toolCalls: ToolCall[] = [];
    const rawToolCalls = result.tool_calls as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(rawToolCalls)) {
      for (const tc of rawToolCalls) {
        const name = typeof tc.name === 'string' ? tc.name : '';
        let args: Record<string, unknown> = {};
        if (typeof tc.arguments === 'string') {
          try { args = JSON.parse(tc.arguments); } catch {}
        } else if (typeof tc.arguments === 'object' && tc.arguments !== null) {
          args = tc.arguments as Record<string, unknown>;
        }
        if (name) toolCalls.push({ name, arguments: args });
      }
    }

    // Fallback: if no native tool_calls but response text contains JSON tool calls,
    // extract them. Cloudflare Workers AI sometimes fails to use the native format.
    if (toolCalls.length === 0 && response) {
      const extracted = extractToolCallsFromText(response);
      if (extracted.length > 0) {
        return { response: '', toolCalls: extracted, model };
      }
    }

    return { response, toolCalls, model };
  }

  /* istanbul ignore next -- @preserve */
  throw new Error('All models failed');
}

/**
 * Normalize model-generated tool names to our actual tool names.
 * Models sometimes drop underscores or use slight variations.
 */
const TOOL_NAME_MAP: Record<string, string> = {
  searchchallenges: 'search_challenges',
  search_challenge: 'search_challenges',
  selectchallenges: 'select_challenges',
  select_challenge: 'select_challenges',
  addchallenges: 'select_challenges',
  add_challenges: 'select_challenges',
  removechallenges: 'remove_challenges',
  remove_challenge: 'remove_challenges',
  setweights: 'set_weights',
  set_weight: 'set_weights',
  settimelimit: 'set_time_limit',
  settimeLimit: 'set_time_limit',
  setbranding: 'set_branding',
  setpassthreshold: 'set_pass_threshold',
  set_pass_thresholds: 'set_pass_threshold',
  createcustomchallenge: 'create_custom_challenge',
  create_challenge: 'create_custom_challenge',
};

function normalizeToolName(name: string): string {
  const lower = name.toLowerCase().trim();
  return TOOL_NAME_MAP[lower] || lower;
}

/**
 * Fallback parser: extract tool calls from text when the model fails to use
 * native function calling format. Handles JSON objects with "name" + "parameters"/"arguments".
 */
function extractToolCallsFromText(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  // Match JSON objects that look like tool calls: {"name": "...", "parameters": {...}}
  const jsonPattern = /\{[^{}]*"name"\s*:\s*"[^"]+"\s*,\s*"(?:parameters|arguments)"\s*:\s*\{[^{}]*\}[^{}]*\}/g;
  const matches = text.match(jsonPattern);
  if (!matches) return calls;

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);
      const rawName = typeof parsed.name === 'string' ? parsed.name : '';
      const name = normalizeToolName(rawName);
      const args = parsed.parameters || parsed.arguments || {};
      if (name && typeof args === 'object') {
        calls.push({ name, arguments: args });
      }
    } catch {
      // Malformed JSON — skip
    }
  }
  return calls;
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

    const { messages, conversationId } = parsed.data;
    let assessmentId = parsed.data.assessmentId;
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

    // Load assessment state if editing (verify ownership)
    let assessmentState = null;
    if (assessmentId) {
      const [assessment] = await db
        .select()
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);
      if (assessment && assessment.createdBy !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
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

    // Build system prompt and tools
    const systemPrompt = buildAssessmentAgentPrompt({
      challengeCatalog: catalog,
      currentAssessment: assessmentState,
      orgCustomChallenges: orgCustom,
    });
    const tools = getAssessmentAgentTools();

    // Build messages for the model (truncate to prevent blowing context window)
    const truncated = messages.length > MAX_CONVERSATION_MESSAGES
      ? messages.slice(-MAX_CONVERSATION_MESSAGES)
      : messages;
    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...truncated.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit thinking event so client shows spinner
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'thinking' })}\n\n`)
          );

          let fullContent = '';
          let totalToolCalls = 0;
          let usedModel = AGENT_MODEL;
          const workingMessages = [...aiMessages];
          const toolCallLog: Array<{ tool: string; params: Record<string, unknown>; result: unknown }> = [];

          // Tool call loop (max iterations to prevent runaway)
          for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const result = await callWithTools(context.env, AGENT_MODEL, workingMessages, tools);
            usedModel = result.model;

            // If there are tool calls, execute them
            if (result.toolCalls.length > 0) {
              // Emit any text the model produced before tool calls
              if (result.response) {
                fullContent += result.response;
                emitChunked(controller, encoder, result.response);
              }

              // Add assistant message with tool calls to conversation
              workingMessages.push({
                role: 'assistant',
                content: result.response || '',
              });

              // Execute each tool call
              for (const call of result.toolCalls) {
                totalToolCalls++;

                // Auto-create draft assessment when a tool needs one
                if (!assessmentId && ASSESSMENT_TOOLS.has(call.name)) {
                  const newId = crypto.randomUUID();
                  const inferredTitle = typeof call.arguments.title === 'string'
                    ? call.arguments.title : 'Untitled Assessment';
                  await db.insert(assessments).values({
                    id: newId,
                    orgId: orgId || null,
                    createdBy: user.id,
                    title: inferredTitle,
                    timeLimit: 3600,
                    status: 'draft',
                  });
                  assessmentId = newId;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'assessment_created', assessmentId: newId })}\n\n`)
                  );
                }

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: call.name, params: call.arguments })}\n\n`)
                );

                const toolResult = await executeToolCall(db, context.env as any, call, {
                  assessmentId,
                  orgId,
                  userId: user.id,
                });

                toolCallLog.push({ tool: call.name, params: call.arguments, result: toolResult });
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', ...toolResult })}\n\n`)
                );

                // Add tool result to conversation for next iteration
                workingMessages.push({
                  role: 'tool',
                  content: JSON.stringify(toolResult),
                  tool_call_id: call.name,
                });
              }

              // Continue loop — model will see tool results and may call more tools
              continue;
            }

            // No tool calls — this is the final response
            fullContent += result.response;
            emitChunked(controller, encoder, result.response);
            break;
          }

          // If the loop exhausted iterations without a text-only response, make one
          // final call without tools to get a summary for the user.
          if (!fullContent.trim() && totalToolCalls > 0) {
            try {
              const finalResult = await callWithTools(context.env, AGENT_MODEL, workingMessages, []);
              usedModel = finalResult.model;
              fullContent += finalResult.response;
              emitChunked(controller, encoder, finalResult.response);
            } catch {
              // Best-effort — if it fails, at least tool results are visible
            }
          }

          // Save conversation (include tool calls so resumed conversations have context)
          const convId = conversationId || crypto.randomUUID();
          const assistantMsg: Record<string, unknown> = { role: 'assistant', content: fullContent };
          if (toolCallLog.length > 0) {
            assistantMsg.toolCalls = toolCallLog;
          }
          const allMessages = [
            ...messages,
            assistantMsg,
          ];

          if (conversationId) {
            await db
              .update(agentConversations)
              .set({
                messages: JSON.stringify(allMessages),
                updatedAt: new Date().toISOString(),
              })
              .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, user.id)));
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
              model: usedModel,
              conversationId: convId,
              toolCallCount: totalToolCalls,
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

/** DELETE /api/ai/assessment-agent?conversationId=... — clean up a conversation */
export async function onRequestDelete(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(context.request.url);
    const convId = url.searchParams.get('conversationId');
    if (!convId) {
      return Response.json({ error: 'Missing conversationId' }, { status: 400 });
    }
    const db = getDb(context.env);
    await db
      .delete(agentConversations)
      .where(and(eq(agentConversations.id, convId), eq(agentConversations.userId, user.id)));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Emit text in small chunks via SSE for a progressive UX.
 * Since we're making non-streaming API calls, the text arrives all at once,
 * but we emit it in chunks so the chat UI shows progressive text appearance.
 */
function emitChunked(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  text: string,
  chunkSize = 20
): void {
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
    );
  }
}
