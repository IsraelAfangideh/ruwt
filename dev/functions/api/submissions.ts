/**
 * POST/GET /api/submissions
 * Submit solution (Judge0) or get submission status; auth required.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { runTestCases, type SupportedLanguage } from '../_shared/scoring/judge';
import { checkAndAwardBadges } from '../_shared/scoring/badges';
import { updateProfileAFI } from '../_shared/ai/afi-update';
import { updateStreak } from '../_shared/scoring/streaks';
import { createCompetitiveNudges } from '../_shared/scoring/competitive-nudges';
import { createNewUserNearRankNotifications } from '../_shared/email/new-user-alerts';
import { invalidateCache } from '../_shared/infra/cache';
import { sendEmail } from '../_shared/newsletter/resend';
import { challengeAttemptNotificationEmail } from '../_shared/email/templates';
import { ADMIN_EMAIL } from '../_shared/ensure-profile';
import { attempts, challenges, customChallenges, profiles } from '../../drizzle/schema.d1';
import type { AiComparison } from '../../src/shared/lib/arena-types';

/** Returns true if code already reads stdin (model ignored instructions). */
function codeReadsStdin(code: string, lang: string): boolean {
  if (lang === 'python') return /\bsys\.stdin\b|\binput\s*\(/.test(code);
  return /process\.stdin|fs\.readFileSync\s*\(\s*0/.test(code);
}

/**
 * For stdin challenges, sandbox user code so stray model output and
 * crashes don't break test comparison. Three layers:
 * 1. Suppress stdout AND stderr so extra prints/logs don't pollute output.
 * 2. Wrap in try-catch (JS) so model test code that throws doesn't kill
 *    the process before the harness runs. Function declarations hoist
 *    out of try blocks (JS Annex B.3.3), so the harness can call them.
 * 3. Friendly error handler: if the harness hits a ReferenceError (function
 *    not defined), output a clear message instead of a raw stack trace.
 */
function stdinOutputGuard(lang: string): { prefix: string; restore: string } {
  if (lang === 'python') {
    const _null = 'type("",(),{"write":lambda *a:0,"flush":lambda *a:0})()';
    return {
      prefix: `import sys as _sys;_stdout=_sys.stdout;_stderr=_sys.stderr;_sys.stdout=${_null};_sys.stderr=${_null}\ntry:\n`,
      restore: '\nexcept:\n    pass\n_sys.stdout=_stdout;_sys.stderr=_stderr\n',
    };
  }
  return {
    prefix: [
      'const _stdw=process.stdout.write.bind(process.stdout);process.stdout.write=()=>true;',
      'const _stde=process.stderr.write.bind(process.stderr);process.stderr.write=()=>true;',
      'try{',
    ].join('\n') + '\n',
    restore: [
      '',
      '}catch(_e){}',
      'process.stdout.write=_stdw;process.stderr.write=_stde;',
      'process.on("uncaughtException",(e)=>{if(e instanceof ReferenceError){console.error(e.message+". Make sure your code defines this function.");process.exit(1);}});',
    ].join('\n') + '\n',
  };
}

/** Assemble code with stdin guard: suppress output, wrap in try/except, append harness. */
function assembleStdinCode(sourceCode: string, language: string, testHarness: string): string {
  const guard = stdinOutputGuard(language);
  const wrapped = language === 'python'
    ? sourceCode.split('\n').map(l => '    ' + l).join('\n')
    : sourceCode;
  return guard.prefix + wrapped + guard.restore + testHarness;
}

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
        /* istanbul ignore next -- @preserve */
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
      let challenge;
      /* istanbul ignore next -- @preserve */
      if (attempt.challengeId.startsWith('custom-')) {
        /* istanbul ignore next -- @preserve */
        const [custom] = await db.select().from(customChallenges).where(eq(customChallenges.id, attempt.challengeId)).limit(1);
        /* istanbul ignore next -- @preserve */
        if (custom) challenge = { ...custom, useStdin: 0, readonlyPrefix: null };
      } else {
        const [cat] = await db.select().from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);
        challenge = cat;
      }

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
      const useStdin = !!challenge.useStdin;
      let codeToRun = sourceCode;
      const skipHarness = useStdin && challenge.testHarness && codeReadsStdin(sourceCode, language);
      if (challenge.testHarness && !skipHarness) {
        if (useStdin) {
          codeToRun = assembleStdinCode(codeToRun, language, challenge.testHarness);
        } else {
          codeToRun += '\n' + challenge.testHarness;
        }
      }
      /* istanbul ignore next -- @preserve */
      if (challenge.readonlyPrefix) codeToRun = challenge.readonlyPrefix + '\n' + codeToRun;
      const testResult = await runTestCases(
        context.env,
        codeToRun,
        language as SupportedLanguage,
        testCases,
        (() => {
          /* istanbul ignore next -- @preserve */
          const cpuTimeLimit = Math.ceil((challenge.execTimeLimit ?? 5000) / 1000);
          /* istanbul ignore next -- @preserve */
          const memoryLimit = (challenge.execMemoryLimit ?? 256) * 1024;
          return { cpuTimeLimit, memoryLimit, mainFunction: challenge.testHarness ? 'solve' : undefined, useStdin };
        })()
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
      // Grace period: allow submission up to 60s after expiry so users who
      // solved the challenge but didn't click Submit in time can still lock
      // in their score. No new AI chat or test runs are allowed — only submit.
      const GRACE_MS = 60_000;
      const elapsed = Date.now() - new Date(attempt.expiresAt).getTime();
      /* istanbul ignore next -- @preserve */
      if (elapsed > GRACE_MS) {
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
    }

    let challenge;
    /* istanbul ignore next -- @preserve */
    if (attempt.challengeId.startsWith('custom-')) {
      /* istanbul ignore next -- @preserve */
      const [custom] = await db.select().from(customChallenges).where(eq(customChallenges.id, attempt.challengeId)).limit(1);
      /* istanbul ignore next -- @preserve */
      if (custom) challenge = { ...custom, useStdin: 0, readonlyPrefix: null };
    } else {
      const [cat] = await db.select().from(challenges).where(eq(challenges.id, attempt.challengeId)).limit(1);
      challenge = cat;
    }

    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Unedited starter code cannot pass. Reject it before the executor runs,
    // before the admin alert, and before any 'failed' row reaches the record.
    // The Arena mirrors this check in the client — see handleSubmit in
    // src/features/arena/ArenaScreen.tsx — so in practice this catches only
    // scripted callers and browsers on a cached pre-guard bundle. The client
    // branches on `code`, so keep that field stable.
    if (challenge.starterCode && sourceCode.trim() === challenge.starterCode.trim()) {
      return Response.json(
        {
          error: 'This is still the starter code. Edit it before you submit.',
          code: 'starter_code_unedited',
        },
        { status: 422 }
      );
    }

    let publicTests: Array<{ input: string; expectedOutput: string }>;
    try {
      publicTests = JSON.parse(challenge.testCases);
    } catch {
      console.error('Corrupted testCases JSON for challenge:', challenge.id);
      return Response.json({ error: 'Challenge data is corrupted' }, { status: 500 });
    }

    let hiddenTests: Array<{ input: string; expectedOutput: string; hint?: string }> = [];
    /* istanbul ignore next -- @preserve */
    if (challenge.hiddenTestCases) {
      try {
        hiddenTests = JSON.parse(challenge.hiddenTestCases);
      } catch {
        console.error('Corrupted hiddenTestCases JSON for challenge:', challenge.id);
      }
    }

    const allTests = [...publicTests, ...hiddenTests];
    const publicCount = publicTests.length;

    const useStdin = !!challenge.useStdin;
    let submitCodeToRun = sourceCode;
    const skipHarness = useStdin && challenge.testHarness && codeReadsStdin(sourceCode, language);
    if (challenge.testHarness && !skipHarness) {
      /* istanbul ignore next -- @preserve */
      if (useStdin) {
        /* istanbul ignore next -- @preserve */
        submitCodeToRun = assembleStdinCode(submitCodeToRun, language, challenge.testHarness);
      } else {
        submitCodeToRun += '\n' + challenge.testHarness;
      }
    }
    /* istanbul ignore next -- @preserve */
    if (challenge.readonlyPrefix) submitCodeToRun = challenge.readonlyPrefix + '\n' + submitCodeToRun;
    const testResult = await runTestCases(
      context.env,
      submitCodeToRun,
      language as SupportedLanguage,
      allTests,
      (() => {
        /* istanbul ignore next -- @preserve */
        const cpuTimeLimit = Math.ceil((challenge.execTimeLimit ?? 5000) / 1000);
        /* istanbul ignore next -- @preserve */
        const memoryLimit = (challenge.execMemoryLimit ?? 256) * 1024;
        return { cpuTimeLimit, memoryLimit, mainFunction: challenge.testHarness ? 'solve' : undefined, useStdin };
      })()
    );

    const status = testResult.passed ? 'passed' : 'failed';
    const submittedAtMs = Date.now();
    const submittedNow = new Date(submittedAtMs).toISOString();
    await db
      .update(attempts)
      .set({
        status,
        finalCode: sourceCode,
        passedTests: testResult.passedTests,
        totalTests: testResult.totalTests,
        submittedAt: submittedNow,
      })
      .where(eq(attempts.id, attempt.id));

    // On successful solve, run post-solve tasks concurrently (non-blocking)
    let newBadges: string[] = [];
    let streakResult: { currentStreak: number; newBadges: string[] } | null = null;
    let aiComparison: AiComparison | null = null;
    if (testResult.passed) {
      const baseUrl = new URL(context.request.url).origin;

      const [badgeResult, streakRes, , , , , aiCompRow] = await Promise.all([
        // Check and award badges
        checkAndAwardBadges(db, user.id).catch(/* istanbul ignore next -- @preserve */ (e) => {
          console.error('Badge check error (non-blocking):', e);
          return [] as string[];
        }),
        // Update streak on any successful solve
        updateStreak(db, user.id).catch(/* istanbul ignore next -- @preserve */ (e) => {
          console.error('Streak update error (non-blocking):', e);
          return null;
        }),
        // Update cached AFI score on profile + record history
        updateProfileAFI(db, user.id).catch(/* istanbul ignore next -- @preserve */ (e) => {
          console.error('AFI update error (non-blocking):', e);
        }),
        // Competitive nudge notifications
        /* istanbul ignore next -- @preserve */
        createCompetitiveNudges(db, user.id, attempt.challengeId, /* istanbul ignore next -- @preserve */ attempt.totalCost ?? 0).catch(/* istanbul ignore next -- @preserve */ (e) => {
          console.error('Competitive nudge error (non-blocking):', e);
        }),
        // Near-rank notifications
        /* istanbul ignore next -- @preserve */
        createNewUserNearRankNotifications(db, user.id).catch(/* istanbul ignore next -- @preserve */ (e) => {
          /* istanbul ignore next -- @preserve */
          console.error('Near-rank notification error (non-blocking):', e);
        }),
        // Invalidate edge caches affected by a new solve
        invalidateCache(baseUrl, [
          '/api/stats',
          '/api/activity',
          '/api/activity?limit=20',
          '/api/leaderboard',
          '/api/leaderboard?limit=50&period=all&division=open',
          '/api/leaderboard?limit=50&period=week&division=open',
          '/api/leaderboard?limit=50&period=month&division=open',
          `/api/leaderboard?challengeId=${attempt.challengeId}&limit=50&period=all&division=open`,
          '/api/challenges',
          `/api/challenges/${attempt.challengeId}`,
        /* istanbul ignore next -- @preserve */
        ]).catch(/* istanbul ignore next -- @preserve */ (e) => {
          /* istanbul ignore next -- @preserve */
          console.error('Cache invalidation error (non-blocking):', e);
        }),
        // AI vs manual comparison stats for post-solve card
        context.env.DB.prepare(`
          SELECT
            COUNT(CASE WHEN ac_sub.has_ai = 1 THEN 1 END) AS aiSolves,
            COUNT(CASE WHEN ac_sub.has_ai IS NULL THEN 1 END) AS manualSolves,
            AVG(CASE WHEN ac_sub.has_ai = 1
                THEN (julianday(a.submitted_at) - julianday(a.created_at)) * 86400 END) AS aiAvgTimeSecs,
            AVG(CASE WHEN ac_sub.has_ai IS NULL
                THEN (julianday(a.submitted_at) - julianday(a.created_at)) * 86400 END) AS manualAvgTimeSecs,
            AVG(CASE WHEN ac_sub.has_ai = 1 THEN a.total_cost END) AS aiAvgCost
          FROM attempts a
          LEFT JOIN (SELECT DISTINCT attempt_id, 1 AS has_ai FROM ai_calls) ac_sub
            ON ac_sub.attempt_id = a.id
          WHERE a.challenge_id = ? AND a.status = 'passed' AND a.submitted_at IS NOT NULL
        `).bind(attempt.challengeId).first<{
          aiSolves: number; manualSolves: number;
          aiAvgTimeSecs: number | null; manualAvgTimeSecs: number | null;
          aiAvgCost: number | null;
        }>().catch(/* istanbul ignore next -- @preserve */ () => null),
      ]);

      newBadges = badgeResult;
      if (streakRes) {
        streakResult = streakRes;
        newBadges = [...newBadges, ...streakRes.newBadges];
      }

      // Compute AI comparison card data (need ≥3 total solves for meaningful stats)
      const MIN_SOLVES_FOR_COMPARISON = 3;
      const totalSolves = (aiCompRow?.aiSolves ?? 0) + (aiCompRow?.manualSolves ?? 0);
      if (aiCompRow && totalSolves >= MIN_SOLVES_FOR_COMPARISON) {
        const userSolveTimeSecs = Math.round(
          (submittedAtMs - new Date(attempt.createdAt).getTime()) / 1000
        );
        aiComparison = {
          aiSolves: aiCompRow.aiSolves,
          manualSolves: aiCompRow.manualSolves,
          aiAvgTimeSecs: aiCompRow.aiAvgTimeSecs,
          manualAvgTimeSecs: aiCompRow.manualAvgTimeSecs,
          aiAvgCost: aiCompRow.aiAvgCost,
          userUsedAi: (attempt.totalCost ?? 0) > 0,
          userSolveTimeSecs,
        };
      }
    }

    // Admin notification for every submission (fire-and-forget)
    if (context.env.RESEND_API_KEY) {
      try {
        const [profile] = await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, user.id)).limit(1);

        /* istanbul ignore next -- @preserve */
        const notifUserName = profile?.name ?? null;
        /* istanbul ignore next -- @preserve */
        const notifUserEmail = user.email ?? '';
        /* istanbul ignore next -- @preserve */
        const notifTotalCost = attempt.totalCost ?? 0;
        const notif = challengeAttemptNotificationEmail({
          userName: notifUserName,
          userEmail: notifUserEmail,
          challengeTitle: challenge.title,
          challengeDifficulty: challenge.difficulty,
          passed: testResult.passed,
          passedTests: testResult.passedTests,
          totalTests: testResult.totalTests,
          totalCost: notifTotalCost,
        });
        sendEmail(context.env, { to: ADMIN_EMAIL, subject: notif.subject, html: notif.html, text: notif.text }).catch(/* istanbul ignore next -- @preserve */ () => {});
      } catch {
        // Non-blocking — never fail the submission response
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
        const truncate = (s: string, max = 500) => s.length > max ? s.substring(0, max) + '...' : s;

        // For hidden tests, include stored hint as a label (e.g., "Numeric-only string")
        let hint: string | undefined;
        if (isHidden) {
          const hiddenIndex = i - publicCount;
          hint = hiddenTests[hiddenIndex]?.hint;
        }

        // Show full details for ALL tests (hidden + public) — like LeetCode
        return {
          passed: r.passed,
          hidden: isHidden,
          input: truncate(r.input),
          expectedOutput: truncate(r.expectedOutput),
          actualOutput: truncate(r.actualOutput),
          error: r.error,
          time: r.time,
          memory: r.memory,
          hint,
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
      aiComparison,
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
