import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt, type TestResults, type PastAttempt } from '@/components/ArenaIDE';
import { arena } from '@/theme/colors';

function formatWallClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatCost(cents: number): string {
  const d = cents / 10000;
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { challengeId?: string };
  const challengeId = params.challengeId ?? '';

  const [challenge, setChallenge] = useState<ArenaChallenge | null>(null);
  const [attempt, setAttempt] = useState<ArenaAttempt | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [code, setCode] = useState('');
  const [language] = useState('javascript');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isExpiredRef = useRef(false);
  const [successOverlay, setSuccessOverlay] = useState<{ attemptId: string; passed: boolean } | null>(null);

  // Fetch past attempts for this challenge
  const fetchPastAttempts = useCallback(async () => {
    if (!challengeId) return;
    try {
      const res = await fetch(`/api/attempts?challengeId=${challengeId}`);
      if (res.ok) {
        const data = await res.json();
        setPastAttempts(
          (data.attempts ?? [])
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
      }
    } catch { /* ignore */ }
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
        const [chRes, profRes] = await Promise.all([
          fetch(`/api/challenges/${challengeId}`),
          fetch('/api/profile'),
        ]);
        if (cancelled) return;
        if (!chRes.ok) {
          setError(chRes.status === 404 ? 'Challenge not found' : 'Failed to load challenge');
          setLoading(false);
          return;
        }
        const chData = await chRes.json();
        setChallenge(chData);
        if (profRes.ok) {
          const prof = await profRes.json();
          setUserCredits(prof.credits ?? 0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId]);

  // Fetch past attempts when challenge loads or after submission
  useEffect(() => {
    if (challenge) fetchPastAttempts();
  }, [challenge, fetchPastAttempts]);

  // Timer for stats display (must be before early returns to avoid hook order issues)
  const expiresAt = attempt?.expiresAt ? new Date(attempt.expiresAt) : null;
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) isExpiredRef.current = true;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt?.getTime()]);

  const startAttempt = useCallback(async (timed: boolean) => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, timed }),
      });
      if (!res.ok) {
        setError('Failed to start attempt');
        return;
      }
      const data = await res.json();
      setAttempt(data.attempt);
      setCode(data.challenge?.starterCode || '// your code here');
      setTestResults(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start attempt');
    } finally {
      setStarting(false);
    }
  }, [challengeId]);

  const onRestart = useCallback(() => {
    setAttempt(null);
    setCode('');
    setIsRunning(false);
    setError(null);
    setTestResults(null);
  }, []);

  const onRunTests = useCallback(
    async (sourceCode: string, lang: string) => {
      if (!attempt?.id) return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language: lang, mode: 'test' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test run failed');
      const result = {
        passed: data.success ?? false,
        passedTests: data.passedTests ?? 0,
        totalTests: data.totalTests ?? 0,
        results: data.results ?? [],
      };
      setTestResults({ ...result, isSubmission: false });
      return result;
    },
    [attempt?.id]
  );

  const onSubmit = useCallback(
    async (sourceCode: string, lang: string) => {
      if (!attempt?.id) return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language: lang, mode: 'submit' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      const result = {
        passed: data.success ?? false,
        passedTests: data.passedTests ?? 0,
        totalTests: data.totalTests ?? 0,
        results: data.results ?? [],
      };
      setTestResults({ ...result, isSubmission: true });
      // Update attempt state from response (may be a new auto-created attempt)
      const finalAttemptId = data.attempt?.id || attempt.id;
      if (data.attempt) {
        setAttempt((prev) => prev ? { ...prev, ...data.attempt } : prev);
      }
      // Show success overlay for passed submissions
      if (result.passed) {
        setSuccessOverlay({ attemptId: finalAttemptId, passed: true });
      }
      // Refresh past attempts list
      fetchPastAttempts();
      return result;
    },
    [attempt?.id, fetchPastAttempts]
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
    const run = data.run || {};
    return {
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      exitCode: run.code ?? (run.signal ? 1 : 0),
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
        results: [{ passed: false, input: '', expectedOutput: '', actualOutput: '', error: err instanceof Error ? err.message : 'Run failed' }],
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

  // Loading state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: arena.bg }}>
        <ActivityIndicator size="large" color={arena.accent} />
        <Text style={{ marginTop: 8, fontSize: 13, color: arena.textMuted }}>Loading arena...</Text>
      </View>
    );
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
          onClick={() => navigation.navigate('Challenges' as never)}
        >
          Back to Challenges
        </button>
      </View>
    );
  }

  if (!challenge) return null;

  const difficultyColor =
    challenge.difficulty === 'easy' ? arena.success :
    challenge.difficulty === 'hard' ? arena.error : arena.accent;

  // Pre-attempt screen — show challenge info + timed/untimed choice
  if (!attempt) {
    return (
      <div style={{
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
            background: `${difficultyColor}15`,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            textTransform: 'lowercase',
            marginBottom: 12,
          }}>
            {challenge.difficulty}
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

          {/* Limits info */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 32,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 12,
            color: arena.textMuted,
          }}>
            {challenge.wallClockLimit && (
              <span>{formatWallClock(challenge.wallClockLimit)} time limit</span>
            )}
            {challenge.maxTokens && (
              <span>{challenge.maxTokens.toLocaleString()} max tokens</span>
            )}
            {challenge.maxCost && (
              <span>${(challenge.maxCost / 10000).toFixed(2)} max cost</span>
            )}
          </div>

          {/* Error from failed attempt start */}
          {error && (
            <p style={{ fontSize: 13, color: arena.error, marginBottom: 16 }}>{error}</p>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              style={{
                background: arena.accent,
                border: 'none',
                borderRadius: 8,
                color: '#0d1117',
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1,
              }}
              onClick={() => startAttempt(true)}
              disabled={starting}
            >
              {starting ? 'Starting...' : 'Start Timed'}
            </button>
            <button
              style={{
                background: 'transparent',
                border: `1px solid ${arena.border}`,
                borderRadius: 8,
                color: arena.textMuted,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 500,
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1,
              }}
              onClick={() => startAttempt(false)}
              disabled={starting}
            >
              Start Untimed
            </button>
          </div>

          <p style={{
            fontSize: 11,
            color: arena.textSubtle,
            marginTop: 12,
            textAlign: 'center',
          }}>
            Untimed attempts are marked separately on the leaderboard
          </p>

          {/* Back link */}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: arena.textSubtle,
              fontSize: 12,
              cursor: 'pointer',
              marginTop: 24,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}
            onClick={() => navigation.navigate('Challenges' as never)}
          >
            &larr; Back to Challenges
          </button>
        </div>
      </div>
    );
  }

  const isUntimed = challenge.wallClockLimit != null && !attempt.expiresAt;
  const totalTokens = (attempt.inputTokens || 0) + (attempt.outputTokens || 0);
  const costLimitReached = challenge.maxCost != null && attempt.totalCost >= challenge.maxCost;
  const tokenLimitReached = challenge.maxTokens != null && totalTokens >= challenge.maxTokens;

  const timerUrgency: 'normal' | 'warning' | 'critical' =
    timeLeft == null ? 'normal' :
    timeLeft <= 30 ? 'critical' :
    timeLeft <= 120 ? 'warning' : 'normal';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: arena.bg,
      color: arena.text,
      overflow: 'hidden',
    }}>
      {/* Header — 48px */}
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
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}
            onClick={() => navigation.navigate('Challenges' as never)}
          >
            &larr; Back
          </button>
          <span style={{
            width: 1,
            height: 20,
            background: arena.border,
          }} />
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: arena.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {challenge.title}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: difficultyColor,
            padding: '2px 8px',
            borderRadius: 9999,
            border: `1px solid ${difficultyColor}40`,
            background: `${difficultyColor}15`,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            textTransform: 'lowercase',
          }}>
            {challenge.difficulty}
          </span>
          {isUntimed && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: arena.textMuted,
              padding: '2px 8px',
              borderRadius: 9999,
              border: `1px solid ${arena.textSubtle}`,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              untimed
            </span>
          )}
        </div>

        {/* Right: Stats + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hero cost */}
          <span style={{
            fontSize: 20,
            fontWeight: 700,
            color: costLimitReached ? arena.error : arena.accent,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}>
            {formatCost(attempt.totalCost)}
          </span>
          <span style={{ fontSize: 11, color: costLimitReached ? arena.error : arena.textMuted }}>
            {costLimitReached ? 'limit reached' : 'spent'}
          </span>

          {/* Token detail with hover popover */}
          <span
            style={{
              fontSize: 11,
              color: tokenLimitReached ? arena.error : arena.textMuted,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              cursor: 'help',
              position: 'relative',
            }}
            title={`Input: ${(attempt.inputTokens || 0).toLocaleString()} | Output: ${(attempt.outputTokens || 0).toLocaleString()} | Total: ${totalTokens.toLocaleString()}`}
          >
            {totalTokens.toLocaleString()} tok
          </span>

          {/* Timer — subtle when normal, bold pill when warning/critical */}
          {timeLeft != null && (
            <span style={{
              fontSize: 12,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              ...(timerUrgency === 'critical' ? {
                fontWeight: 700, background: arena.error, color: '#fff', padding: '2px 10px', borderRadius: 9999,
              } : timerUrgency === 'warning' ? {
                fontWeight: 700, background: arena.accent, color: '#0d1117', padding: '2px 10px', borderRadius: 9999,
              } : { color: arena.textMuted }),
            }}>
              {formatTime(timeLeft)}
            </span>
          )}

          {/* Credits badge */}
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: arena.accent,
            padding: '2px 8px',
            borderRadius: 9999,
            border: `1px solid ${arena.accent}40`,
            background: `${arena.accent}10`,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}>
            {userCredits.toLocaleString()} cr
          </span>

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
                cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.5 : 1,
              }}
              onClick={handleRun}
              disabled={isRunning}
            >
              {isRunning ? 'Running...' : 'Run Tests'}
            </button>
            <button
              style={{
                background: arena.accent,
                border: 'none',
                borderRadius: 6,
                color: '#0d1117',
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.5 : 1,
              }}
              onClick={handleSubmit}
              disabled={isRunning}
            >
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* IDE Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ArenaIDE
          challenge={challenge}
          attempt={attempt}
          userCredits={userCredits}
          code={code}
          onCodeChange={setCode}
          language={language}
          onRunTests={onRunTests}
          onSubmit={onSubmit}
          onAttemptUpdate={(next) => setAttempt(next)}
          onRestart={onRestart}
          onRunCode={onRunCode}
          testResults={testResults}
          onDismissResults={() => setTestResults(null)}
          pastAttempts={pastAttempts}
        />

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
          }}>
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
              <p style={{ fontSize: 13, color: arena.textMuted, margin: 0 }}>
                Total cost: {formatCost(attempt?.totalCost ?? 0)}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
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
                    } catch {}
                    setSuccessOverlay(null);
                  }}
                >
                  See How #1 Solved This
                </button>
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
                    setSuccessOverlay(null);
                    navigation.navigate('Challenges' as never);
                  }}
                >
                  Back to Challenges
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
