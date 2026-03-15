import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDb, mockCategoryLabel, mockBuildShareSvg } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockCategoryLabel: vi.fn().mockReturnValue('Debugging'),
  mockBuildShareSvg: vi.fn().mockReturnValue('<svg>test</svg>'),
}));

vi.mock('../../_shared/db', () => ({ getDb: mockGetDb }));
vi.mock('../../_shared/seo', () => ({ categoryLabel: mockCategoryLabel }));
vi.mock('../../_shared/og-svg', () => ({ buildShareSvg: mockBuildShareSvg }));
// Mock resvg-wasm — default: fail (SVG fallback), override per-test for PNG path
const { mockNewContext } = vi.hoisted(() => ({
  mockNewContext: vi.fn().mockRejectedValue(new Error('resvg-wasm not available in test')),
}));
vi.mock('resvg-wasm', () => ({
  newContext: mockNewContext,
}));
vi.mock('../../../drizzle/schema.d1', () => ({
  attempts: { id: 'id', status: 'status', totalCost: 'total_cost', passedTests: 'passed_tests', totalTests: 'total_tests', userId: 'user_id', challengeId: 'challenge_id' },
  challenges: { id: 'id', title: 'title', difficulty: 'difficulty', category: 'category' },
  profiles: { id: 'id', name: 'name' },
}));

import { onRequestGet } from './[attemptId]';

function makeEnv(): Env {
  return { DB: {} as D1Database, VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' } as Env;
}

function makeCtx(attemptId?: string) {
  return {
    request: new Request(`https://ruwt.dev/api/og/${attemptId || ''}`),
    env: makeEnv(),
    params: Promise.resolve({ attemptId }),
  };
}

describe('GET /api/og/:attemptId (public OG image)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('redirects to fallback when attemptId is missing', async () => {
    const res = await onRequestGet(makeCtx(undefined));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://ruwt.dev/og-image.png');
  });

  it('redirects to fallback when attempt not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockGetDb.mockReturnValue({ select: vi.fn().mockReturnValue(chain) });

    const res = await onRequestGet(makeCtx('att-999'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://ruwt.dev/og-image.png');
  });

  it('returns SVG fallback when resvg-wasm is not available', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 5000, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1' };
    const challenge = { title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency' };
    const solver = { name: 'Alice' };
    const rankResult = { rank: 2 };
    const totalResult = { total: 10 };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([rankResult]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([totalResult]) };
      }),
    };
    mockGetDb.mockReturnValue(db);
    mockBuildShareSvg.mockReturnValue('<svg>og</svg>');

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(await res.text()).toBe('<svg>og</svg>');

    // Verify buildShareSvg was called with correct params
    expect(mockBuildShareSvg).toHaveBeenCalledWith(expect.objectContaining({
      challengeTitle: 'FizzBuzz',
      solverName: 'Alice',
      rank: 2,
      totalSolvers: 10,
      difficulty: 'easy',
      passedTests: 5,
      totalTests: 5,
    }));
  });

  it('formats cost correctly for very small amounts', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 50, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1' };
    const challenge = { title: 'T', difficulty: 'easy', category: 'c' };
    const solver = { name: 'A' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ rank: 1 }, { total: 1 }]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('att-1'));
    // 50 / 10000 = 0.005 which is < 0.01, so should use 4 decimal places
    expect(mockBuildShareSvg).toHaveBeenCalledWith(expect.objectContaining({
      costStr: '$0.0050',
    }));
  });

  it('redirects on unexpected error', async () => {
    mockGetDb.mockImplementation(() => { throw new Error('fail'); });
    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://ruwt.dev/og-image.png');
  });

  it('returns PNG when resvg-wasm renders successfully', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 5000, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1' };
    const challenge = { title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency' };
    const solver = { name: 'Alice' };
    const rankResult = { rank: 2 };
    const totalResult = { total: 10 };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([rankResult]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([totalResult]) };
      }),
    };
    mockGetDb.mockReturnValue(db);
    mockBuildShareSvg.mockReturnValue('<svg>og</svg>');

    // Mock resvg-wasm to succeed and return PNG data
    const pngData = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const mockCtx = { render: vi.fn().mockReturnValue(pngData), free: vi.fn() };
    mockNewContext.mockResolvedValueOnce(mockCtx);

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(mockCtx.render).toHaveBeenCalledWith('<svg>og</svg>', null, 1200, 630);
    expect(mockCtx.free).toHaveBeenCalled();
  });

  it('formats OG image cost with two decimal places above one cent', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 500000, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1' };
    const challenge = { title: 'Expensive', difficulty: 'hard', category: 'debugging' };
    const solver = { name: 'Bob' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ rank: 1 }]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ total: 5 }]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('att-1'));
    // 500000 / 10000 = 50.00 which is >= 0.01, so should use 2 decimal places
    expect(mockBuildShareSvg).toHaveBeenCalledWith(expect.objectContaining({
      costStr: '$50.00',
    }));
  });

  it('uses fallback title and category when challenge is not found', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 100, passedTests: null, totalTests: null, userId: 'u-1', challengeId: 'ch-missing' };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        // challenge not found
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        // solver not found
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    };
    mockGetDb.mockReturnValue(db);

    await onRequestGet(makeCtx('att-1'));
    expect(mockBuildShareSvg).toHaveBeenCalledWith(expect.objectContaining({
      challengeTitle: 'Challenge',
      solverName: 'A developer',
      difficulty: 'medium',
      rank: 0,
      totalSolvers: 0,
      passedTests: 0,
      totalTests: 0,
    }));
  });

  it('falls back to SVG when resvg-wasm returns null pngData', async () => {
    const attempt = { id: 'att-1', status: 'passed', totalCost: 5000, passedTests: 5, totalTests: 5, userId: 'u-1', challengeId: 'ch-1' };
    const challenge = { title: 'FizzBuzz', difficulty: 'easy', category: 'prompt_efficiency' };
    const solver = { name: 'Alice' };
    const rankResult = { rank: 2 };
    const totalResult = { total: 10 };

    let selectCall = 0;
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([attempt]) };
        if (selectCall === 2) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([challenge]) };
        if (selectCall === 3) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([solver]) };
        if (selectCall === 4) return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([rankResult]) };
        return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([totalResult]) };
      }),
    };
    mockGetDb.mockReturnValue(db);
    mockBuildShareSvg.mockReturnValue('<svg>og</svg>');

    // Mock resvg-wasm to succeed but return null pngData
    const mockCtx = { render: vi.fn().mockReturnValue(null), free: vi.fn() };
    mockNewContext.mockResolvedValueOnce(mockCtx);

    const res = await onRequestGet(makeCtx('att-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});
