/**
 * POST/GET /api/submissions
 * Submit solution (Judge0) or get submission status; auth required.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/db';
import { getUser } from '../_shared/auth';
import { runTestCases, type SupportedLanguage } from '../_shared/judge';
import { attempts, challenges } from '../../drizzle/schema.d1';

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  sourceCode: z.string(),
  language: z.enum(['javascript', 'typescript', 'python']).default('javascript'),
});

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

    const { attemptId, sourceCode, language } = parsed.data;
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
    if (attempt.status !== 'in_progress') {
      return Response.json({ error: 'Attempt already submitted' }, { status: 400 });
    }

    if (attempt.expiresAt && new Date() >= new Date(attempt.expiresAt)) {
      await db
        .update(attempts)
        .set({
          status: 'constraint_violated',
          violatedConstraint: 'time',
          submittedAt: new Date().toISOString(),
        })
        .where(eq(attempts.id, attemptId));
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

    const testCases = JSON.parse(challenge.testCases) as Array<{ input: string; expectedOutput: string }>;
    const testResult = await runTestCases(
      context.env,
      sourceCode,
      language as SupportedLanguage,
      testCases,
      {
        cpuTimeLimit: Math.ceil((challenge.execTimeLimit || 5000) / 1000),
        memoryLimit: (challenge.execMemoryLimit || 256) * 1024,
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
      .where(eq(attempts.id, attemptId));

    return Response.json({
      success: testResult.passed,
      status,
      totalTests: testResult.totalTests,
      passedTests: testResult.passedTests,
      failedTests: testResult.failedTests,
      results: testResult.results.map((r) => ({
        passed: r.passed,
        input: r.input.substring(0, 100) + (r.input.length > 100 ? '...' : ''),
        expectedOutput: r.expectedOutput.substring(0, 100) + (r.expectedOutput.length > 100 ? '...' : ''),
        actualOutput: r.actualOutput.substring(0, 100) + (r.actualOutput.length > 100 ? '...' : ''),
        error: r.error,
        time: r.time,
        memory: r.memory,
      })),
      attempt: {
        id: attemptId,
        status,
        totalCost: attempt.totalCost,
        inputTokens: attempt.inputTokens,
        outputTokens: attempt.outputTokens,
      },
    });
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
