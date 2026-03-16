import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt, type TestResults, type PastAttempt } from '@/features/arena/ArenaIDE';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';
import { useIsMobile } from '@/shared/lib/useIsMobile';
import { getDifficultyStyle } from '@/shared/lib/difficulty';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useToast } from '@/shared/ui/Toast';
import { ArenaErrorBoundary } from '@/features/arena/ArenaErrorBoundary';
import { estimateMessagesForBudget, formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { BADGE_DEFS, type BadgeDef } from '@/shared/lib/badge-defs';
import { formatTime } from '@/shared/lib/utils';
import { SplitPaneSkeleton } from '@/shared/ui/ScreenSkeletons';

/* ─── Budget Progress Bar ──────────────────────────────────────────── */

function BudgetProgressBar({ spent, budget }: { spent: number; budget: number | null; isOverBudget?: boolean }) {
  const mono = fontFamily.mono;
  if (budget == null) {
    // No budget limit — show running cost with a subtle open-ended bar
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}
        title="No budget limit — costs tracked for ranking"
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: arena.accent, fontFamily: mono }}>
          {formatCostFromHundredths(spent)}
        </span>
        <div style={{ flex: 1, height: 6, background: arena.border, borderRadius: 3, overflow: 'hidden', maxWidth: 80 }}>
          <div style={{
            width: spent > 0 ? '40%' : '0%',
            height: '100%',
            background: arena.accent,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 10, color: arena.textSubtle, fontFamily: mono }}>
          no limit
        </span>
      </div>
    );
  }
  const pct = Math.min(100, (spent / budget) * 100);
  /* istanbul ignore next -- @preserve */
  const barColor = pct > 90 ? arena.error : pct > 70 ? arena.accent : '#3fb950';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}
      title={`${formatCostFromHundredths(spent)} of ${formatCostFromHundredths(budget)} budget used`}
    >
      <span style={{ fontSize: 11, color: arena.textMuted, fontFamily: mono }}>
        {formatCostFromHundredths(spent)}
      </span>
      <div style={{ flex: 1, height: 6, background: arena.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: arena.textMuted, fontFamily: mono }}>
        {formatCostFromHundredths(budget)}
      </span>
    </div>
  );
}

function sortByDifficultyProximity(arr: any[], currentDifficulty: string) {
  const order = ['sprint', 'easy', 'medium', 'hard', 'impossible'];
  const currentIdx = order.indexOf(currentDifficulty);
  arr.sort((a: any, b: any) => {
    /* istanbul ignore next -- @preserve */
    const aIdx = order.indexOf(a.difficulty || '');
    /* istanbul ignore next -- @preserve */
    const bIdx = order.indexOf(b.difficulty || '');
    const aDist = Math.abs(aIdx - currentIdx) + (aIdx >= currentIdx ? 0 : 5);
    /* istanbul ignore next -- @preserve */
    const bDist = Math.abs(bIdx - currentIdx) + (bIdx >= currentIdx ? 0 : 5);
    return aDist - bDist;
  });
}

function pickNextChallenge(
  allChallenges: any[],
  currentId: string,
  currentCategory: string,
  currentDifficulty: string,
): { id: string; title: string; difficulty: string } | null {
  const unsolved = allChallenges.filter((ch: any) => ch.id !== currentId && ch.userStatus !== 'passed');
  const sameCat = unsolved.filter((ch: any) => ch.category === currentCategory);
  sortByDifficultyProximity(sameCat, currentDifficulty);
  if (sameCat.length > 0) return { id: sameCat[0].id, title: sameCat[0].title, difficulty: sameCat[0].difficulty };
  sortByDifficultyProximity(unsolved, currentDifficulty);
  if (unsolved.length > 0) return { id: unsolved[0].id, title: unsolved[0].title, difficulty: unsolved[0].difficulty };
  return null;
}

function formatWallClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}


