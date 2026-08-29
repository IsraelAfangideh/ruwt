import { eq } from 'drizzle-orm';
import { versusMatches } from '../../../drizzle/schema.d1';
import type { VersusMatch, Challenge } from '../../../drizzle/schema.d1';
import { applyCodeFromResponse } from '../../../src/features/shared-ide/lib/code-apply';
import { formatTestResultsForMessage } from '../../../src/features/shared-ide/lib/ai-types';
import { streamCloudflareAIWithFallback } from '../ai/ai-stream';
import { calculateCost } from '../ai/ai-pricing';
import { runTestCases, type SupportedLanguage } from '../scoring/judge';
import { assembleVersusCode } from './assemble-code';
import { buildOpponentPrompt } from './prompt';
import { serializeVersusMatch } from './serialize';
import { MAX_VERSUS_TICKS, type VersusSseEvent } from './types';

type VersusDb = {
  select: () => any;
  update: (table: unknown) => any;
};

function lastTestFeedbackFromThinking(thinking: string): string | null {
  const idx = thinking.lastIndexOf('[Test Results]');
  if (idx < 0) return null;
  return thinking.slice(idx);
}

function parseTests(raw: string | null | undefined): Array<{ input: string; expectedOutput: string; hint?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistMatch(
  db: VersusDb,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await db.update(versusMatches).set(patch).where(eq(versusMatches.id, id));
}

async function reloadMatch(db: VersusDb, id: string): Promise<VersusMatch | null> {
  const rows = await (db as { select: () => { from: (t: unknown) => { where: (c: unknown) => { limit: (n: number) => Promise<VersusMatch[]> } } } })
    .select()
    .from(versusMatches)
    .where(eq(versusMatches.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function runOpponentTick(opts: {
  env: Env;
  db: VersusDb;
  match: VersusMatch;
  challenge: Challenge;
  emit: (event: VersusSseEvent) => void;
}): Promise<{ match: VersusMatch; continue: boolean }> {
  const { env, db, challenge, emit } = opts;
  let match = opts.match;

  const fresh = await reloadMatch(db, match.id);
  if (fresh) match = fresh;

  if (match.winner) {
    const status = match.winner === 'user' ? 'aborted' : match.opponentStatus;
    if (!match.finishedAt || match.opponentStatus !== status) {
      await persistMatch(db, match.id, {
        opponentStatus: status,
        finishedAt: match.finishedAt ?? new Date().toISOString(),
      });
      const next = await reloadMatch(db, match.id);
      if (next) match = next;
    }
    emit({ type: 'done', match: serializeVersusMatch(match), continue: false });
    return { match, continue: false };
  }

  if ((match.opponentIteration ?? 0) >= MAX_VERSUS_TICKS || match.opponentStatus === 'failed') {
    const finishedAt = match.finishedAt ?? new Date().toISOString();
    await persistMatch(db, match.id, {
      opponentStatus: 'failed',
      finishedAt,
    });
    const next = (await reloadMatch(db, match.id)) ?? match;
    emit({ type: 'done', match: serializeVersusMatch({ ...next, opponentStatus: 'failed', finishedAt }), continue: false });
    return { match: { ...next, opponentStatus: 'failed', finishedAt }, continue: false };
  }

  const language = (challenge.language || 'javascript') as SupportedLanguage;
  const currentCode = match.opponentCode || challenge.starterCode || '';
  const isFollowUp = (match.opponentIteration ?? 0) > 0;
  const hiddenTests = parseTests(challenge.hiddenTestCases);
  const publicTests = parseTests(challenge.testCases);

  const system = buildOpponentPrompt({
    challengeTitle: challenge.title,
    challengeDescription: challenge.description,
    challengeDifficulty: challenge.difficulty,
    language,
    currentCode,
    testCases: challenge.testCases,
    hiddenTestCount: hiddenTests.length,
    lastTestFeedback: lastTestFeedbackFromThinking(match.opponentThinking ?? ''),
    isFollowUp,
    useStdin: !!challenge.useStdin,
  });

  await persistMatch(db, match.id, { opponentStatus: 'thinking' });
  emit({ type: 'status', status: 'thinking', teaser: 'figuring out the puzzle…' });

  let thinking = match.opponentThinking ?? '';
  let answer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const gen = streamCloudflareAIWithFallback(
      env,
      match.opponentModel,
      [
        { role: 'system', content: system },
        { role: 'user', content: isFollowUp ? 'Fix the failing tests. Output SEARCH/REPLACE or a full file.' : 'Solve this challenge. Output SEARCH/REPLACE or a full file.' },
      ],
      { maxTokens: 2048, temperature: 0.2 },
      undefined,
      true,
    );

    let next = await gen.next();
    while (!next.done) {
      const chunk = next.value;
      if (chunk.phase === 'thinking' && chunk.text) {
        thinking += chunk.text;
        emit({ type: 'thinking', content: chunk.text });
      } else if (chunk.text) {
        answer += chunk.text;
        emit({ type: 'chunk', content: chunk.text });
      }
      next = await gen.next();
    }
    inputTokens = next.value.inputTokens;
    outputTokens = next.value.outputTokens;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Opponent model failed';
    thinking += `\n[error] ${message}\n`;
    const iteration = (match.opponentIteration ?? 0) + 1;
    const cost = (match.opponentCost ?? 0);
    const failed = iteration >= MAX_VERSUS_TICKS;
    await persistMatch(db, match.id, {
      opponentThinking: thinking,
      opponentIteration: iteration,
      opponentStatus: failed ? 'failed' : 'queued',
      finishedAt: failed ? new Date().toISOString() : match.finishedAt,
    });
    const afterErr = (await reloadMatch(db, match.id)) ?? match;
    emit({ type: 'error', error: message });
    emit({ type: 'done', match: serializeVersusMatch(afterErr), continue: !failed && !afterErr.winner });
    return { match: afterErr, continue: !failed && !afterErr.winner };
  }

  const tickCost = calculateCost(match.opponentModel, inputTokens, outputTokens);
  thinking += answer ? `\n${answer}\n` : '';

  await persistMatch(db, match.id, {
    opponentStatus: 'writing',
    opponentThinking: thinking,
    opponentCost: (match.opponentCost ?? 0) + tickCost,
    opponentInputTokens: (match.opponentInputTokens ?? 0) + inputTokens,
    opponentOutputTokens: (match.opponentOutputTokens ?? 0) + outputTokens,
  });
  emit({ type: 'status', status: 'writing', teaser: 'writing code…' });

  const applied = applyCodeFromResponse(answer, currentCode, language, 'agent');
  const nextCode = applied.applied ? applied.newCode : currentCode;

  await persistMatch(db, match.id, { opponentCode: nextCode, opponentStatus: 'testing' });
  emit({ type: 'status', status: 'testing', teaser: 'running tests…' });

  const raced = await reloadMatch(db, match.id);
  if (raced?.winner) {
    emit({ type: 'done', match: serializeVersusMatch(raced), continue: false });
    return { match: raced, continue: false };
  }

  const codeToRun = assembleVersusCode(nextCode, language, challenge);
  const judgeOpts = {
    cpuTimeLimit: Math.ceil((challenge.execTimeLimit ?? 5000) / 1000),
    memoryLimit: (challenge.execMemoryLimit ?? 256) * 1024,
    mainFunction: challenge.testHarness ? 'solve' : undefined,
    useStdin: !!challenge.useStdin,
  };

  const publicResult = await runTestCases(env, codeToRun, language, publicTests, judgeOpts);
  const feedback = formatTestResultsForMessage({
    passed: publicResult.passed,
    passedTests: publicResult.passedTests,
    totalTests: publicResult.totalTests,
    results: publicResult.results.map((r) => ({
      passed: r.passed,
      input: r.input,
      expectedOutput: r.expectedOutput,
      actualOutput: r.actualOutput,
      error: r.error,
    })),
  });
  thinking += `\n${feedback}\n`;

  const iteration = (match.opponentIteration ?? 0) + 1;

  if (publicResult.passed) {
    const hiddenResult = hiddenTests.length > 0
      ? await runTestCases(env, codeToRun, language, [...publicTests, ...hiddenTests], judgeOpts)
      : publicResult;

    if (hiddenResult.passed) {
      const now = new Date().toISOString();
      const latest = await reloadMatch(db, match.id);
      if (latest?.winner) {
        emit({ type: 'done', match: serializeVersusMatch(latest), continue: false });
        return { match: latest, continue: false };
      }
      await persistMatch(db, match.id, {
        opponentStatus: 'passed',
        opponentCode: nextCode,
        opponentThinking: thinking,
        opponentIteration: iteration,
        opponentPassedAt: now,
        winner: 'opponent',
        finishedAt: now,
      });
      const won = (await reloadMatch(db, match.id)) ?? match;
      emit({ type: 'status', status: 'passed', teaser: 'submitted a solution' });
      emit({ type: 'done', match: serializeVersusMatch(won), continue: false });
      return { match: won, continue: false };
    }

    thinking += `\n[Hidden tests] ${hiddenResult.passedTests}/${hiddenResult.totalTests} passed.\n`;
  }

  const exhausted = iteration >= MAX_VERSUS_TICKS;
  await persistMatch(db, match.id, {
    opponentCode: nextCode,
    opponentThinking: thinking,
    opponentIteration: iteration,
    opponentStatus: exhausted ? 'failed' : 'queued',
    finishedAt: exhausted ? new Date().toISOString() : null,
  });
  const after = (await reloadMatch(db, match.id)) ?? match;
  emit({ type: 'done', match: serializeVersusMatch(after), continue: !exhausted && !after.winner });
  return { match: after, continue: !exhausted && !after.winner };
}
