/**
 * POST/GET /api/submissions
 * Submit solution (Judge0) or get submission status; auth required.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { runTestCases, type SupportedLanguage } from '../_shared/judge';
import { checkAndAwardBadges } from '../_shared/badges';
import { updateStreak } from '../_shared/streaks';
import { attempts, challenges } from '../../drizzle/schema.d1';

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  sourceCode: z.string(),
  language: z.enum(['javascript', 'typescript', 'python']).default('javascript'),
  mode: z.enum(['test', 'submit']).default('submit'),
  idempotencyKey: z.string().optional(),
});

// In-memory deduplication for concurrent submissions (per isolate lifetime)
const recentSubmissions = new Map<string, { timestamp: number; result: object }>();
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await context.request.json().catch(() => ({}));
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { attemptId, sourceCode, language, mode, idempotencyKey } = parsed.data;

    // Dedup: if same idempotency key was recently processed, return cached result
    if (idempotencyKey) {
      const cached = recentSubmissions.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < DEDUP_WINDOW_MS) {
        return Response.json(cached.result);
      }
    }

    // Prune old entries periodically (1% chance)
    if (Math.random() < 0.01) {
      const cutoff = Date.now() - DEDUP_WINDOW_MS;
      for (const [key, val] of recentSubmissions) {
        if (val.timestamp < cutoff) recentSubmissions.delete(key);
      }
    }

    const db = getDb(context.env);

    let [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return Response.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.userId !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // In test mode, skip status and expiry checks — just run tests and return
    if (mode === 'test') {
      const [challenge] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, attempt.challengeId))
        .limit(1);

      if (!challenge) {
        return Response.json({ error: 'Challenge not found' }, { status: 404 });
      }

      let testCases: Array<{ input: string; expectedOutput: string }>;
      try {
        testCases = JSON.parse(challenge.testCases);
      } catch {
        console.error('Corrupted testCases JSON for challenge:', challenge.id);
        return Response.json({ error: 'Challenge data is corrupted' }, { status: 500 });
      }
      const codeToRun = challenge.testHarness
        ? sourceCode + '\n' + challenge.testHarness
        : sourceCode;
      const testResult = await runTestCases(
        context.env,
        codeToRun,
        language as SupportedLanguage,
        testCases,
        {
          cpuTimeLimit: Math.ceil((challenge.execTimeLimit || 5000) / 1000),
          memoryLimit: (challenge.execMemoryLimit || 256) * 1024,
          mainFunction: challenge.testHarness ? 'solve' : undefined,
        }
      );

      return Response.json({
        success: testResult.passed,
        status: testResult.passed ? 'passed' : 'failed',
        totalTests: testResult.totalTests,
        passedTests: testResult.passedTests,
        failedTests: testResult.failedTests,
        results: testResult.results.map((r) => ({
          passed: r.passed,
          input: r.input.substring(0, 200) + (r.input.length > 200 ? '...' : ''),
          expectedOutput: r.expectedOutput.substring(0, 200) + (r.expectedOutput.length > 200 ? '...' : ''),
          actualOutput: r.actualOutput.substring(0, 200) + (r.actualOutput.length > 200 ? '...' : ''),
          error: r.error,
          time: r.time,
          memory: r.memory,
        })),
        attempt: {
          id: attemptId,
          status: attempt.status,
          totalCost: attempt.totalCost,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens,
        },
        isTest: true,
      });
    }

    // Submit mode: if attempt already submitted, auto-create a new one
    if (attempt.status !== 'in_progress') {
      const newAttemptId = crypto.randomUUID();
      await db.insert(attempts).values({
        id: newAttemptId,
        userId: user.id,
        challengeId: attempt.challengeId,
        status: 'in_progress',
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        passedTests: 0,
        totalTests: attempt.totalTests,
        expiresAt: null,
      });
      const [newAttempt] = await db
        .select()
        .from(attempts)
        .where(eq(attempts.id, newAttemptId))
        .limit(1);
      attempt = newAttempt;
    }

    if (attempt.expiresAt && new Date() >= new Date(attempt.expiresAt)) {
      await db
        .update(attempts)
        .set({
          status: 'constraint_violated',
          violatedConstraint: 'time',
          submittedAt: new Date().toISOString(),
        })
        .where(eq(attempts.id, attempt.id));
      return Response.json(
        { error: 'Time limit expired', violation: 'time' },
        { status: 403 }
      );
    }

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, attempt.challengeId))
      .limit(1);

    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    let publicTests: Array<{ input: string; expectedOutput: string }>;
    try {
      publicTests = JSON.parse(challenge.testCases);
    } catch {
      console.error('Corrupted testCases JSON for challenge:', challenge.id);
      return Response.json({ error: 'Challenge data is corrupted' }, { status: 500 });
    }

    let hiddenTests: Array<{ input: string; expectedOutput: string }> = [];
    if (challenge.hiddenTestCases) {
      try {
        hiddenTests = JSON.parse(challenge.hiddenTestCases);
      } catch {
        console.error('Corrupted hiddenTestCases JSON for challenge:', challenge.id);
      }
    }

    const allTests = [...publicTests, ...hiddenTests];
    const publicCount = publicTests.length;

    const submitCodeToRun = challenge.testHarness
      ? sourceCode + '\n' + challenge.testHarness
      : sourceCode;
    const testResult = await runTestCases(
      context.env,
      submitCodeToRun,
      language as SupportedLanguage,
      allTests,
      {
        cpuTimeLimit: Math.ceil((challenge.execTimeLimit || 5000) / 1000),
        memoryLimit: (challenge.execMemoryLimit || 256) * 1024,
        mainFunction: challenge.testHarness ? 'solve' : undefined,
      }
    );

    const status = testResult.passed ? 'passed' : 'failed';
    await db
      .update(attempts)
      .set({
        status,
        finalCode: sourceCode,
        passedTests: testResult.passedTests,
        totalTests: testResult.totalTests,
        submittedAt: new Date().toISOString(),
      })
      .where(eq(attempts.id, attempt.id));

    // On successful solve, check badges and update streaks (non-blocking)
    let newBadges: string[] = [];
    let streakResult: { currentStreak: number; newBadges: string[] } | null = null;
    if (testResult.passed) {
      try {
        newBadges = await checkAndAwardBadges(db, user.id);

        // Update streak on any successful solve
        streakResult = await updateStreak(db, user.id);
        newBadges = [...newBadges, ...streakResult.newBadges];
      } catch (e) {
        console.error('Badge/streak check error (non-blocking):', e);
      }
    }

    const responseBody = {
      success: testResult.passed,
      status,
      totalTests: testResult.totalTests,
      passedTests: testResult.passedTests,
      failedTests: testResult.failedTests,
      results: testResult.results.map((r, i) => {
        const isHidden = i >= publicCount;
        if (isHidden) {
          // Provide a vague hint for failed hidden tests to help debugging
          let hint: string | undefined;
          if (!r.passed) {
            const input = r.input.toLowerCase();
            if (input === '' || input === 'null' || input === 'undefined' || input === '[]' || input === '{}') {
              hint = 'Edge case: empty or null input';
            } else if (/^\d{4,}/.test(r.input) || r.input.length > 100) {
              hint = 'Edge case: large input';
            } else if (/[^a-zA-Z0-9\s,.\-]/.test(r.input.slice(0, 50))) {
              hint = 'Edge case: special characters';
            } else {
              hint = 'Hidden edge case — check boundary conditions';
            }
          }
          return {
            passed: r.passed,
            hidden: true,
            input: '(hidden)',
            expectedOutput: '(hidden)',
            actualOutput: '(hidden)',
            hint,
          };
        }
        return {
          passed: r.passed,
          hidden: false,
          input: r.input.substring(0, 200) + (r.input.length > 200 ? '...' : ''),
          expectedOutput: r.expectedOutput.substring(0, 200) + (r.expectedOutput.length > 200 ? '...' : ''),
          actualOutput: r.actualOutput.substring(0, 200) + (r.actualOutput.length > 200 ? '...' : ''),
          error: r.error,
          time: r.time,
          memory: r.memory,
        };
      }),
      attempt: {
        id: attempt.id,
        status,
        totalCost: attempt.totalCost,
        inputTokens: attempt.inputTokens,
        outputTokens: attempt.outputTokens,
      },
      newBadges,
      streak: streakResult ? { currentStreak: streakResult.currentStreak } : null,
    };

    // Cache for idempotency dedup
    if (idempotencyKey) {
      recentSubmissions.set(idempotencyKey, { timestamp: Date.now(), result: responseBody });
    }

    return Response.json(responseBody);
  } catch (error) {
    console.error('Submission error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(context.request.url);
    const attemptId = url.searchParams.get('attemptId');
    if (!attemptId) {
      return Response.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const db = getDb(context.env);
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return Response.json({ error: 'Attempt not found' }, { status: 404 });
    }
    if (attempt.userId !== user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return Response.json({
      id: attempt.id,
      status: attempt.status,
      totalCost: attempt.totalCost,
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      passedTests: attempt.passedTests,
      totalTests: attempt.totalTests,
      createdAt: attempt.createdAt,
      submittedAt: attempt.submittedAt,
      violatedConstraint: attempt.violatedConstraint,
    });
  } catch (error) {
    console.error('Get submission error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
