/**
 * Parse and execute tool calls from the AI assessment agent's response.
 * Tool calls are embedded as <tool_call> blocks in the response text.
 */
import { eq, and, like, sql } from 'drizzle-orm';
import type { Db } from '../db';
import {
  challenges, assessments, assessmentChallenges, customChallenges,
} from '../../../drizzle/schema.d1';

interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface ToolResult {
  tool: string;
  success: boolean;
  result: unknown;
  error?: string;
}

/** Extract all <tool_call> blocks from the response text. */
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        calls.push({
          tool: parsed.tool,
          params: parsed.params || {},
        });
      }
    } catch {
      // Invalid JSON — skip
    }
  }
  return calls;
}

/** Execute a single tool call and return the result. */
export async function executeToolCall(
  db: Db,
  env: Record<string, unknown>,
  call: ToolCall,
  context: {
    assessmentId?: string;
    orgId?: string;
    userId: string;
  }
): Promise<ToolResult> {
  try {
    switch (call.tool) {
      case 'search_challenges':
        return await searchChallenges(db, call.params);
      case 'select_challenges':
        return await selectChallenges(db, call.params, context);
      case 'remove_challenges':
        return await removeChallenges(db, call.params, context);
      case 'set_weights':
        return await setWeights(db, call.params, context);
      case 'set_time_limit':
        return await setTimeLimit(db, call.params, context);
      case 'set_branding':
        return await setBranding(db, call.params, context);
      case 'create_custom_challenge':
        return await createCustomChallenge(db, call.params, context);
      case 'set_pass_threshold':
        return await setPassThreshold(db, call.params, context);
      default:
        return { tool: call.tool, success: false, result: null, error: `Unknown tool: ${call.tool}` };
    }
  } catch (err) {
    return {
      tool: call.tool,
      success: false,
      result: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function searchChallenges(db: Db, params: Record<string, unknown>): Promise<ToolResult> {
  const { query, category, difficulty, language } = params as {
    query?: string; category?: string; difficulty?: string; language?: string;
  };

  let rows = await db
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

  if (category) {
    rows = rows.filter((r) => r.category === category);
  }
  if (difficulty) {
    rows = rows.filter((r) => r.difficulty === difficulty);
  }
  if (language) {
    rows = rows.filter((r) => r.language === language);
  }
  if (query) {
    const q = query.toLowerCase();
    rows = rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      (r.skillTested || '').toLowerCase().includes(q) ||
      (r.tags || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q)
    );
  }

  return {
    tool: 'search_challenges',
    success: true,
    result: { count: rows.length, challenges: rows.slice(0, 20) },
  };
}

async function selectChallenges(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  const { challengeIds } = params as { challengeIds?: string[] };
  if (!challengeIds?.length) {
    return { tool: 'select_challenges', success: false, result: null, error: 'No challenge IDs provided' };
  }
  if (!context.assessmentId) {
    return { tool: 'select_challenges', success: false, result: null, error: 'No assessment ID in context. Save the assessment first.' };
  }

  // Get existing challenges
  const existing = await db
    .select({ challengeId: assessmentChallenges.challengeId, sortOrder: assessmentChallenges.sortOrder })
    .from(assessmentChallenges)
    .where(eq(assessmentChallenges.assessmentId, context.assessmentId));

  const existingIds = new Set(existing.map((e) => e.challengeId));
  const maxSort = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1);

  let added = 0;
  for (const id of challengeIds) {
    if (existingIds.has(id)) continue;
    await db.insert(assessmentChallenges).values({
      id: crypto.randomUUID(),
      assessmentId: context.assessmentId,
      challengeId: id,
      sortOrder: maxSort + 1 + added,
    });
    added++;
  }

  return {
    tool: 'select_challenges',
    success: true,
    result: { added, total: existing.length + added },
  };
}

async function removeChallenges(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  const { challengeIds } = params as { challengeIds?: string[] };
  if (!challengeIds?.length || !context.assessmentId) {
    return { tool: 'remove_challenges', success: false, result: null, error: 'Missing data' };
  }

  let removed = 0;
  for (const id of challengeIds) {
    const result = await db
      .delete(assessmentChallenges)
      .where(
        and(
          eq(assessmentChallenges.assessmentId, context.assessmentId),
          eq(assessmentChallenges.challengeId, id)
        )
      );
    removed++;
  }

  return { tool: 'remove_challenges', success: true, result: { removed } };
}

async function setWeights(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  if (!context.assessmentId) {
    return { tool: 'set_weights', success: false, result: null, error: 'No assessment ID' };
  }
  const weights = {
    modelSelection: Number(params.modelSelection) || 20,
    promptEfficiency: Number(params.promptEfficiency) || 20,
    debugging: Number(params.debugging) || 20,
    strategy: Number(params.strategy) || 20,
    speed: Number(params.speed) || 20,
  };
  await db
    .update(assessments)
    .set({ categoryWeights: JSON.stringify(weights) })
    .where(eq(assessments.id, context.assessmentId));

  return { tool: 'set_weights', success: true, result: weights };
}

async function setTimeLimit(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  if (!context.assessmentId) {
    return { tool: 'set_time_limit', success: false, result: null, error: 'No assessment ID' };
  }
  const minutes = Math.max(5, Math.min(240, Number(params.minutes) || 60));
  await db
    .update(assessments)
    .set({ timeLimit: minutes * 60 })
    .where(eq(assessments.id, context.assessmentId));

  return { tool: 'set_time_limit', success: true, result: { minutes } };
}

async function setBranding(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  if (!context.assessmentId) {
    return { tool: 'set_branding', success: false, result: null, error: 'No assessment ID' };
  }
  const updates: Record<string, unknown> = {};
  if (typeof params.title === 'string') updates.title = params.title;
  if (typeof params.description === 'string') updates.description = params.description;
  if (typeof params.companyName === 'string') updates.companyName = params.companyName;
  if (typeof params.welcomeMessage === 'string') updates.welcomeMessage = params.welcomeMessage;

  if (Object.keys(updates).length > 0) {
    await db
      .update(assessments)
      .set(updates)
      .where(eq(assessments.id, context.assessmentId));
  }

  return { tool: 'set_branding', success: true, result: updates };
}

async function createCustomChallenge(
  db: Db,
  params: Record<string, unknown>,
  context: { orgId?: string; userId: string }
): Promise<ToolResult> {
  if (!context.orgId) {
    return { tool: 'create_custom_challenge', success: false, result: null, error: 'Organization required to create custom challenges' };
  }

  const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
  const testCases = Array.isArray(params.testCases) ? JSON.stringify(params.testCases) : '[]';
  const hiddenTestCases = Array.isArray(params.hiddenTestCases) ? JSON.stringify(params.hiddenTestCases) : null;
  const tags = Array.isArray(params.tags) ? JSON.stringify(params.tags) : null;

  await db.insert(customChallenges).values({
    id,
    orgId: context.orgId,
    title: String(params.title || 'Untitled Challenge'),
    description: String(params.description || ''),
    difficulty: String(params.difficulty || 'medium'),
    starterCode: typeof params.starterCode === 'string' ? params.starterCode : null,
    testCases,
    hiddenTestCases,
    testHarness: typeof params.testHarness === 'string' ? params.testHarness : null,
    category: String(params.category || 'practice'),
    skillTested: typeof params.skillTested === 'string' ? params.skillTested : null,
    language: String(params.language || 'javascript'),
    tags,
    status: 'draft',
    createdBy: context.userId,
    aiGenerated: 1,
  });

  return {
    tool: 'create_custom_challenge',
    success: true,
    result: {
      id,
      title: params.title,
      status: 'draft',
      message: 'Custom challenge created as draft. The hiring manager should review and approve it before using in assessments.',
    },
  };
}

async function setPassThreshold(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  if (!context.assessmentId) {
    return { tool: 'set_pass_threshold', success: false, result: null, error: 'No assessment ID' };
  }

  const threshold = {
    enabled: params.enabled !== false,
    mode: params.mode === 'weighted_average' ? 'weighted_average' : 'all_dimensions',
    minOverall: Number(params.minOverall) || 60,
    dimensions: {
      modelSelection: Number((params.dimensions as any)?.modelSelection) || 50,
      promptEfficiency: Number((params.dimensions as any)?.promptEfficiency) || 50,
      debugging: Number((params.dimensions as any)?.debugging) || 50,
      strategy: Number((params.dimensions as any)?.strategy) || 50,
      speed: Number((params.dimensions as any)?.speed) || 50,
    },
  };

  await db
    .update(assessments)
    .set({ passThreshold: JSON.stringify(threshold) })
    .where(eq(assessments.id, context.assessmentId));

  return { tool: 'set_pass_threshold', success: true, result: threshold };
}
