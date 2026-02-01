import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, attempts, challenges } from '@/drizzle';
import { eq } from 'drizzle-orm';
import { runTestCases, type SupportedLanguage } from '@/lib/judge/client';
import { z } from 'zod';

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  sourceCode: z.string(),
  language: z.enum(['javascript', 'typescript', 'python']).default('javascript'),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const body = await req.json();
    const parsed = submissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { attemptId, sourceCode, language } = parsed.data;

    // Get the attempt and verify ownership
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (attempt.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Attempt already submitted' },
        { status: 400 }
      );
    }

    // Check if attempt has expired
    if (attempt.expiresAt && new Date() >= new Date(attempt.expiresAt)) {
      await db
        .update(attempts)
        .set({
          status: 'constraint_violated',
          violatedConstraint: 'time',
          submittedAt: new Date(),
        })
        .where(eq(attempts.id, attemptId));

      return NextResponse.json(
        { error: 'Time limit expired', violation: 'time' },
        { status: 403 }
      );
    }

    // Get the challenge to get test cases
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, attempt.challengeId))
      .limit(1);

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Run tests
    const testCases = challenge.testCases as Array<{ input: string; expectedOutput: string }>;
    
    const testResult = await runTestCases(
      sourceCode,
      language as SupportedLanguage,
      testCases,
      {
        cpuTimeLimit: Math.ceil((challenge.execTimeLimit || 5000) / 1000),
        memoryLimit: (challenge.execMemoryLimit || 256) * 1024, // Convert MB to KB
      }
    );

    // Update attempt with results
    const status = testResult.passed ? 'passed' : 'failed';
    
    await db
      .update(attempts)
      .set({
        status,
        finalCode: sourceCode,
        passedTests: testResult.passedTests,
        totalTests: testResult.totalTests,
        submittedAt: new Date(),
      })
      .where(eq(attempts.id, attemptId));

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get submission status
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json({ error: 'Missing attemptId' }, { status: 400 });
    }

    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
