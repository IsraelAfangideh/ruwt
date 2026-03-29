/**
 * Integration tests: Challenge + Attempt + Submission flow against real SQLite.
 *
 * Validates the full lifecycle: create challenge, start attempt, record AI calls,
 * submit results, and verify stored data — all with real SQL execution.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { createTestDb, resetDb } from '../_shared/infra/test-db';
import {
  profiles,
  challenges,
  attempts,
  aiCalls,
  transactions,
  attemptMessages,
} from '../../drizzle/schema.d1';

describe('Submissions Integration (real SQLite)', () => {
  const { db, sqlite } = createTestDb();

  // Seed data shared across tests
  const seedUser = () => {
    db.insert(profiles).values({
      id: 'user-1',
      email: 'solver@example.com',
      name: 'Solver',
      credits: 50000,
    }).run();
  };

  const seedChallenge = () => {
    db.insert(challenges).values({
      id: 'ch-fizzbuzz',
      title: 'FizzBuzz',
      description: 'Classic FizzBuzz problem',
      difficulty: 'easy',
      testCases: JSON.stringify([
        { input: [15], expected: 'FizzBuzz' },
        { input: [3], expected: 'Fizz' },
        { input: [5], expected: 'Buzz' },
      ]),
      category: 'practice',
      language: 'javascript',
    }).run();
  };

  beforeEach(() => resetDb(sqlite));
  afterAll(() => sqlite.close());

  // ---------------------------------------------------------------------------
  // Attempt lifecycle
  // ---------------------------------------------------------------------------
  it('creates an attempt linked to user and challenge', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-1',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    const [attempt] = db.select().from(attempts).where(eq(attempts.id, 'att-1')).all();

    expect(attempt).toBeDefined();
    expect(attempt.userId).toBe('user-1');
    expect(attempt.challengeId).toBe('ch-fizzbuzz');
    expect(attempt.status).toBe('in_progress');
    expect(attempt.totalCost).toBe(0);
    expect(attempt.inputTokens).toBe(0);
    expect(attempt.outputTokens).toBe(0);
    expect(attempt.passedTests).toBe(0);
    expect(attempt.totalTests).toBe(0);
    expect(attempt.replayPublic).toBe(1);
    expect(attempt.usedByok).toBe(0);
    expect(attempt.usedHosted).toBe(0);
  });

  it('records AI calls and accumulates cost on attempt', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-ai',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    // Record two AI calls
    db.insert(aiCalls).values({
      id: 'ai-1',
      attemptId: 'att-ai',
      model: 'gpt-4o-mini',
      inputTokens: 500,
      outputTokens: 200,
      cost: 150,
    }).run();

    db.insert(aiCalls).values({
      id: 'ai-2',
      attemptId: 'att-ai',
      model: 'claude-3-haiku',
      inputTokens: 300,
      outputTokens: 100,
      cost: 80,
    }).run();

    // Update attempt totals (as the judge would)
    db.update(attempts)
      .set({
        totalCost: 230,
        inputTokens: 800,
        outputTokens: 300,
      })
      .where(eq(attempts.id, 'att-ai'))
      .run();

    // Verify AI calls stored
    const calls = db.select().from(aiCalls).where(eq(aiCalls.attemptId, 'att-ai')).all();
    expect(calls).toHaveLength(2);
    expect(calls[0].model).toBe('gpt-4o-mini');
    expect(calls[1].model).toBe('claude-3-haiku');

    // Verify accumulated totals
    const [attempt] = db.select().from(attempts).where(eq(attempts.id, 'att-ai')).all();
    expect(attempt.totalCost).toBe(230);
    expect(attempt.inputTokens).toBe(800);
    expect(attempt.outputTokens).toBe(300);
  });

  // ---------------------------------------------------------------------------
  // Submission (pass/fail)
  // ---------------------------------------------------------------------------
  it('marks attempt as passed with test results', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-pass',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    // Simulate successful submission
    const now = new Date().toISOString();
    db.update(attempts)
      .set({
        status: 'passed',
        passedTests: 3,
        totalTests: 3,
        finalCode: 'function fizzbuzz(n) { /* solution */ }',
        totalCost: 500,
        submittedAt: now,
      })
      .where(eq(attempts.id, 'att-pass'))
      .run();

    const [attempt] = db.select().from(attempts).where(eq(attempts.id, 'att-pass')).all();

    expect(attempt.status).toBe('passed');
    expect(attempt.passedTests).toBe(3);
    expect(attempt.totalTests).toBe(3);
    expect(attempt.finalCode).toContain('fizzbuzz');
    expect(attempt.submittedAt).toBe(now);
  });

  it('marks attempt as failed with partial test results', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-fail',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    db.update(attempts)
      .set({
        status: 'failed',
        passedTests: 1,
        totalTests: 3,
        finalCode: 'function fizzbuzz(n) { return n; }',
        submittedAt: new Date().toISOString(),
      })
      .where(eq(attempts.id, 'att-fail'))
      .run();

    const [attempt] = db.select().from(attempts).where(eq(attempts.id, 'att-fail')).all();

    expect(attempt.status).toBe('failed');
    expect(attempt.passedTests).toBe(1);
    expect(attempt.totalTests).toBe(3);
  });

  it('marks attempt as constraint_violated', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-violated',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    db.update(attempts)
      .set({
        status: 'constraint_violated',
        violatedConstraint: 'cost',
        submittedAt: new Date().toISOString(),
      })
      .where(eq(attempts.id, 'att-violated'))
      .run();

    const [attempt] = db.select().from(attempts).where(eq(attempts.id, 'att-violated')).all();

    expect(attempt.status).toBe('constraint_violated');
    expect(attempt.violatedConstraint).toBe('cost');
  });

  // ---------------------------------------------------------------------------
  // Transactions (credit usage tracking)
  // ---------------------------------------------------------------------------
  it('records credit transactions alongside attempts', () => {
    seedUser();
    seedChallenge();

    // Record AI usage transaction
    db.insert(transactions).values({
      id: 'tx-1',
      userId: 'user-1',
      type: 'ai_usage',
      amount: -500,
    }).run();

    // Deduct credits from profile
    db.update(profiles)
      .set({ credits: 49500 })
      .where(eq(profiles.id, 'user-1'))
      .run();

    const [tx] = db.select().from(transactions).where(eq(transactions.id, 'tx-1')).all();
    expect(tx.type).toBe('ai_usage');
    expect(tx.amount).toBe(-500);

    const [profile] = db.select().from(profiles).where(eq(profiles.id, 'user-1')).all();
    expect(profile.credits).toBe(49500);
  });

  // ---------------------------------------------------------------------------
  // Attempt messages (replay history)
  // ---------------------------------------------------------------------------
  it('stores attempt messages for replay', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-replay',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'in_progress',
    }).run();

    // User message
    db.insert(attemptMessages).values({
      id: 'msg-1',
      attemptId: 'att-replay',
      role: 'user',
      content: 'How do I solve FizzBuzz?',
      sequence: 1,
    }).run();

    // Assistant response
    db.insert(attemptMessages).values({
      id: 'msg-2',
      attemptId: 'att-replay',
      role: 'assistant',
      content: 'Use modulo operator...',
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 50,
      cost: 30,
      codeSnapshot: 'function fizzbuzz(n) { if (n % 15 === 0) return "FizzBuzz"; }',
      sequence: 2,
    }).run();

    const messages = db
      .select()
      .from(attemptMessages)
      .where(eq(attemptMessages.attemptId, 'att-replay'))
      .all();

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].sequence).toBe(1);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].model).toBe('gpt-4o-mini');
    expect(messages[1].codeSnapshot).toContain('FizzBuzz');
  });

  // ---------------------------------------------------------------------------
  // FK integrity
  // ---------------------------------------------------------------------------
  it('prevents attempt creation without valid user', () => {
    seedChallenge();

    expect(() => {
      db.insert(attempts).values({
        id: 'att-orphan',
        userId: 'nonexistent',
        challengeId: 'ch-fizzbuzz',
        status: 'in_progress',
      }).run();
    }).toThrow();
  });

  it('prevents attempt creation without valid challenge', () => {
    seedUser();

    expect(() => {
      db.insert(attempts).values({
        id: 'att-orphan',
        userId: 'user-1',
        challengeId: 'nonexistent',
        status: 'in_progress',
      }).run();
    }).toThrow();
  });

  it('prevents AI call creation without valid attempt', () => {
    expect(() => {
      db.insert(aiCalls).values({
        id: 'ai-orphan',
        attemptId: 'nonexistent',
        model: 'test',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      }).run();
    }).toThrow();
  });

  // ---------------------------------------------------------------------------
  // Multiple attempts per challenge
  // ---------------------------------------------------------------------------
  it('allows multiple attempts per user per challenge', () => {
    seedUser();
    seedChallenge();

    db.insert(attempts).values({
      id: 'att-first',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'failed',
      totalCost: 1000,
      passedTests: 1,
      totalTests: 3,
      submittedAt: '2026-03-15T10:00:00Z',
    }).run();

    db.insert(attempts).values({
      id: 'att-second',
      userId: 'user-1',
      challengeId: 'ch-fizzbuzz',
      status: 'passed',
      totalCost: 500,
      passedTests: 3,
      totalTests: 3,
      submittedAt: '2026-03-15T11:00:00Z',
    }).run();

    const userAttempts = db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, 'user-1'),
          eq(attempts.challengeId, 'ch-fizzbuzz'),
        )
      )
      .all();

    expect(userAttempts).toHaveLength(2);
    expect(userAttempts.find(a => a.status === 'passed')).toBeDefined();
    expect(userAttempts.find(a => a.status === 'failed')).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Challenge with hidden test cases and harness
  // ---------------------------------------------------------------------------
  it('stores challenge with hidden tests and test harness', () => {
    const hiddenTests = JSON.stringify([
      { input: [30], expected: 'FizzBuzz' },
      { input: [7], expected: '7' },
    ]);

    const harness = `
      function solve(input) {
        return fizzbuzz(input);
      }
      module.exports = { solve };
    `;

    db.insert(challenges).values({
      id: 'ch-advanced',
      title: 'Advanced FizzBuzz',
      description: 'FizzBuzz with hidden tests',
      difficulty: 'medium',
      testCases: JSON.stringify([{ input: [15], expected: 'FizzBuzz' }]),
      hiddenTestCases: hiddenTests,
      testHarness: harness,
      readonlyPrefix: '// Do not modify above this line',
      category: 'iterative_debugging',
      skillTested: 'pattern-matching',
      language: 'javascript',
      tags: JSON.stringify(['math', 'conditionals']),
      tier: 'core',
    }).run();

    const [challenge] = db.select().from(challenges).where(eq(challenges.id, 'ch-advanced')).all();

    expect(challenge.hiddenTestCases).toBeTruthy();
    const hidden = JSON.parse(challenge.hiddenTestCases!);
    expect(hidden).toHaveLength(2);
    expect(challenge.testHarness).toContain('solve');
    expect(challenge.readonlyPrefix).toContain('Do not modify');
    expect(challenge.category).toBe('iterative_debugging');
    expect(JSON.parse(challenge.tags!)).toEqual(['math', 'conditionals']);
  });
});
