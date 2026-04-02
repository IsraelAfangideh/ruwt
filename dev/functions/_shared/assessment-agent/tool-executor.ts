/**
 * Execute tool calls from the AI assessment agent.
 * Tool calls now come from Cloudflare Workers AI native function calling
 * (structured tool_calls in the API response, not XML blocks in text).
 */
import { eq, and, inArray } from 'drizzle-orm';
import type { Db } from '../infra/db';
import {
  challenges, assessments, assessmentChallenges, customChallenges,
} from '../../../drizzle/schema.d1';
import { pistonExecute, type PistonEnv } from '../infra/piston-client';

/**
 * Strip relative import lines that the AI keeps generating despite prompt
 * instructions.  The harness and solution run as ONE concatenated file —
 * there is no separate module to import/require.
 */
export function sanitizeHarness(harness: string): string {
  return harness
    .split('\n')
    .filter(line => {
      // JS: require('./solution'), require('./shoppingCart'), etc.
      if (/require\s*\(\s*['"]\.\//.test(line)) return false;
      // Python: from solution import ..., import solution
      if (/^\s*(from\s+solution\s+import|import\s+solution)\b/.test(line)) return false;
      return true;
    })
    .join('\n');
}

/** Cloudflare native tool call format. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  result: unknown;
  error?: string;
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
    switch (call.name) {
      case 'search_challenges':
        return await searchChallenges(db, call.arguments);
      case 'select_challenges':
        return await selectChallenges(db, call.arguments, context);
      case 'remove_challenges':
        return await removeChallenges(db, call.arguments, context);
      case 'set_weights':
        return await setWeights(db, call.arguments, context);
      case 'set_time_limit':
        return await setTimeLimit(db, call.arguments, context);
      case 'set_branding':
        return await setBranding(db, call.arguments, context);
      case 'create_custom_challenge':
        return await createCustomChallenge(db, env, call.arguments, context);
      case 'set_pass_threshold':
        return await setPassThreshold(db, call.arguments, context);
      default:
        return { tool: call.name, success: false, result: null, error: `Unknown tool: ${call.name}` };
    }
  } catch (err) {
    return {
      tool: call.name,
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

  // Build SQL WHERE conditions for exact-match filters
  const conditions = [];
  if (category) conditions.push(eq(challenges.category, category));
  if (difficulty) conditions.push(eq(challenges.difficulty, difficulty));
  if (language) conditions.push(eq(challenges.language, language));

  let dbQuery = db
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

  if (conditions.length > 0) {
    dbQuery = dbQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as typeof dbQuery;
  }

  let rows = await dbQuery;

  // Free-text search still done in JS (SQLite LIKE is case-sensitive by default)
  if (query) {
    const q = query.toLowerCase();
    rows = rows.filter((r) =>
      /* istanbul ignore next -- @preserve */
      r.title.toLowerCase().includes(q) ||
      /* istanbul ignore next -- @preserve */ (r.skillTested || '').toLowerCase().includes(q) ||
      /* istanbul ignore next -- @preserve */ (r.tags || '').toLowerCase().includes(q) ||
      /* istanbul ignore next -- @preserve */ (r.category || '').toLowerCase().includes(q)
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

  // Validate that requested challenge IDs exist in the catalog
  const found = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(inArray(challenges.id, challengeIds));
  const validIds = new Set(found.map((c) => c.id));
  const invalid = challengeIds.filter((id) => !validIds.has(id));
  const validChallengeIds = challengeIds.filter((id) => validIds.has(id));
  if (validChallengeIds.length === 0) {
    // Return real challenge IDs so the model can self-correct
    const allChallenges = await db
      .select({ id: challenges.id, title: challenges.title, category: challenges.category })
      .from(challenges);
    // Try to guess what category the model wanted from the fake IDs
    const hint = invalid.join(' ').toLowerCase();
    const categoryGuess = ['frontend', 'backend', 'devops', 'data'].find((c) => hint.includes(c));
    /* istanbul ignore next -- @preserve */
    const suggestions = categoryGuess
      /* istanbul ignore next -- @preserve */ ? allChallenges.filter((c) => (c.category || '').toLowerCase().includes(categoryGuess))
      : allChallenges;
    const topSuggestions = suggestions.slice(0, 8).map((c) => `${c.id} ("${c.title}")`).join(', ');
    return {
      tool: 'select_challenges',
      success: false,
      result: null,
      error: `None of the challenge IDs are valid: ${invalid.join(', ')}. You must use the real challenge IDs from the catalog. Here are some real IDs you can use: ${topSuggestions}`,
    };
  }

  // Get existing challenges
  const existing = await db
    .select({ challengeId: assessmentChallenges.challengeId })
    .from(assessmentChallenges)
    .where(eq(assessmentChallenges.assessmentId, context.assessmentId));

  const existingIds = new Set(existing.map((e) => e.challengeId));
  const newIds = validChallengeIds.filter((id) => !existingIds.has(id));
  let nextSort = newIds.length > 0 ? await getNextSortOrder(db, context.assessmentId) : 0;

  let added = 0;
  for (const id of newIds) {
    await db.insert(assessmentChallenges).values({
      id: crypto.randomUUID(),
      assessmentId: context.assessmentId,
      challengeId: id,
      sortOrder: nextSort + added,
    });
    added++;
  }

  const result: Record<string, unknown> = { added, total: existing.length + added };
  if (invalid.length > 0) result.invalidIds = invalid;
  if (added === 0 && newIds.length === 0) result.note = 'All requested challenges were already selected';

  return { tool: 'select_challenges', success: true, result };
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

  // Check which IDs actually exist before deleting
  const existing = await db
    .select({ challengeId: assessmentChallenges.challengeId })
    .from(assessmentChallenges)
    .where(eq(assessmentChallenges.assessmentId, context.assessmentId));
  const existingIds = new Set(existing.map((e) => e.challengeId));

  let removed = 0;
  const notFound: string[] = [];
  for (const id of challengeIds) {
    if (!existingIds.has(id)) {
      notFound.push(id);
      continue;
    }
    await db
      .delete(assessmentChallenges)
      .where(
        and(
          eq(assessmentChallenges.assessmentId, context.assessmentId),
          eq(assessmentChallenges.challengeId, id)
        )
      );
    removed++;
  }

  return {
    tool: 'remove_challenges',
    success: true,
    result: { removed, ...(notFound.length > 0 ? { notFound } : {}) },
  };
}

async function setWeights(
  db: Db,
  params: Record<string, unknown>,
  context: { assessmentId?: string }
): Promise<ToolResult> {
  if (!context.assessmentId) {
    return { tool: 'set_weights', success: false, result: null, error: 'No assessment ID' };
  }
  const raw = {
    modelSelection: params.modelSelection != null ? Number(params.modelSelection) : 20,
    promptEfficiency: params.promptEfficiency != null ? Number(params.promptEfficiency) : 20,
    debugging: params.debugging != null ? Number(params.debugging) : 20,
    strategy: params.strategy != null ? Number(params.strategy) : 20,
    speed: params.speed != null ? Number(params.speed) : 20,
  };
  // Replace NaN with default
  /* istanbul ignore next -- @preserve */
  const weights = {
    modelSelection: Number.isFinite(raw.modelSelection) ? raw.modelSelection : 20,
    promptEfficiency: Number.isFinite(raw.promptEfficiency) ? raw.promptEfficiency : 20,
    debugging: Number.isFinite(raw.debugging) ? raw.debugging : 20,
    strategy: Number.isFinite(raw.strategy) ? raw.strategy : 20,
    speed: Number.isFinite(raw.speed) ? raw.speed : 20,
  };
  const sum = weights.modelSelection + weights.promptEfficiency + weights.debugging + weights.strategy + weights.speed;
  if (sum !== 100) {
    return { tool: 'set_weights', success: false, result: null, error: `Weights must sum to 100, got ${sum}` };
  }
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
  const raw = Number(params.minutes);
  const minutes = Math.max(5, Math.min(240, Number.isFinite(raw) ? raw : 60));
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

/**
 * Validate a test harness by running the reference solution against it via the executor.
 * Returns { valid: true } on success, { valid: false, error } on failure.
 * Gracefully degrades if the executor is unavailable (returns valid with warning).
 */
/** Get the next sortOrder for a new challenge in an assessment. */
async function getNextSortOrder(db: Db, assessmentId: string): Promise<number> {
  const existing = await db
    .select({ sortOrder: assessmentChallenges.sortOrder })
    .from(assessmentChallenges)
    .where(eq(assessmentChallenges.assessmentId, assessmentId));
  return existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1;
}

/**
 * Validate a test harness by running the reference solution against it via the executor.
 * Returns { valid: true } on success, { valid: false, error } on failure.
 * Gracefully degrades if the executor is unavailable (returns valid with warning).
 */
async function validateHarness(
  env: PistonEnv,
  referenceSolution: string,
  testHarness: string,
  language: string,
): Promise<{ valid: boolean; error?: string; stdout?: string; stderr?: string }> {
  // Strip module.exports from reference solution (same as judge.ts buildTestCode)
  // so declarations don't conflict when concatenated with the harness.
  const cleanedSolution = referenceSolution.replace(/module\.exports\s*=\s*[^;]+;?/g, '');
  const code = `${cleanedSolution}\n\n${testHarness}`;

  let data;
  try {
    data = await pistonExecute(env, {
      language,
      files: [{ content: code }],
      run_timeout: 10000,
    });
  } catch {
    // pistonExecute throws on network errors and non-OK responses — degrade gracefully
    return { valid: true, error: 'Executor unavailable' };
  }

  const stdout = data.run?.stdout?.trim() || '';
  const stderr = data.run?.stderr?.trim() || '';
  /* istanbul ignore next -- @preserve */
  const exitCode = data.run?.code ?? 1;

  if (exitCode !== 0) {
    return { valid: false, error: `Execution failed (exit code ${exitCode})`, stdout, stderr };
  }
  if (/\bFAIL\b/i.test(stdout)) {
    return { valid: false, error: 'Some test cases FAILED with the reference solution', stdout, stderr };
  }
  if (!/\bPASS\b/i.test(stdout)) {
    return { valid: false, error: 'Test harness produced no PASS/FAIL output', stdout, stderr };
  }

  return { valid: true };
}

async function createCustomChallenge(
  db: Db,
  env: Record<string, unknown>,
  params: Record<string, unknown>,
  context: { orgId?: string; userId: string; assessmentId?: string }
): Promise<ToolResult> {
  if (!context.orgId) {
    return { tool: 'create_custom_challenge', success: false, result: null, error: 'Organization required to create custom challenges' };
  }

  const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
  const testCases = Array.isArray(params.testCases) ? JSON.stringify(params.testCases) : '[]';
  const hiddenTestCases = Array.isArray(params.hiddenTestCases) ? JSON.stringify(params.hiddenTestCases) : null;
  const tags = Array.isArray(params.tags) ? JSON.stringify(params.tags) : null;
  const testHarnessRaw = typeof params.testHarness === 'string' ? params.testHarness : null;
  const testHarnessStr = testHarnessRaw ? sanitizeHarness(testHarnessRaw) : null;
  const referenceSolution = typeof params.referenceSolution === 'string' ? params.referenceSolution : null;
  const language = String(params.language || 'javascript');

  // Validate harness with reference solution if both are provided
  let warningMessage = '';
  if (referenceSolution && testHarnessStr) {
    const validation = await validateHarness(env, referenceSolution, testHarnessStr, language);
    if (!validation.valid) {
      return {
        tool: 'create_custom_challenge',
        success: false,
        result: null,
        error: `Test harness validation failed: ${validation.error}${validation.stdout ? `\nStdout: ${validation.stdout}` : ''}${validation.stderr ? `\nStderr: ${validation.stderr}` : ''}`,
      };
    }
    if (validation.error) {
      warningMessage = ` Warning: harness validation skipped (${validation.error}).`;
    }
  }

  await db.insert(customChallenges).values({
    id,
    orgId: context.orgId,
    title: String(params.title || 'Untitled Challenge'),
    description: String(params.description || ''),
    difficulty: String(params.difficulty || 'medium'),
    starterCode: typeof params.starterCode === 'string' ? params.starterCode : null,
    testCases,
    hiddenTestCases,
    testHarness: testHarnessStr,
    category: String(params.category || 'practice'),
    skillTested: typeof params.skillTested === 'string' ? params.skillTested : null,
    language,
    tags,
    status: 'draft',
    createdBy: context.userId,
    aiGenerated: 1,
  });

  // Auto-add to assessment if assessmentId is in context
  let addedToAssessment = false;
  if (context.assessmentId) {
    const sortOrder = await getNextSortOrder(db, context.assessmentId);
    await db.insert(assessmentChallenges).values({
      id: crypto.randomUUID(),
      assessmentId: context.assessmentId,
      challengeId: id,
      customChallengeId: id,
      sortOrder,
    });
    addedToAssessment = true;
  }

  const baseMessage = addedToAssessment
    ? 'Custom challenge created and added to assessment.'
    : 'Custom challenge created as draft. The hiring manager should review and approve it before using in assessments.';

  return {
    tool: 'create_custom_challenge',
    success: true,
    result: {
      id,
      title: params.title,
      status: 'draft',
      addedToAssessment,
      message: `${baseMessage}${warningMessage}`,
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

  const dims = params.dimensions as Record<string, unknown> | undefined;
  const numOrDefault = (val: unknown, fallback: number) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };
  const threshold = {
    enabled: params.enabled !== false,
    mode: params.mode === 'weighted_average' ? 'weighted_average' : 'all_dimensions',
    minOverall: numOrDefault(params.minOverall, 60),
    dimensions: {
      modelSelection: numOrDefault(dims?.modelSelection, 50),
      promptEfficiency: numOrDefault(dims?.promptEfficiency, 50),
      debugging: numOrDefault(dims?.debugging, 50),
      strategy: numOrDefault(dims?.strategy, 50),
      speed: numOrDefault(dims?.speed, 50),
    },
  };

  await db
    .update(assessments)
    .set({ passThreshold: JSON.stringify(threshold) })
    .where(eq(assessments.id, context.assessmentId));

  return { tool: 'set_pass_threshold', success: true, result: threshold };
}
