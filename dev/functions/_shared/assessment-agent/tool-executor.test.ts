import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeToolCall, type ToolCall, type ToolResult } from './tool-executor';

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock that mimics Drizzle ORM's query builder.
 * Each method returns `this` to support chaining (select().from().where()),
 * except the terminal call which resolves the configured result.
 *
 * Usage:
 *   const db = createMockDb({ selectResult: [...] });
 *   // db.select(...).from(...) resolves to selectResult
 */
function createMockDb(opts: {
  selectResult?: unknown[];
  /** For tools that make multiple select() calls (e.g. selectChallenges validates IDs then reads existing). */
  selectResults?: unknown[][];
  insertFn?: ReturnType<typeof vi.fn>;
  updateFn?: ReturnType<typeof vi.fn>;
  deleteFn?: ReturnType<typeof vi.fn>;
} = {}) {
  const selectResult = opts.selectResult ?? [];
  const selectResults = opts.selectResults;
  let selectCallIndex = 0;

  // select().from() can terminate (search_challenges) or chain .where() (select_challenges).
  // We make from() return a thenable that also has a .where() method.
  // When selectResults is provided, each from() call returns the next result in order.
  // .where() always resolves to the same result as its parent from() call.
  let lastFromResult: unknown[] = selectResult;

  const selectWhereMock = vi.fn().mockImplementation(() => Promise.resolve(lastFromResult));
  const fromMock = vi.fn().mockImplementation(() => {
    if (selectResults) {
      lastFromResult = selectResults[selectCallIndex] ?? [];
      selectCallIndex++;
    } else {
      lastFromResult = selectResult;
    }
    return Object.assign(Promise.resolve(lastFromResult), { where: selectWhereMock });
  });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  // .insert(table).values(data) — capture values for assertion
  const valuesMock = opts.insertFn ?? vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  // .update(table).set(data).where(cond) — all chainable
  const updateWhereMock = opts.updateFn ?? vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });

  // .delete(table).where(cond) — chainable
  const deleteWhereMock = opts.deleteFn ?? vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

  return {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    // Expose internals for assertions
    _mocks: { fromMock, selectWhereMock, valuesMock, setMock, updateWhereMock, deleteWhereMock },
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// Minimal context
const baseContext = { userId: 'user-1' };
const withAssessment = { ...baseContext, assessmentId: 'assess-1' };
const withOrg = { ...baseContext, orgId: 'org-1' };
const fullContext = { ...baseContext, assessmentId: 'assess-1', orgId: 'org-1' };

// Stub env
const env = {};

// Deterministic UUID for tests
beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn().mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
  });
});

// ---------------------------------------------------------------------------
// Helper to run a tool call
// ---------------------------------------------------------------------------
async function run(db: MockDb, name: string, args: Record<string, unknown>, context = withAssessment): Promise<ToolResult> {
  return executeToolCall(db as any, env, { name, arguments: args }, context);
}