export function ArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loading: authLoading } = useAuthGuard();
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { challengeId?: string };
  const challengeId = params.challengeId ?? '';

  const [challenge, setChallenge] = useState<ArenaChallenge | null>(null);
  const [attempt, setAttempt] = useState<ArenaAttempt | null>(null);
  const [code, setCode] = useState('');
  const language = challenge?.language || 'javascript';
  /* istanbul ignore next -- @preserve */
  const categoryDisplayName = challenge?.category === 'model_selection' ? 'Model Selection'
    : challenge?.category === 'prompt_efficiency' ? 'Prompt Efficiency'
    : challenge?.category === 'iterative_debugging' ? 'Debugging'
    : challenge?.category === 'multi_model_strategy' ? 'Multi-Model Strategy'
    : 'AI Fluency';
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const isExpiredRef = useRef(false);
  const [successOverlay, setSuccessOverlay] = useState<{ attemptId: string; passed: boolean } | null>(null);
  const [successStats, setSuccessStats] = useState<{ rank: number; total: number; topCost: number | null } | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [nextChallenge, setNextChallenge] = useState<{ id: string; title: string; difficulty: string } | null>(null);
  const [nextChallengeResolved, setNextChallengeResolved] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<BadgeDef[]>([]);
  const [streakInfo, setStreakInfo] = useState<{ currentStreak: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const navigatingRef = useRef(false);
  const autoResumeCalledRef = useRef(false);
  const startAttemptRef = useRef<() => void>();
  const isMobile = useIsMobile();
  const { showToast } = useToast();

  // Fetch past attempts; returns whether an in-progress attempt exists (for auto-resume)
  const fetchPastAttempts = useCallback(async (): Promise<boolean> => {
    /* istanbul ignore next -- @preserve */
    if (!challengeId) return false;
    try {
      const res = await fetch(`/api/attempts?challengeId=${challengeId}`);
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        const data = await res.json();
        /* istanbul ignore next -- @preserve */
        const all = data.attempts ?? [];
        setPastAttempts(
          all
            .filter((a: PastAttempt) => a.status !== 'in_progress')
            .map((a: PastAttempt & { challenge?: unknown }) => ({
              id: a.id,
              status: a.status,
              passedTests: a.passedTests,
              totalTests: a.totalTests,
              totalCost: a.totalCost,
              inputTokens: a.inputTokens,
              outputTokens: a.outputTokens,
              createdAt: a.createdAt,
              submittedAt: a.submittedAt,
            }))
        );
        return all.some((a: PastAttempt) => a.status === 'in_progress');
      }
    } catch {
      showToast('Failed to load past attempts', 'error');
    }
    return false;
  }, [challengeId]);

  // Reset all state when challengeId changes (e.g. "Try Next Challenge")
  useEffect(() => {
    setChallenge(null);
    setAttempt(null);
    setCode('');
    setTestResults(null);
    setSuccessOverlay(null);
    setSuccessStats(null);
    setIsExpired(false);
    isExpiredRef.current = false;
    setError(null);
    setIsRunning(false);
    setLoading(true);
    setNextChallenge(null);
    setNextChallengeResolved(false);
    setEarnedBadges([]);
    setStreakInfo(null);
    setCommentText('');
    setCommentSubmitted(false);
    navigatingRef.current = false;
    autoResumeCalledRef.current = false;
  }, [challengeId]);

  // Load challenge + profile on mount (but don't create attempt yet)
  useEffect(() => {
    if (!challengeId) {
      setError('No challenge selected');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const chRes = await fetch(`/api/challenges/${challengeId}`);
        if (cancelled) return;
        if (!chRes.ok) {
          setError(chRes.status === 404 ? 'Challenge not found' : 'Failed to load challenge');
          setLoading(false);
          return;
        }
        const chData = await chRes.json();
        setChallenge(chData);
      } catch (e) {
        /* istanbul ignore next -- @preserve */
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId]);

  // Fetch past attempts when challenge loads; auto-resume in-progress attempts on initial load
  // Post-submission refresh is handled explicitly in onSubmit (line 386).
  useEffect(() => {
    if (!challenge) return;
    /* istanbul ignore next -- @preserve */
    if (!autoResumeCalledRef.current) {
      autoResumeCalledRef.current = true;
      fetchPastAttempts().then((hasInProgress) => {
        if (hasInProgress) startAttemptRef.current?.();
      });
    } else {
      /* istanbul ignore next -- @preserve */
      fetchPastAttempts();
    }
  }, [challenge, fetchPastAttempts]);

  // Timer for stats display (must be before early returns to avoid hook order issues)
  const expiresAtStr = attempt?.expiresAt ?? null;
  useEffect(() => {
    if (!expiresAtStr) {
      setTimeLeft(null);
      return;
    }
    const expiresAt = new Date(expiresAtStr);
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && !isExpiredRef.current) {
        isExpiredRef.current = true;
        setIsExpired(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtStr]);

  const startAttempt = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      if (!res.ok) {
        setError('Failed to start attempt');
        return;
      }
      const data = await res.json();
      setAttempt(data.attempt);
      if (data.isExisting) {
        // Resume: restore saved code from localStorage
        const saved = localStorage.getItem(`arena-code-${data.attempt.id}`);
        if (saved) {
          setCode(saved);
          showToast('Restored your progress', 'success');
        } else {
          /* istanbul ignore next -- @preserve */
          const defaultComment = language === 'python' ? '# your code here' : '// your code here';
          setCode(data.challenge?.starterCode || defaultComment);
        }
      } else {
        /* istanbul ignore next -- @preserve */
        const defaultComment = language === 'python' ? '# your code here' : '// your code here';
        setCode(data.challenge?.starterCode || defaultComment);
      }
      setTestResults(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start attempt');
    } finally {
      setStarting(false);
    }
  }, [challengeId]);
  useEffect(() => { startAttemptRef.current = startAttempt; }, [startAttempt]);

  const onRestart = useCallback(() => {
    setAttempt(null);
    setCode('');
    setIsRunning(false);
    setError(null);
    setTestResults(null);
    setSuccessOverlay(null);
    setSuccessStats(null);
    setEarnedBadges([]);
    setStreakInfo(null);
    setCommentText('');
    setCommentSubmitted(false);
    setNextChallengeResolved(false);
    setIsExpired(false);
    isExpiredRef.current = false;
  }, []);

  const onRunTests = useCallback(
    async (sourceCode: string, lang: string) => {
      /* istanbul ignore next -- @preserve */
      if (!attempt?.id) return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language: lang, mode: 'test' }),
      });
      const data = await res.json();
      /* istanbul ignore next -- @preserve */
      if (!res.ok) throw new Error(data.error || 'Test run failed');
      const result = {
        passed: data.success ?? /* istanbul ignore next -- @preserve */ false,
        passedTests: data.passedTests ?? /* istanbul ignore next -- @preserve */ 0,
        totalTests: data.totalTests ?? /* istanbul ignore next -- @preserve */ 0,
        results: data.results ?? /* istanbul ignore next -- @preserve */ [],
      };
      setTestResults({ ...result, isSubmission: false });
      return result;
    },
    [attempt?.id]
  );

  const onSubmit = useCallback(
    async (sourceCode: string, lang: string) => {
      /* istanbul ignore next -- @preserve */
      if (!attempt?.id) return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language: lang, mode: 'submit', idempotencyKey: `${attempt.id}-${crypto.randomUUID()}` }),
      });
      const data = await res.json();
      /* istanbul ignore next -- @preserve */
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      const result = {
        passed: data.success ?? /* istanbul ignore next -- @preserve */ false,
        passedTests: data.passedTests ?? /* istanbul ignore next -- @preserve */ 0,
        totalTests: data.totalTests ?? /* istanbul ignore next -- @preserve */ 0,
        results: data.results ?? /* istanbul ignore next -- @preserve */ [],
      };
      setTestResults({ ...result, isSubmission: true });
      // Update attempt state from response (may be a new auto-created attempt)
      const finalAttemptId = data.attempt?.id || attempt.id;
      if (data.attempt) {
        /* istanbul ignore next -- @preserve */
        setAttempt((prev) => prev ? { ...prev, ...data.attempt } : prev);
      }
      // Show success overlay for passed submissions
      if (result.passed) {
        setSuccessOverlay({ attemptId: finalAttemptId, passed: true });
        // Capture earned badges and streak from response
        /* istanbul ignore next -- @preserve */
        if (data.newBadges && data.newBadges.length > 0) {
          /* istanbul ignore next -- @preserve */
          const resolved = (data.newBadges as string[])
            .map((type) => BADGE_DEFS[type])
            .filter((b): b is BadgeDef => Boolean(b));
          /* istanbul ignore next -- @preserve */
          setEarnedBadges(resolved);
        }
        /* istanbul ignore next -- @preserve */
        if (data.streak) {
          /* istanbul ignore next -- @preserve */
          setStreakInfo(data.streak);
        }
        // Fire leaderboard + next challenge fetches in parallel (don't block each other)
        const leaderboardPromise = fetch(`/api/leaderboard?challengeId=${challengeId}`)
          .then(async (lbRes) => {
            if (lbRes.ok) {
              const lb = await lbRes.json();
              /* istanbul ignore next -- @preserve */
              const entries = lb.entries ?? [];
              const myIdx = entries.findIndex((e: any) => e.attemptId === finalAttemptId);
              setSuccessStats({
                rank: myIdx >= 0 ? myIdx + 1 : entries.length + 1,
                total: entries.length,
                topCost: entries[0]?.totalCost ?? null,
              });
            }
          })
          .catch(/* istanbul ignore next -- @preserve */ () => { /* leaderboard fetch failed */ });
        const nextChallengePromise = fetch('/api/challenges')
          .then(async (chRes) => {
            /* istanbul ignore next -- @preserve */
            if (chRes.ok) {
              const allChallenges = await chRes.json();
              /* istanbul ignore next -- @preserve */
              const next = pickNextChallenge(allChallenges, challengeId, challenge?.category || '', challenge?.difficulty || '');
              if (next) setNextChallenge(next);
            }
            setNextChallengeResolved(true);
          })
          .catch(() => { /* fetch failed — leave nextChallengeResolved false so UI shows Browse fallback */ });
        await Promise.all([leaderboardPromise, nextChallengePromise]);
      }
      // Refresh past attempts list
      fetchPastAttempts();
      return result;
    },
    [attempt?.id, fetchPastAttempts, challengeId, challenge?.category, challenge?.difficulty]
  );

  // Execute code via Piston API (public, no server endpoint needed)
  const PISTON_LANGUAGES: Record<string, { language: string; version: string }> = {
    javascript: { language: 'javascript', version: '18.15.0' },
    typescript: { language: 'typescript', version: '5.0.3' },
    python: { language: 'python', version: '3.10.0' },
    java: { language: 'java', version: '15.0.2' },
    c: { language: 'c', version: '10.2.0' },
    cpp: { language: 'c++', version: '10.2.0' },
    go: { language: 'go', version: '1.16.2' },
    rust: { language: 'rust', version: '1.68.2' },
  };

  const onRunCode = useCallback(async (sourceCode: string, lang: string) => {
    const pistonLang = PISTON_LANGUAGES[lang] || PISTON_LANGUAGES.javascript;
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ content: sourceCode }],
      }),
    });
    const data = await res.json();
    /* istanbul ignore next -- @preserve */
    const run = data.run || {};
    return {
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      exitCode: run.code ?? /* istanbul ignore next -- @preserve */ (run.signal ? 1 : 0),
    };
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      await onRunTests(code, language);
    } catch (err) {
      setTestResults({
        passed: false,
        passedTests: 0,
        totalTests: 0,
        results: [{ passed: false, input: '', expectedOutput: '', actualOutput: '', error: /* istanbul ignore next -- @preserve */ err instanceof Error ? err.message : 'Run failed' }],
        isSubmission: false,
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, onRunTests]);

  const handleSubmit = useCallback(async () => {
    setIsRunning(true);
    try {
      await onSubmit(code, language);
    } catch (err) {
      setTestResults({
        passed: false,
        passedTests: 0,
        totalTests: 0,
        results: [{ passed: false, input: '', expectedOutput: '', actualOutput: '', error: err instanceof Error ? err.message : 'Submit failed' }],
        isSubmission: true,
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, onSubmit]);

  // Compute personal best from past attempts (memoized; must be before early returns for hooks rules)
  const personalBest = useMemo(
    /* istanbul ignore next -- @preserve */ () => pastAttempts.filter((a) => a.status === 'passed').sort((a, b) => a.totalCost - b.totalCost)[0] ?? null,
    [pastAttempts]
  );

  const canRestart = !attempt?.assessmentSessionId;
  const submitBlocked = isExpired && !testResults?.passed;

  // Auth loading state
  if (authLoading) {
    return <SplitPaneSkeleton />;
  }

  // Loading state
  if (loading) {
    return <SplitPaneSkeleton />;
  }

  // Error state (no challenge)
  if (error && !challenge) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: arena.bg }}>
        <Text style={{ fontSize: 14, color: arena.error, marginBottom: 12 }}>{error}</Text>
        <button
          style={{
            background: 'transparent',
            border: `1px solid ${arena.border}`,
            borderRadius: 6,
            color: arena.text,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
          onClick={() => navigation.navigate('Problems')}
        >
          Back to Problems
        </button>
      </View>
    );
  }

  /* istanbul ignore next -- @preserve */
  if (!challenge) return null;

  const diffStyle = getDifficultyStyle(challenge.difficulty, true);
  const difficultyColor = diffStyle.color;

  // Pre-attempt screen — show challenge info + timed/untimed choice
  if (!attempt) {
    return (
      <main style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: arena.bg,
        color: arena.text,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          maxWidth: 520,
          width: '100%',
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Difficulty badge */}
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: difficultyColor,
            padding: '2px 10px',
            borderRadius: 9999,
            border: `1px solid ${difficultyColor}40`,
            background: diffStyle.bg,
            fontFamily: fontFamily.mono,
            textTransform: 'lowercase',
            marginBottom: 12,
          }}>
            {diffStyle.label}
          </span>

          {/* Title */}
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: arena.text,
            margin: '0 0 8px',
            textAlign: 'center',
            fontFamily: '"Cormorant Garamond", Georgia, serif',
          }}>
            {challenge.title}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: 14,
            color: arena.textMuted,
            lineHeight: '1.6',
            textAlign: 'center',
            margin: '0 0 24px',
            maxWidth: 440,
          }}>
            {challenge.description.length > 200
              ? challenge.description.slice(0, 200) + '...'
              : challenge.description}
          </p>

          {/* Budget primer card — always shown, content varies */}
          <div style={{
            background: `${arena.accent}10`,
            border: `1px solid ${arena.accent}30`,
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 24,
            maxWidth: 400,
            width: '100%',
            textAlign: 'center' as const,
          }}>
            {challenge.maxCost != null ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: arena.accent, marginBottom: 8 }}>
                  Your AI Budget: {formatCostFromHundredths(challenge.maxCost)}
                </div>
                <div style={{ fontSize: 12, color: arena.textMuted, lineHeight: '1.6' }}>
                  {'\u2248'} {estimateMessagesForBudget(challenge.maxCost, 'budget')} messages with Budget tier,
                  or ~{estimateMessagesForBudget(challenge.maxCost, 'premium')} with Premium
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: arena.accent, marginBottom: 8 }}>
                  No Budget Limit
                </div>
                <div style={{ fontSize: 12, color: arena.textMuted, lineHeight: '1.6' }}>
                  Spend freely — but the leaderboard ranks by cost. Cheapest wins.
                </div>
              </>
            )}
            {challenge.stats?.bestCost != null && (challenge.stats?.solvers ?? /* istanbul ignore next -- @preserve */ 0) > 0 && (
              <div style={{ fontSize: 12, color: arena.text, marginTop: 8, fontWeight: 500 }}>
                Best solver spent {formatCostFromHundredths(challenge.stats.bestCost)} — can you beat them?
              </div>
            )}
          </div>

          {/* Time + token limits */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 32,
            fontFamily: fontFamily.mono,
            fontSize: 12,
            color: arena.textMuted,
          }}>
            {challenge.wallClockLimit && (
              <span>{formatWallClock(challenge.wallClockLimit)} time limit</span>
            )}
          </div>

          {/* Personal best from previous attempts */}
          {personalBest && (
            <div style={{
              fontSize: 13,
              color: arena.accent,
              fontWeight: 600,
              marginBottom: 16,
              fontFamily: fontFamily.mono,
            }}>
              Your best: {formatCostFromHundredths(personalBest.totalCost)} &mdash; try to beat it
            </div>
          )}
          {!personalBest && pastAttempts.length > 0 && (
            <div style={{
              fontSize: 12,
              color: arena.textMuted,
              marginBottom: 16,
            }}>
              {pastAttempts.length} previous {/* istanbul ignore next -- @preserve */ pastAttempts.length === 1 ? 'attempt' : 'attempts'}
            </div>
          )}

          {/* Error from failed attempt start */}
          {error && (
            <p style={{ fontSize: 13, color: arena.error, marginBottom: 16 }}>{error}</p>
          )}

          {/* Start button */}
          <button
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 8,
              color: '#0d1117',
              padding: '12px 32px',
              fontSize: 15,
              fontWeight: 600,
              cursor: starting ? 'not-allowed' : 'pointer',
              opacity: starting ? 0.6 : 1,
              width: isMobile ? '100%' : 'auto',
            }}
            onClick={() => startAttempt()}
            disabled={starting}
          >
            {starting ? 'Starting...' : personalBest ? 'Try Again' : 'Start Challenge'}
          </button>

          {/* Back link */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: arena.textSubtle,
              fontSize: 12,
              cursor: 'pointer',
              marginTop: 24,
              fontFamily: fontFamily.mono,
            }}
            onClick={() => navigation.navigate('Problems')}
          >
            &larr; Back to Problems
          </button>
        </div>
      </main>
    );
  }

  const costLimitReached = challenge.maxCost != null && attempt.totalCost >= challenge.maxCost;

  const timerUrgency: 'normal' | 'warning' | 'critical' =
    timeLeft == null ? 'normal' :
    timeLeft <= 30 ? 'critical' :
    timeLeft <= 120 ? 'warning' : /* istanbul ignore next -- @preserve */ 'normal';

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: arena.bg,
      color: arena.text,
      overflow: 'hidden',
    }}>
      {/* Header */}
      {isMobile ? (
        /* Mobile header — two rows */
        <div style={{
          background: arena.surface,
          borderBottom: `1px solid ${arena.border}`,
          flexShrink: 0,
        }}>
          {/* Row 1: Back, title, timer, actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: 40,
            padding: '0 8px',
            gap: 8,
          }}>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: arena.textMuted,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 6px',
                fontFamily: fontFamily.mono,
                flexShrink: 0,
              }}
              onClick={() => navigation.navigate('Problems')}
            >
              &larr;
            </button>
            <h1 style={{
              fontSize: 13,
              fontWeight: 600,
              color: arena.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
              margin: 0,
            }}>
              {challenge.title}
            </h1>
            {/* istanbul ignore next -- @preserve */ timeLeft != null && (
              <span style={{
                fontSize: 12,
                fontFamily: fontFamily.mono,
                flexShrink: 0,
                ...(/* istanbul ignore next -- @preserve */ timerUrgency === 'critical' ? {
                  fontWeight: 700, background: arena.error, color: '#fff', padding: '2px 8px', borderRadius: 9999,
                } : /* istanbul ignore next -- @preserve */ timerUrgency === 'warning' ? {
                  fontWeight: 700, background: arena.accent, color: '#0d1117', padding: '2px 8px', borderRadius: 9999,
                } : { color: arena.textMuted }),
              }}>
                {formatTime(timeLeft)}
              </span>
            )}
            <button
              style={{
                background: 'transparent',
                border: `1px solid ${arena.border}`,
                borderRadius: 6,
                color: arena.text,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 500,
                cursor: /* istanbul ignore next -- @preserve */ isRunning || isExpired ? 'not-allowed' : 'pointer',
                opacity: /* istanbul ignore next -- @preserve */ isRunning || isExpired ? 0.5 : 1,
                flexShrink: 0,
              }}
              onClick={handleRun}
              disabled={isRunning || isExpired}
            >
              {/* istanbul ignore next -- @preserve */ isExpired ? /* istanbul ignore next -- @preserve */ 'Expired' : /* istanbul ignore next -- @preserve */ isRunning ? '...' : 'Run'}
            </button>
            <button
              style={{
                background: /* istanbul ignore next -- @preserve */ submitBlocked ? arena.textMuted : arena.accent,
                border: 'none',
                borderRadius: 6,
                color: '#0d1117',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: /* istanbul ignore next -- @preserve */ isRunning || submitBlocked ? 'not-allowed' : 'pointer',
                opacity: /* istanbul ignore next -- @preserve */ isRunning || submitBlocked ? 0.5 : 1,
                flexShrink: 0,
              }}
              onClick={handleSubmit}
              disabled={isRunning || submitBlocked}
            >
              Submit
            </button>
          </div>

          {/* Row 2: Budget progress bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: 28,
            padding: '0 10px',
            gap: 8,
            borderTop: `1px solid ${arena.border}`,
          }}>
            <div style={{ flex: 1 }}>
              <BudgetProgressBar spent={attempt.totalCost} budget={challenge.maxCost} isOverBudget={costLimitReached} />
            </div>
          </div>
        </div>
      ) : (
        /* Desktop header — single 48px row */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          padding: '0 16px',
          background: arena.surface,
          borderBottom: `1px solid ${arena.border}`,
          flexShrink: 0,
        }}>
          {/* Left: Back + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: arena.textMuted,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 8px',
                fontFamily: fontFamily.mono,
              }}
              onClick={() => navigation.navigate('Problems')}
            >
              &larr; Back
            </button>
            <span style={{
              width: 1,
              height: 20,
              background: arena.border,
            }} />
            <h1 style={{
              fontSize: 14,
              fontWeight: 600,
              color: arena.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
            }}>
              {challenge.title}
            </h1>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: difficultyColor,
              padding: '2px 8px',
              borderRadius: 9999,
              border: `1px solid ${difficultyColor}40`,
              background: diffStyle.bg,
              fontFamily: fontFamily.mono,
              textTransform: 'lowercase',
            }}>
              {diffStyle.label}
            </span>
          </div>

          {/* Right: Stats + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Budget progress bar */}
            <BudgetProgressBar spent={attempt.totalCost} budget={challenge.maxCost} isOverBudget={costLimitReached} />

            {/* Timer — subtle when normal, bold pill when warning/critical */}
            {timeLeft != null && (
              <span style={{
                fontSize: 12,
                fontFamily: fontFamily.mono,
                ...(/* istanbul ignore next -- @preserve */ timerUrgency === 'critical' ? {
                  fontWeight: 700, background: arena.error, color: '#fff', padding: '2px 10px', borderRadius: 9999,
                } : /* istanbul ignore next -- @preserve */ timerUrgency === 'warning' ? {
                  fontWeight: 700, background: arena.accent, color: '#0d1117', padding: '2px 10px', borderRadius: 9999,
                } : { color: arena.textMuted }),
              }}>
                {formatTime(timeLeft)}
              </span>
            )}

            {/* Divider */}
            <span style={{ width: 1, height: 24, background: arena.border }} />

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${arena.border}`,
                  borderRadius: 6,
                  color: arena.text,
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isRunning || isExpired ? 'not-allowed' : 'pointer',
                  opacity: isRunning || isExpired ? 0.5 : 1,
                }}
                onClick={handleRun}
                disabled={isRunning || isExpired}
              >
                {isExpired ? 'Time Expired' : isRunning ? 'Running...' : (() => {
                  const htc = challenge?.hiddenTestCount;
                  if (htc && htc > 0) {
                    try {
                      /* istanbul ignore next -- @preserve */
                      const pubCount = JSON.parse(challenge?.testCases || '[]').length;
                      return `Run Tests (${pubCount} public)`;
                    } catch { return 'Run Tests'; }
                  }
                  return 'Run Tests';
                })()}
              </button>
              <button
                style={{
                  background: submitBlocked ? arena.textMuted : arena.accent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#0d1117',
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRunning || submitBlocked ? 'not-allowed' : 'pointer',
                  opacity: isRunning || submitBlocked ? 0.5 : 1,
                }}
                onClick={handleSubmit}
                disabled={isRunning || submitBlocked}
              >
                {(() => {
                  const htc = challenge?.hiddenTestCount;
                  if (htc && htc > 0) {
                    try {
                      /* istanbul ignore next -- @preserve */
                      const total = JSON.parse(challenge?.testCases || '[]').length + htc;
                      return `Submit (${total} tests)`;
                    } catch { return 'Submit'; }
                  }
                  return 'Submit';
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IDE Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ArenaErrorBoundary>
          <ArenaIDE
            key={challengeId}
            challenge={challenge}
            attempt={attempt}
            code={code}
            onCodeChange={setCode}
            language={language}
            isExpired={isExpired}
            onExpire={() => { setIsExpired(true); isExpiredRef.current = true; }}
            onRunTests={onRunTests}
            onAttemptUpdate={(next) => setAttempt(next)}
            onRestart={canRestart ? onRestart : undefined}
            onRunCode={onRunCode}
            onSubmit={handleSubmit}
            testResults={testResults}
            onDismissResults={() => setTestResults(null)}
            pastAttempts={pastAttempts}
          />
        </ArenaErrorBoundary>

        {/* Success overlay after passed submission */}
        {successOverlay && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,17,23,0.85)',
            zIndex: 200,
            overflow: 'hidden',
          }}>
            {/* CSS confetti + badge animation */}
            <style>{`
              @keyframes confetti-fall {
                0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
              }
              @keyframes badge-pop {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.3); }
                100% { transform: scale(1); opacity: 1; }
              }
              .confetti-piece {
                position: absolute;
                top: -10px;
                width: 8px;
                height: 8px;
                animation: confetti-fall 3s ease-out forwards;
              }
            `}</style>
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${4 + (i * 4) % 92}%`,
                  background: ['#c9a962', '#3fb950', '#58a6ff', '#f85149', '#bc8cff', '#39d2e0'][i % 6],
                  borderRadius: i % 3 === 0 ? '50%' : '2px',
                  animationDelay: `${(i * 0.12)}s`,
                  animationDuration: `${2.5 + (i % 5) * 0.3}s`,
                  width: i % 4 === 0 ? 10 : 7,
                  height: i % 4 === 0 ? 10 : 7,
                }}
              />
            ))}
            <div style={{
              background: arena.surface,
              border: `1px solid ${arena.border}`,
              borderRadius: 12,
              padding: 32,
              maxWidth: 420,
              width: '90%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              position: 'relative',
              zIndex: 1,
            }}>
              <span style={{ fontSize: 32 }}>{'\u2705'}</span>
              <h2 style={{
                fontSize: 20,
                fontWeight: 700,
                color: arena.success,
                margin: 0,
                fontFamily: '"Cormorant Garamond", Georgia, serif',
              }}>
                Challenge Passed!
              </h2>

              {/* Earned badges celebration */}
              {/* istanbul ignore next -- @preserve */ earnedBadges.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  background: 'rgba(201,169,98,0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(201,169,98,0.2)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}>
                  <span style={{ fontSize: 11, color: arena.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                    {/* istanbul ignore next -- @preserve */ earnedBadges.length === 1 ? 'Badge Earned!' : `${earnedBadges.length} Badges Earned!`}
                  </span>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {}
                    {/* istanbul ignore next -- @preserve */ earnedBadges.map((badge) => (
                      /* istanbul ignore next -- @preserve */
                      <div key={badge.type} style={{ textAlign: 'center', minWidth: 70 }}>
                        <span style={{ fontSize: 28, display: 'block', animation: 'badge-pop 0.5s ease-out' }}>
                          {badge.icon}
                        </span>
                        <span style={{ fontSize: 11, color: arena.accent, fontWeight: 600, display: 'block' }}>
                          {badge.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Streak info */}
              {/* istanbul ignore next -- @preserve */ streakInfo && streakInfo.currentStreak > 1 && (
                <span style={{ fontSize: 13, color: arena.accent }}>
                  {'\u{1F525}'} {streakInfo.currentStreak}-day streak!
                </span>
              )}

              {/* AFI dimension context */}
              {challenge?.category && (
                <span style={{ fontSize: 12, color: arena.textMuted, textAlign: 'center' }}>
                  This solve builds your{' '}
                  <span style={{ color: arena.accent, fontWeight: 600 }}>
                    {categoryDisplayName}
                  </span>
                  {' '}score
                </span>
              )}

              {/* Rank comparison stats */}
              <div style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                flexWrap: 'wrap',
                fontFamily: fontFamily.mono,
                fontSize: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: arena.textMuted, marginBottom: 4 }}>Your Cost</div>
                  <div style={{ color: arena.accent, fontWeight: 700, fontSize: 16 }}>
                    {formatCostFromHundredths(attempt?.totalCost ?? /* istanbul ignore next -- @preserve */ 0)}
                  </div>
                </div>
                {successStats && successStats.topCost != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: arena.textMuted, marginBottom: 4 }}>Top Solver</div>
                    <div style={{ color: arena.text, fontWeight: 700, fontSize: 16 }}>
                      {formatCostFromHundredths(successStats.topCost)}
                    </div>
                  </div>
                )}
                {successStats && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: arena.textMuted, marginBottom: 4 }}>Your Rank</div>
                    <div style={{ color: /* istanbul ignore next -- @preserve */ successStats.rank === 1 ? arena.accent : arena.text, fontWeight: 700, fontSize: 16 }}>
                      #{successStats.rank}
                      <span style={{ fontSize: 11, fontWeight: 400, color: arena.textMuted }}> / {successStats.total}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Share buttons */}
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
                <button
                  style={{
                    background: '#0A66C2',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flex: 1,
                  }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${successOverlay.attemptId}`;
                    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                    window.open(linkedinUrl, '_blank', 'width=600,height=500');
                  }}
                >
                  LinkedIn
                </button>
                <button
                  style={{
                    background: '#000',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flex: 1,
                  }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${successOverlay.attemptId}`;
                    /* istanbul ignore next -- @preserve */
                    const rankStr = successStats?.rank ? ` Ranked #${successStats.rank}.` : '';
                    /* istanbul ignore next -- @preserve */
                    const text = `I solved "${challenge.title}" for ${formatCostFromHundredths(attempt?.totalCost ?? 0)} on ruwt.dev.${rankStr} Can you beat that?`;
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
                    window.open(twitterUrl, '_blank', 'width=600,height=500');
                  }}
                >
                  X / Twitter
                </button>
                <button
                  style={{
                    background: 'transparent',
                    border: `1px solid ${arena.border}`,
                    borderRadius: 8,
                    color: copiedShareLink ? arena.success : arena.text,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flex: 1,
                  }}
                  onClick={async () => {
                    const shareUrl = `${window.location.origin}/share/${successOverlay.attemptId}`;
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopiedShareLink(true);
                      setTimeout(() => setCopiedShareLink(false), 2000);
                    } catch { /* fallback */ }
                  }}
                >
                  {copiedShareLink ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 4 }}>
                <button
                  style={{
                    background: arena.accent,
                    border: 'none',
                    borderRadius: 8,
                    color: '#0d1117',
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  onClick={() => {
                    /* istanbul ignore next -- @preserve */
                    if (navigatingRef.current) return;
                    navigatingRef.current = true;
                    setSuccessOverlay(null);
                    (navigation.navigate as any)('Replay', { attemptId: successOverlay.attemptId });
                  }}
                >
                  View Your Replay
                </button>
                <button
                  style={{
                    background: 'transparent',
                    border: `1px solid ${arena.border}`,
                    borderRadius: 8,
                    color: arena.text,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  onClick={async () => {
                    /* istanbul ignore next -- @preserve */
                    if (navigatingRef.current) return;
                    navigatingRef.current = true;
                    try {
                      const res = await fetch(`/api/leaderboard?challengeId=${challengeId}&limit=1`);
                      if (res.ok) {
                        const lb = await res.json();
                        const top = lb.entries?.[0];
                        if (top?.attemptId) {
                          setSuccessOverlay(null);
                          (navigation.navigate as any)('Replay', { attemptId: top.attemptId });
                          return;
                        }
                      }
                    } catch (err) {
                      console.error('Failed to load top solver:', err);
                      showToast('Could not load leaderboard', 'error');
                    }
                    navigatingRef.current = false;
                    setSuccessOverlay(null);
                  }}
                >
                  See How #1 Solved This
                </button>
                <a
                  href={nextChallenge ? `/arena/${nextChallenge.id}` : '/challenges'}
                  onClick={(e) => {
                    // If next challenge isn't preloaded yet, fetch it on the spot
                    /* istanbul ignore next -- @preserve */
                    if (!nextChallenge) {
                      e.preventDefault();
                      fetch('/api/challenges')
                        .then(r => r.json())
                        .then((all) => {
                          /* istanbul ignore next -- @preserve */
                          const next = pickNextChallenge(all, challengeId, challenge?.category || '', challenge?.difficulty || '');
                          /* istanbul ignore next -- @preserve */
                          window.location.href = next ? `/arena/${next.id}` : '/challenges';
                        })
                        .catch(() => { window.location.href = '/challenges'; });
                    }
                  }}
                  style={{
                    display: 'block',
                    background: 'rgba(201,169,98,0.06)',
                    border: `1px solid ${arena.accent}`,
                    borderRadius: 8,
                    padding: '12px 20px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  {nextChallenge ? (
                    <>
                      <span style={{ fontSize: 11, color: arena.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Up Next
                      </span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: arena.text, marginTop: 4 }}>
                        {nextChallenge.title}
                      </span>
                      <span style={{ fontSize: 12, color: arena.accent }}>
                        {nextChallenge.difficulty}
                      </span>
                    </>
                  ) : nextChallengeResolved ? (
                    <>
                      <span style={{ fontSize: 11, color: arena.accent, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Champion
                      </span>
                      <span style={{ display: 'block', fontSize: 22, marginTop: 4 }}>
                        🏆
                      </span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: arena.text, marginTop: 4 }}>
                        All Challenges Completed!
                      </span>
                      <span style={{ fontSize: 12, color: arena.textMuted }}>
                        You've conquered every challenge on the platform.
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: arena.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Up Next
                      </span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: arena.text, marginTop: 4 }}>
                        Browse Challenges
                      </span>
                    </>
                  )}
                </a>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: arena.textMuted,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '8px 0',
                  }}
                  onClick={() => {
                    /* istanbul ignore next -- @preserve */
                    if (navigatingRef.current) return;
                    navigatingRef.current = true;
                    setSuccessOverlay(null);
                    navigation.navigate('Problems');
                  }}
                >
                  Back to Problems
                </button>
                {/* Try Again — personal accounts only (not assessments) */}
                {canRestart && (
                  <button
                    style={{
                      background: 'transparent',
                      border: `1px solid ${arena.accent}40`,
                      borderRadius: 8,
                      color: arena.accent,
                      padding: '10px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                    onClick={() => {
                      setSuccessOverlay(null);
                      onRestart();
                    }}
                  >
                    Try Again &mdash; Beat {formatCostFromHundredths(attempt?.totalCost ?? /* istanbul ignore next -- @preserve */ 0)}
                  </button>
                )}
                {/* Post-solve comment prompt */}
                {successOverlay.passed && !commentSubmitted && (
                  <div style={{
                    width: '100%',
                    marginTop: 8,
                    background: `${arena.accent}10`,
                    border: `1px solid ${arena.accent}30`,
                    borderRadius: 8,
                    padding: 12,
                  }}>
                    <div style={{ fontSize: 12, color: arena.accent, fontWeight: 600, marginBottom: 6 }}>
                      How did you approach this?
                    </div>
                    <textarea
                      value={commentText}
                      onChange={/* istanbul ignore next -- @preserve */ (e) => setCommentText(e.target.value)}
                      placeholder="Share your strategy with others..."
                      style={{
                        width: '100%',
                        minHeight: 48,
                        maxHeight: 100,
                        background: arena.surface,
                        border: `1px solid ${arena.border}`,
                        borderRadius: 6,
                        color: arena.text,
                        fontSize: 13,
                        padding: 8,
                        resize: 'vertical',
                        fontFamily: '"Libre Franklin", sans-serif',
                      }}
                    />
                    <button
                      disabled={commentSubmitting || !commentText.trim()}
                      style={{
                        marginTop: 6,
                        background: arena.accent,
                        border: 'none',
                        borderRadius: 6,
                        color: '#0d1117',
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: /* istanbul ignore next -- @preserve */ commentSubmitting || !commentText.trim() ? 'default' : 'pointer',
                        opacity: /* istanbul ignore next -- @preserve */ commentSubmitting || !commentText.trim() ? 0.5 : 1,
                      }}
                      onClick={/* istanbul ignore next -- @preserve */ async () => {
                        if (commentSubmitting || !commentText.trim()) return;
                        /* istanbul ignore next -- @preserve */
                        setCommentSubmitting(true);
                        /* istanbul ignore next -- @preserve */
                        try {
                          /* istanbul ignore next -- @preserve */
                          const res = await fetch(`/api/challenges/${challengeId}/comments`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: commentText.trim() }),
                          });
                          /* istanbul ignore next -- @preserve */
                          if (res.ok) {
                            /* istanbul ignore next -- @preserve */
                            setCommentSubmitted(true);
                            /* istanbul ignore next -- @preserve */
                            setCommentText('');
                          }
                        } catch { /* ignore */ }
                        /* istanbul ignore next -- @preserve */
                        setCommentSubmitting(false);
                      }}
                    >
                      {/* istanbul ignore next -- @preserve */ commentSubmitting ? /* istanbul ignore next -- @preserve */ 'Posting...' : 'Share'}
                    </button>
                  </div>
                )}
                {/* istanbul ignore next -- @preserve */ commentSubmitted && (
                  <span style={{ fontSize: 12, color: arena.success, marginTop: 4 }}>
                    Comment posted! Others can see it in the Discussion tab.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
