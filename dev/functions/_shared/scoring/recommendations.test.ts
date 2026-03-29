import { describe, it, expect, vi } from 'vitest';
import { getSmartRecommendations, type SmartRecommendation } from './recommendations';

// ---------------------------------------------------------------------------
// recommendations.ts calls db.all() twice in parallel (Promise.all):
//   Call 0: solved challenges for user
//   Call 1: all challenges
// We mock db.all to return the right data based on call order.
// ---------------------------------------------------------------------------

function createDb(solved: unknown[], allChallenges: unknown[]) {
  let callIndex = 0;
  return {
    all: vi.fn().mockImplementation(() => {
      const result = callIndex === 0 ? solved : allChallenges;
      callIndex++;
      return Promise.resolve(result);
    }),
  } as any;
}

// Helper to build challenge objects
function ch(
  id: string,
  title: string,
  difficulty: string,
  category: string,
  tier: string = 'core',
  sort_order: number = 0,
) {
  return { id, title, difficulty, category, tier, sort_order };
}

describe('getSmartRecommendations', () => {
  it('returns empty array when all challenges are solved', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'easy' },
    ];
    const all = [ch('c1', 'Solved One', 'easy', 'practice')];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1');

    expect(result).toEqual([]);
  });

  it('returns onboarding-tier challenges for empty solve history', async () => {
    const all = [
      ch('c1', 'Hello World', 'sprint', 'practice', 'onboarding', 1),
      ch('c2', 'Two Sum', 'easy', 'practice', 'core', 2),
      ch('c3', 'Intro Debug', 'sprint', 'iterative_debugging', 'onboarding', 3),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-new', 3);

    expect(result.length).toBeLessThanOrEqual(3);
    // Onboarding challenges should score higher (get +10 bonus)
    // With no solve history, onboarding tier gets preferred
    const ids = result.map(r => r.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');
  });

  it('limits results to count parameter', async () => {
    const all = [
      ch('c1', 'A', 'easy', 'practice'),
      ch('c2', 'B', 'medium', 'model_selection'),
      ch('c3', 'C', 'hard', 'iterative_debugging'),
      ch('c4', 'D', 'easy', 'prompt_efficiency'),
      ch('c5', 'E', 'medium', 'practice'),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1', 2);

    expect(result).toHaveLength(2);
  });

  it('defaults count to 3', async () => {
    const all = Array.from({ length: 10 }, (_, i) =>
      ch(`c${i}`, `Challenge ${i}`, 'easy', `cat-${i}`)
    );
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1');

    expect(result).toHaveLength(3);
  });

  it('boosts partially-completed categories (category saturation)', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'debugging', difficulty: 'easy' },
    ];
    const all = [
      ch('c1', 'Debug 1', 'easy', 'debugging'),
      ch('c2', 'Debug 2', 'medium', 'debugging'),  // same category, partial
      ch('c3', 'Model 1', 'easy', 'model_selection'),
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1', 2);

    // c2 should score +30 for partial category completion
    expect(result[0].id).toBe('c2');
    expect(result[0].reason).toContain('1/2');
    expect(result[0].reason).toContain('debugging');
  });

  it('boosts difficulty progression (step up)', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'easy' },
    ];
    const all = [
      ch('c1', 'Easy One', 'easy', 'practice'),
      ch('c2', 'Medium Step', 'medium', 'model_selection'),
      ch('c3', 'Hard Jump', 'hard', 'model_selection'),
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1', 2);

    // c2 (medium) is one step above easy → +15 bonus
    // c3 (hard) is two steps above → no step-up bonus
    const ids = result.map(r => r.id);
    expect(ids[0]).toBe('c2');
  });

  it('deduplicates categories (max one per category in initial fill)', async () => {
    const all = [
      ch('c1', 'Practice A', 'easy', 'practice', 'onboarding'),
      ch('c2', 'Practice B', 'easy', 'practice', 'onboarding'),
      ch('c3', 'Debug A', 'easy', 'debugging', 'onboarding'),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1', 3);

    // First pass dedup: practice appears once, debugging once, then backfill
    const categories = result.map(r => r.category);
    // The first count-1 slots enforce dedup, last slot can repeat
    const firstTwo = categories.slice(0, 2);
    expect(new Set(firstTwo).size).toBe(2);
  });

  it('backfills from remaining when dedup leaves gaps', async () => {
    // Only 2 unique categories but count=3 — backfill will add a repeat
    const all = [
      ch('c1', 'P1', 'easy', 'practice', 'onboarding', 1),
      ch('c2', 'P2', 'medium', 'practice', 'core', 2),
      ch('c3', 'D1', 'easy', 'debugging', 'onboarding', 3),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1', 3);

    expect(result).toHaveLength(3);
    // All 3 unsolved challenges should appear
    const ids = result.map(r => r.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).toContain('c3');
  });

  it('provides varied recommendations with rich solve history', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'easy' },
      { challenge_id: 'c2', category: 'practice', difficulty: 'medium' },
      { challenge_id: 'c4', category: 'debugging', difficulty: 'easy' },
    ];
    const all = [
      ch('c1', 'Practice E', 'easy', 'practice'),
      ch('c2', 'Practice M', 'medium', 'practice'),
      ch('c3', 'Practice H', 'hard', 'practice'),       // partial category
      ch('c4', 'Debug E', 'easy', 'debugging'),
      ch('c5', 'Debug M', 'medium', 'debugging'),        // partial category + same diff
      ch('c6', 'Model E', 'easy', 'model_selection'),    // new category
      ch('c7', 'Model M', 'medium', 'model_selection'),
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-rich', 3);

    expect(result).toHaveLength(3);
    // Each recommendation should have required fields
    for (const rec of result) {
      expect(rec.id).toBeTruthy();
      expect(rec.title).toBeTruthy();
      expect(rec.difficulty).toBeTruthy();
      expect(rec.category).toBeTruthy();
      expect(rec.reason).toBeTruthy();
    }
  });

  it('uses sort_order as a tiebreaker (lower order preferred)', async () => {
    const all = [
      ch('c1', 'Later', 'easy', 'practice', 'core', 100),
      ch('c2', 'Earlier', 'easy', 'practice', 'core', 1),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1', 2);

    // c2 has lower sort_order, so its score is penalized less
    expect(result[0].id).toBe('c2');
  });

  it('assigns default reason for unsolved categories with matching difficulty', async () => {
    const all = [
      ch('c1', 'Some Challenge', 'medium', 'model_selection'),
    ];
    const db = createDb([], all);

    const result = await getSmartRecommendations(db, 'user-1', 1);

    // No partial category, no step-up → default reason format
    expect(result[0].reason).toBe('medium model_selection');
  });

  it('generates step-up reason when challenge is one difficulty above', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'medium' },
    ];
    const all = [
      ch('c1', 'P Med', 'medium', 'practice'),
      ch('c2', 'New Hard', 'hard', 'model_selection'), // one step above medium
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1', 1);

    expect(result[0].reason).toBe('step up to hard');
  });

  it('handles sprint difficulty in progression', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'sprint' },
    ];
    const all = [
      ch('c1', 'Sprint', 'sprint', 'practice'),
      ch('c2', 'Easy Next', 'easy', 'model_selection'),
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1', 1);

    // easy is one step above sprint → step-up reason
    expect(result[0].reason).toBe('step up to easy');
  });

  it('handles impossible difficulty challenges', async () => {
    const solved = [
      { challenge_id: 'c1', category: 'practice', difficulty: 'hard' },
    ];
    const all = [
      ch('c1', 'Hard One', 'hard', 'practice'),
      ch('c2', 'Impossible', 'impossible', 'debugging'),
    ];
    const db = createDb(solved, all);

    const result = await getSmartRecommendations(db, 'user-1', 1);

    expect(result[0].id).toBe('c2');
    expect(result[0].reason).toBe('step up to impossible');
  });
});