// ===========================================================================
// 1. search_challenges
// ===========================================================================
describe('search_challenges', () => {
  const sampleChallenges = [
    { id: 'c1', title: 'Fix the Broken Cache', difficulty: 'medium', category: 'iterative_debugging', skillTested: 'cache invalidation', language: 'javascript', tags: '["cache","debugging"]' },
    { id: 'c2', title: 'Optimal Model Router', difficulty: 'hard', category: 'model_selection', skillTested: 'model routing', language: 'python', tags: '["ai","routing"]' },
    { id: 'c3', title: 'Simple Prompt Test', difficulty: 'easy', category: 'prompt_efficiency', skillTested: 'prompting', language: 'javascript', tags: '["prompt"]' },
    { id: 'c4', title: 'Debug the Event Loop', difficulty: 'hard', category: 'iterative_debugging', skillTested: 'async debugging', language: 'typescript', tags: '["async","events"]' },
  ];

  it('returns all challenges when no parameters are given', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', {});

    expect(result.success).toBe(true);
    expect(result.tool).toBe('search_challenges');
    expect((result.result as any).count).toBe(4);
    expect((result.result as any).challenges).toHaveLength(4);
  });

  it('filters by category', async () => {
    // SQL WHERE filters at DB level — mock returns pre-filtered results
    const filtered = sampleChallenges.filter((c) => c.category === 'model_selection');
    const db = createMockDb({ selectResult: filtered });
    const result = await run(db, 'search_challenges', { category: 'model_selection' });

    expect(result.success).toBe(true);
    const challenges = (result.result as any).challenges;
    expect(challenges).toHaveLength(1);
    expect(challenges[0].id).toBe('c2');
  });

  it('filters by difficulty', async () => {
    // SQL WHERE filters at DB level — mock returns pre-filtered results
    const filtered = sampleChallenges.filter((c) => c.difficulty === 'hard');
    const db = createMockDb({ selectResult: filtered });
    const result = await run(db, 'search_challenges', { difficulty: 'hard' });

    expect(result.success).toBe(true);
    expect((result.result as any).count).toBe(2);
    const ids = (result.result as any).challenges.map((c: any) => c.id);
    expect(ids).toContain('c2');
    expect(ids).toContain('c4');
  });

  it('filters by language', async () => {
    // SQL WHERE filters at DB level — mock returns pre-filtered results
    const filtered = sampleChallenges.filter((c) => c.language === 'python');
    const db = createMockDb({ selectResult: filtered });
    const result = await run(db, 'search_challenges', { language: 'python' });

    expect(result.success).toBe(true);
    expect((result.result as any).count).toBe(1);
    expect((result.result as any).challenges[0].id).toBe('c2');
  });

  it('searches by query string (case-insensitive) across title, skillTested, tags, category', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', { query: 'CACHE' });

    expect(result.success).toBe(true);
    // Matches: c1 title ("Broken Cache"), c1 tags ("cache")
    expect((result.result as any).count).toBe(1);
    expect((result.result as any).challenges[0].id).toBe('c1');
  });

  it('query matches skillTested field', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', { query: 'routing' });

    expect(result.success).toBe(true);
    expect((result.result as any).challenges[0].id).toBe('c2');
  });

  it('query matches category field', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', { query: 'prompt_efficiency' });

    expect(result.success).toBe(true);
    expect((result.result as any).challenges[0].id).toBe('c3');
  });

  it('combines filters: category + difficulty + query', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', {
      category: 'iterative_debugging',
      difficulty: 'hard',
      query: 'event',
    });

    expect(result.success).toBe(true);
    expect((result.result as any).count).toBe(1);
    expect((result.result as any).challenges[0].id).toBe('c4');
  });

  it('returns empty list when no challenges match', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', { query: 'nonexistent-xyz' });

    expect(result.success).toBe(true);
    expect((result.result as any).count).toBe(0);
    expect((result.result as any).challenges).toEqual([]);
  });

  it('limits results to 20 challenges', async () => {
    const manyChallenges = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`, title: `Challenge ${i}`, difficulty: 'easy',
      category: 'practice', skillTested: 'test', language: 'javascript', tags: null,
    }));
    const db = createMockDb({ selectResult: manyChallenges });
    const result = await run(db, 'search_challenges', {});

    expect((result.result as any).count).toBe(30);
    expect((result.result as any).challenges).toHaveLength(20);
  });

  it('query matches tags field when tags is a non-null string', async () => {
    const db = createMockDb({ selectResult: sampleChallenges });
    const result = await run(db, 'search_challenges', { query: 'routing' });

    expect(result.success).toBe(true);
    // c2 has tags: '["ai","routing"]' which includes 'routing'
    const ids = (result.result as any).challenges.map((c: any) => c.id);
    expect(ids).toContain('c2');
  });

  it('handles null skillTested and tags gracefully in query search', async () => {
    const challengesWithNulls = [
      { id: 'n1', title: 'Null Fields', difficulty: 'easy', category: 'practice', skillTested: null, language: 'javascript', tags: null },
    ];
    const db = createMockDb({ selectResult: challengesWithNulls });
    // Should not throw even though skillTested and tags are null
    const result = await run(db, 'search_challenges', { query: 'null' });

    expect(result.success).toBe(true);
    expect((result.result as any).count).toBe(1);
  });
});

// ===========================================================================
// 2. select_challenges
// ===========================================================================
describe('select_challenges', () => {
  // Catalog IDs used for validation (first select call)
  const catalogIds = [{ id: 'ch-1' }, { id: 'ch-2' }, { id: 'ch-new' }, { id: 'existing-1' }, { id: 'existing-2' }];

  it('inserts new challenge IDs and returns count', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    // First select: catalog validation, Second select: existing junction rows
    const db = createMockDb({ selectResults: [catalogIds, []], insertFn: valuesMock });
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-1', 'ch-2'] });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('select_challenges');
    expect((result.result as any).added).toBe(2);
    expect((result.result as any).total).toBe(2);
    expect(valuesMock).toHaveBeenCalledTimes(2);
  });

  it('calculates sortOrder based on existing challenges', async () => {
    const existing = [
      { challengeId: 'existing-1', sortOrder: 0 },
      { challengeId: 'existing-2', sortOrder: 1 },
    ];
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ selectResults: [catalogIds, existing], insertFn: valuesMock });
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-new'] });

    expect(result.success).toBe(true);
    expect((result.result as any).added).toBe(1);
    expect((result.result as any).total).toBe(3);
    // sortOrder should be maxSort(1) + 1 + 0 = 2
    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.sortOrder).toBe(2);
  });

  it('skips already selected challenge IDs', async () => {
    const existing = [
      { challengeId: 'ch-1', sortOrder: 0 },
    ];
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ selectResults: [catalogIds, existing], insertFn: valuesMock });
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-1', 'ch-2'] });

    expect(result.success).toBe(true);
    expect((result.result as any).added).toBe(1); // only ch-2 added
    expect((result.result as any).total).toBe(2);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it('returns error when no challengeIds provided', async () => {
    const db = createMockDb();
    const result = await run(db, 'select_challenges', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('No challenge IDs provided');
  });

  it('returns error when challengeIds is empty array', async () => {
    const db = createMockDb();
    const result = await run(db, 'select_challenges', { challengeIds: [] });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No challenge IDs provided');
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-1'] }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No assessment ID');
  });

  it('generates unique IDs using crypto.randomUUID', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ selectResults: [catalogIds, []], insertFn: valuesMock });
    await run(db, 'select_challenges', { challengeIds: ['ch-1'] });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(insertedValues.assessmentId).toBe('assess-1');
    expect(insertedValues.challengeId).toBe('ch-1');
  });

  it('handles all existing IDs (no new inserts)', async () => {
    const existing = [
      { challengeId: 'ch-1', sortOrder: 0 },
      { challengeId: 'ch-2', sortOrder: 1 },
    ];
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ selectResults: [catalogIds, existing], insertFn: valuesMock });
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-1', 'ch-2'] });

    expect(result.success).toBe(true);
    expect((result.result as any).added).toBe(0);
    expect((result.result as any).total).toBe(2);
    expect(valuesMock).not.toHaveBeenCalled();
  });

  it('returns invalidIds for challenge IDs not in catalog', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    // Catalog only has ch-1, not 'bogus-id'
    const db = createMockDb({ selectResults: [catalogIds, []], insertFn: valuesMock });
    const result = await run(db, 'select_challenges', { challengeIds: ['ch-1', 'bogus-id'] });

    expect(result.success).toBe(true);
    expect((result.result as any).added).toBe(1);
    expect((result.result as any).invalidIds).toEqual(['bogus-id']);
  });

  it('returns error with real IDs when all challenge IDs are invalid', async () => {
    const allChallenges = [
      { id: 'real-1', title: 'React Hooks', category: 'frontend' },
      { id: 'real-2', title: 'Node API', category: 'backend' },
    ];
    // First select: catalog validation (returns catalog but none match 'no-1','no-2')
    // Second select: all challenges for suggestions
    const db = createMockDb({ selectResults: [catalogIds, allChallenges] });
    const result = await run(db, 'select_challenges', { challengeIds: ['no-1', 'no-2'] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('None of the challenge IDs are valid');
    expect(result.error).toContain('real-1');
    expect(result.error).toContain('React Hooks');
  });
});

// ===========================================================================
// 3. remove_challenges
// ===========================================================================
describe('remove_challenges', () => {
  it('deletes challenge associations and returns removed count', async () => {
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    // Mock select to return existing challenge IDs so remove can find them
    const db = createMockDb({
      selectResult: [{ challengeId: 'ch-1' }, { challengeId: 'ch-2' }],
      deleteFn: deleteWhereMock,
    });
    const result = await run(db, 'remove_challenges', { challengeIds: ['ch-1', 'ch-2'] });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('remove_challenges');
    expect((result.result as any).removed).toBe(2);
    expect(deleteWhereMock).toHaveBeenCalledTimes(2);
  });

  it('returns error when challengeIds is missing', async () => {
    const db = createMockDb();
    const result = await run(db, 'remove_challenges', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing data');
  });

  it('returns error when challengeIds is empty', async () => {
    const db = createMockDb();
    const result = await run(db, 'remove_challenges', { challengeIds: [] });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing data');
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'remove_challenges', { challengeIds: ['ch-1'] }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing data');
  });

  it('removes a single challenge', async () => {
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({
      selectResult: [{ challengeId: 'ch-1' }],
      deleteFn: deleteWhereMock,
    });
    const result = await run(db, 'remove_challenges', { challengeIds: ['ch-1'] });

    expect(result.success).toBe(true);
    expect((result.result as any).removed).toBe(1);
  });

  it('reports notFound for IDs that do not exist in the assessment', async () => {
    const deleteWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({
      selectResult: [{ challengeId: 'ch-1' }],
      deleteFn: deleteWhereMock,
    });
    const result = await run(db, 'remove_challenges', { challengeIds: ['ch-1', 'ch-nonexistent'] });

    expect(result.success).toBe(true);
    expect((result.result as any).removed).toBe(1);
    expect((result.result as any).notFound).toEqual(['ch-nonexistent']);
  });
});

// ===========================================================================
// 4. set_weights
// ===========================================================================
describe('set_weights', () => {
  it('updates assessment with all 5 scoring dimensions', async () => {
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ updateFn: updateWhereMock });
    const result = await run(db, 'set_weights', {
      modelSelection: 30,
      promptEfficiency: 25,
      debugging: 20,
      strategy: 15,
      speed: 10,
    });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('set_weights');
    expect(result.result).toEqual({
      modelSelection: 30,
      promptEfficiency: 25,
      debugging: 20,
      strategy: 15,
      speed: 10,
    });
    // Verify the DB update was called with JSON-stringified weights
    expect(db._mocks.setMock).toHaveBeenCalledWith({
      categoryWeights: JSON.stringify({
        modelSelection: 30,
        promptEfficiency: 25,
        debugging: 20,
        strategy: 15,
        speed: 10,
      }),
    });
  });

  it('defaults missing dimensions to 20 and validates sum', async () => {
    const db = createMockDb();
    // modelSelection: 50 + 4*20 = 130, should fail
    const badResult = await run(db, 'set_weights', { modelSelection: 50 });
    expect(badResult.success).toBe(false);
    expect(badResult.error).toContain('Weights must sum to 100');

    // Correct: 40 + 4*15 = 100
    const goodResult = await run(db, 'set_weights', {
      modelSelection: 40,
      promptEfficiency: 15,
      debugging: 15,
      strategy: 15,
      speed: 15,
    });
    expect(goodResult.success).toBe(true);
    expect(goodResult.result).toEqual({
      modelSelection: 40,
      promptEfficiency: 15,
      debugging: 15,
      strategy: 15,
      speed: 15,
    });
  });

  it('defaults all dimensions to 20 when no params given', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_weights', {});

    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      modelSelection: 20,
      promptEfficiency: 20,
      debugging: 20,
      strategy: 20,
      speed: 20,
    });
  });

  it('converts non-numeric values to default 20, preserves zero', async () => {
    const db = createMockDb();
    // NaN values default to 20, zero is preserved (Number(null)=0 is finite, kept as-is)
    // Sum: 20+0+20+20+0 = 80, so validation will reject
    const badResult = await run(db, 'set_weights', {
      modelSelection: 'not-a-number',
      promptEfficiency: null,
      debugging: undefined,
      strategy: '',
      speed: 0,
    });
    expect(badResult.success).toBe(false);
    expect(badResult.error).toContain('Weights must sum to 100');

    // With correct sum including a zero weight
    const goodResult = await run(db, 'set_weights', {
      modelSelection: 40,
      promptEfficiency: 30,
      debugging: 20,
      strategy: 10,
      speed: 0,
    });
    expect(goodResult.success).toBe(true);
    expect((goodResult.result as any).speed).toBe(0);
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_weights', { modelSelection: 30 }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No assessment ID');
  });
});

// ===========================================================================
// 5. set_time_limit
// ===========================================================================
describe('set_time_limit', () => {
  it('converts minutes to seconds and updates assessment', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: 90 });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('set_time_limit');
    expect((result.result as any).minutes).toBe(90);
    expect(db._mocks.setMock).toHaveBeenCalledWith({ timeLimit: 5400 }); // 90 * 60
  });

  it('clamps minimum to 5 minutes', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: 1 });

    expect(result.success).toBe(true);
    expect((result.result as any).minutes).toBe(5);
    expect(db._mocks.setMock).toHaveBeenCalledWith({ timeLimit: 300 });
  });

  it('clamps maximum to 240 minutes', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: 500 });

    expect(result.success).toBe(true);
    expect((result.result as any).minutes).toBe(240);
    expect(db._mocks.setMock).toHaveBeenCalledWith({ timeLimit: 14400 });
  });

  it('defaults to 60 minutes when minutes is not provided', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', {});

    expect(result.success).toBe(true);
    expect((result.result as any).minutes).toBe(60);
    expect(db._mocks.setMock).toHaveBeenCalledWith({ timeLimit: 3600 });
  });

  it('defaults to 60 when minutes is non-numeric', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: 'abc' });

    expect(result.success).toBe(true);
    expect((result.result as any).minutes).toBe(60);
  });

  it('clamps negative minutes to 5', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: -10 });

    expect(result.success).toBe(true);
    expect((result.result as any).minutes).toBe(5);
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_time_limit', { minutes: 60 }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No assessment ID');
  });

  it('handles exact boundary values (5 and 240)', async () => {
    const db5 = createMockDb();
    const r5 = await run(db5, 'set_time_limit', { minutes: 5 });
    expect((r5.result as any).minutes).toBe(5);

    const db240 = createMockDb();
    const r240 = await run(db240, 'set_time_limit', { minutes: 240 });
    expect((r240.result as any).minutes).toBe(240);
  });
});

// ===========================================================================
// 6. set_branding
// ===========================================================================
describe('set_branding', () => {
  it('updates all branding fields when provided', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_branding', {
      title: 'Senior Engineer Assessment',
      description: 'Evaluate AI fluency for senior roles',
      companyName: 'Acme Corp',
      welcomeMessage: 'Welcome to the Acme assessment!',
    });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('set_branding');
    expect(result.result).toEqual({
      title: 'Senior Engineer Assessment',
      description: 'Evaluate AI fluency for senior roles',
      companyName: 'Acme Corp',
      welcomeMessage: 'Welcome to the Acme assessment!',
    });
    expect(db._mocks.setMock).toHaveBeenCalledWith({
      title: 'Senior Engineer Assessment',
      description: 'Evaluate AI fluency for senior roles',
      companyName: 'Acme Corp',
      welcomeMessage: 'Welcome to the Acme assessment!',
    });
  });

  it('only includes fields that are strings (ignores non-string values)', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_branding', {
      title: 'My Assessment',
      description: 123,         // not a string, should be ignored
      companyName: null,         // not a string
      welcomeMessage: undefined, // not a string
    });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ title: 'My Assessment' });
  });

  it('skips db update when no valid string fields are provided', async () => {
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ updateFn: updateWhereMock });
    const result = await run(db, 'set_branding', {
      title: 42,
      description: true,
    });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({});
    // update().set() should not have been called at all since the
    // outer update() is only called when there are keys
    expect(updateWhereMock).not.toHaveBeenCalled();
  });

  it('handles partial branding updates', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_branding', { companyName: 'NewCo' });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ companyName: 'NewCo' });
    expect(db._mocks.setMock).toHaveBeenCalledWith({ companyName: 'NewCo' });
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_branding', { title: 'Test' }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No assessment ID');
  });

  it('accepts empty strings as valid values', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_branding', { title: '', welcomeMessage: '' });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ title: '', welcomeMessage: '' });
  });
});

// ===========================================================================
// 7. create_custom_challenge
// ===========================================================================
describe('create_custom_challenge', () => {
  it('creates a custom challenge with all required fields', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    const result = await run(db, 'create_custom_challenge', {
      title: 'Custom API Challenge',
      description: 'Build a REST API from scratch',
      difficulty: 'hard',
      starterCode: 'function solve() {}',
      testCases: [{ input: '1', expected: '2' }],
      category: 'backend_api',
      skillTested: 'api design',
      language: 'typescript',
      testHarness: 'module.exports = solve;',
    }, fullContext);

    expect(result.success).toBe(true);
    expect(result.tool).toBe('create_custom_challenge');
    expect((result.result as any).status).toBe('draft');
    expect((result.result as any).title).toBe('Custom API Challenge');
    expect((result.result as any).id).toMatch(/^custom-/);
    expect((result.result as any).message).toContain('draft');

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.id).toBe('custom-aaaaaaaa');
    expect(inserted.orgId).toBe('org-1');
    expect(inserted.title).toBe('Custom API Challenge');
    expect(inserted.difficulty).toBe('hard');
    expect(inserted.testCases).toBe(JSON.stringify([{ input: '1', expected: '2' }]));
    expect(inserted.category).toBe('backend_api');
    expect(inserted.language).toBe('typescript');
    expect(inserted.starterCode).toBe('function solve() {}');
    expect(inserted.testHarness).toBe('module.exports = solve;');
    expect(inserted.status).toBe('draft');
    expect(inserted.createdBy).toBe('user-1');
    expect(inserted.aiGenerated).toBe(1);
  });

  it('includes hiddenTestCases when provided as array', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', {
      title: 'Test',
      hiddenTestCases: [{ input: 'secret', expected: 'answer' }],
    }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.hiddenTestCases).toBe(JSON.stringify([{ input: 'secret', expected: 'answer' }]));
  });

  it('sets hiddenTestCases to null when not an array', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', {
      title: 'Test',
      hiddenTestCases: 'not-an-array',
    }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.hiddenTestCases).toBeNull();
  });

  it('includes tags when provided as array', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', {
      title: 'Test',
      tags: ['backend', 'api', 'rest'],
    }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.tags).toBe(JSON.stringify(['backend', 'api', 'rest']));
  });

  it('sets tags to null when not an array', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', {
      title: 'Test',
      tags: 'backend',
    }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.tags).toBeNull();
  });

  it('applies sensible defaults for missing optional fields', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', {}, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.title).toBe('Untitled Challenge');
    expect(inserted.description).toBe('');
    expect(inserted.difficulty).toBe('medium');
    expect(inserted.category).toBe('practice');
    expect(inserted.language).toBe('javascript');
    expect(inserted.testCases).toBe('[]');
    expect(inserted.starterCode).toBeNull();
    expect(inserted.testHarness).toBeNull();
    expect(inserted.skillTested).toBeNull();
    expect(inserted.hiddenTestCases).toBeNull();
    expect(inserted.tags).toBeNull();
  });

  it('returns error when orgId is missing from context', async () => {
    const db = createMockDb();
    const result = await run(db, 'create_custom_challenge', { title: 'Test' }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Organization required to create custom challenges');
  });

  it('also works when orgId present but no assessmentId', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    const result = await run(db, 'create_custom_challenge', { title: 'Test' }, withOrg);

    expect(result.success).toBe(true);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it('coerces non-string starterCode to null', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', { starterCode: 42 }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.starterCode).toBeNull();
  });

  it('coerces non-string testHarness to null', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', { testHarness: false }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.testHarness).toBeNull();
  });

  it('coerces non-string skillTested to null', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertFn: valuesMock });
    await run(db, 'create_custom_challenge', { skillTested: 123 }, fullContext);

    const inserted = valuesMock.mock.calls[0][0];
    expect(inserted.skillTested).toBeNull();
  });
});

// ===========================================================================
// 8. set_pass_threshold
// ===========================================================================
describe('set_pass_threshold', () => {
  it('sets pass threshold with all dimensions configured', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', {
      enabled: true,
      mode: 'all_dimensions',
      minOverall: 70,
      dimensions: {
        modelSelection: 60,
        promptEfficiency: 65,
        debugging: 70,
        strategy: 55,
        speed: 50,
      },
    });

    expect(result.success).toBe(true);
    expect(result.tool).toBe('set_pass_threshold');
    expect(result.result).toEqual({
      enabled: true,
      mode: 'all_dimensions',
      minOverall: 70,
      dimensions: {
        modelSelection: 60,
        promptEfficiency: 65,
        debugging: 70,
        strategy: 55,
        speed: 50,
      },
    });

    const setArg = db._mocks.setMock.mock.calls[0][0];
    expect(JSON.parse(setArg.passThreshold)).toEqual(result.result);
  });

  it('uses weighted_average mode when specified', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', { mode: 'weighted_average' });

    expect((result.result as any).mode).toBe('weighted_average');
  });

  it('defaults mode to all_dimensions for unrecognized mode values', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', { mode: 'something_invalid' });

    expect((result.result as any).mode).toBe('all_dimensions');
  });

  it('defaults enabled to true when not explicitly false', async () => {
    const db = createMockDb();
    const r1 = await run(db, 'set_pass_threshold', {});
    expect((r1.result as any).enabled).toBe(true);

    const db2 = createMockDb();
    const r2 = await run(db2, 'set_pass_threshold', { enabled: true });
    expect((r2.result as any).enabled).toBe(true);

    const db3 = createMockDb();
    const r3 = await run(db3, 'set_pass_threshold', { enabled: 'yes' });
    expect((r3.result as any).enabled).toBe(true);
  });

  it('sets enabled to false when explicitly false', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', { enabled: false });

    expect((result.result as any).enabled).toBe(false);
  });

  it('defaults minOverall to 60 when not provided', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', {});

    expect((result.result as any).minOverall).toBe(60);
  });

  it('defaults each dimension to 50 when not provided', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', {});

    expect((result.result as any).dimensions).toEqual({
      modelSelection: 50,
      promptEfficiency: 50,
      debugging: 50,
      strategy: 50,
      speed: 50,
    });
  });

  it('handles partial dimensions (missing ones default to 50)', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', {
      dimensions: { modelSelection: 80, debugging: 90 },
    });

    expect((result.result as any).dimensions).toEqual({
      modelSelection: 80,
      promptEfficiency: 50,
      debugging: 90,
      strategy: 50,
      speed: 50,
    });
  });

  it('handles null dimensions object (all default to 50)', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', { dimensions: null });

    expect((result.result as any).dimensions).toEqual({
      modelSelection: 50,
      promptEfficiency: 50,
      debugging: 50,
      strategy: 50,
      speed: 50,
    });
  });

  it('returns error when no assessmentId in context', async () => {
    const db = createMockDb();
    const result = await run(db, 'set_pass_threshold', { enabled: true }, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No assessment ID');
  });
});

// ===========================================================================
// Error handling
// ===========================================================================
describe('error handling', () => {
  it('returns error for unknown tool name', async () => {
    const db = createMockDb();
    const result = await run(db, 'nonexistent_tool', {});

    expect(result.success).toBe(false);
    expect(result.tool).toBe('nonexistent_tool');
    expect(result.result).toBeNull();
    expect(result.error).toBe('Unknown tool: nonexistent_tool');
  });

  it('catches database errors from select and returns them as error results', async () => {
    const fromMock = vi.fn().mockRejectedValue(new Error('D1 connection failed'));
    const db = {
      select: vi.fn().mockReturnValue({ from: fromMock }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'search_challenges',
      arguments: {},
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.tool).toBe('search_challenges');
    expect(result.error).toBe('D1 connection failed');
    expect(result.result).toBeNull();
  });

  it('catches database errors from insert and returns them as error results', async () => {
    // First select (catalog validation via inArray) succeeds, second select (existing) succeeds, but insert throws
    let whereCallCount = 0;
    const selectWhereMock = vi.fn().mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1) {
        // First where: inArray validation — return valid IDs
        return Promise.resolve([{ id: 'ch-1' }]);
      }
      // Second where: existing junction rows
      return Promise.resolve([]);
    });
    const fromMock = vi.fn().mockImplementation(() => {
      return Object.assign(Promise.resolve([]), { where: selectWhereMock });
    });
    const valuesMock = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed'));
    const db = {
      select: vi.fn().mockReturnValue({ from: fromMock }),
      insert: vi.fn().mockReturnValue({ values: valuesMock }),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'select_challenges',
      arguments: { challengeIds: ['ch-1'] },
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.error).toBe('UNIQUE constraint failed');
  });

  it('catches database errors from update and returns them as error results', async () => {
    const updateWhereMock = vi.fn().mockRejectedValue(new Error('Update failed'));
    const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
    const db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn().mockReturnValue({ set: setMock }),
      delete: vi.fn(),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'set_weights',
      arguments: { modelSelection: 30, promptEfficiency: 25, debugging: 20, strategy: 15, speed: 10 },
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Update failed');
  });

  it('catches database errors from delete and returns them as error results', async () => {
    const deleteWhereMock = vi.fn().mockRejectedValue(new Error('Delete failed'));
    // Need select mock for the pre-check query, returning ch-1 as existing
    const selectWhereMock = vi.fn().mockResolvedValue([{ challengeId: 'ch-1' }]);
    const fromResult = Object.assign(Promise.resolve([{ challengeId: 'ch-1' }]), { where: selectWhereMock });
    const fromMock = vi.fn().mockReturnValue(fromResult);
    const db = {
      select: vi.fn().mockReturnValue({ from: fromMock }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockReturnValue({ where: deleteWhereMock }),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'remove_challenges',
      arguments: { challengeIds: ['ch-1'] },
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Delete failed');
  });

  it('stringifies non-Error thrown values', async () => {
    const fromMock = vi.fn().mockRejectedValue('string-error');
    const db = {
      select: vi.fn().mockReturnValue({ from: fromMock }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'search_challenges',
      arguments: {},
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.error).toBe('string-error');
  });

  it('stringifies thrown object values', async () => {
    const fromMock = vi.fn().mockRejectedValue({ code: 'ERR_BAD', message: 'oops' });
    const db = {
      select: vi.fn().mockReturnValue({ from: fromMock }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const result = await executeToolCall(db as any, env, {
      name: 'search_challenges',
      arguments: {},
    }, withAssessment);

    expect(result.success).toBe(false);
    expect(result.error).toBe('[object Object]');
  });
});

// ===========================================================================
// executeToolCall interface contract
// ===========================================================================
describe('executeToolCall interface', () => {
  it('always returns an object with tool, success, and result fields', async () => {
    const db = createMockDb();
    const tools = [
      'search_challenges', 'select_challenges', 'remove_challenges',
      'set_weights', 'set_time_limit', 'set_branding',
      'create_custom_challenge', 'set_pass_threshold', 'bogus_tool',
    ];

    for (const toolName of tools) {
      const result = await executeToolCall(db as any, env, {
        name: toolName,
        arguments: {},
      }, fullContext);

      expect(result).toHaveProperty('tool');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('result');
      expect(result.tool).toBe(toolName);
      expect(typeof result.success).toBe('boolean');
    }
  });

  it('routes each tool name to its specific handler', async () => {
    // Verify search_challenges calls db.select, not db.update or db.insert
    const db = createMockDb({ selectResult: [] });
    await run(db, 'search_challenges', {});
    expect(db.select).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('passes context.assessmentId correctly to tools that need it', async () => {
    const db = createMockDb();
    // set_weights uses context.assessmentId in the where clause (weights must sum to 100)
    await run(db, 'set_weights', { modelSelection: 30, promptEfficiency: 25, debugging: 20, strategy: 15, speed: 10 }, { userId: 'u1', assessmentId: 'special-id' });
    expect(db._mocks.updateWhereMock).toHaveBeenCalled();
    // The update was issued (would have used eq(assessments.id, 'special-id'))
    expect(db.update).toHaveBeenCalled();
  });
});
