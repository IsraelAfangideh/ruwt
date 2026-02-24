import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt, type TestResults, type PastAttempt } from '@/components/ArenaIDE';
import { arena } from '@/theme/colors';
import { useIsMobile } from '@/lib/useIsMobile';
import { getDifficultyStyle } from '@/lib/difficulty';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useToast } from '@/components/ui/Toast';
import { ArenaErrorBoundary } from '@/components/arena/ArenaErrorBoundary';

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

/** Returns badge color based on credit balance thresholds. */
function creditsBadgeColor(credits: number): string {
  if (credits >= 20000) return arena.accent;   // gold — healthy
  if (credits >= 5000) return '#e09040';        // orange — warning
  return arena.error;                           // red — low
}

export function ArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loading: authLoading } = useAuthGuard();
  const params = (route.params || {}) as { challengeId?: string };
  const challengeId = params.challengeId ?? '';

  const [challenge, setChallenge] = useState<ArenaChallenge | null>(null);
  const [attempt, setAttempt] = useState<ArenaAttempt | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [code, setCode] = useState('');
  const language = challenge?.language || 'javascript';
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
  const navigatingRef = useRef(false);
  const isMobile = useIsMobile();
  const { showToast } = useToast();

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
    } catch {
      showToast('Failed to load past attempts', 'error');
    }
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
          const defaultComment = language === 'python' ? '# your code here' : '// your code here';
          setCode(data.challenge?.starterCode || defaultComment);
        }
      } else {
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

  const onRestart = useCallback(() => {
    setAttempt(null);
    setCode('');
    setIsRunning(false);
    setError(null);
    setTestResults(null);
    setSuccessOverlay(null);
    setSuccessStats(null);
    setIsExpired(false);
    isExpiredRef.current = false;
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
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language: lang, mode: 'submit', idempotencyKey: `${attempt.id}-${crypto.randomUUID()}` }),
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
        // Fetch rank info for the overlay
        try {
          const lbRes = await fetch(`/api/leaderboard?challengeId=${challengeId}`);
          if (lbRes.ok) {
            const lb = await lbRes.json();
            const entries = lb.entries ?? [];
            const myIdx = entries.findIndex((e: any) => e.attemptId === finalAttemptId);
            setSuccessStats({
              rank: myIdx >= 0 ? myIdx + 1 : entries.length + 1,
              total: entries.length,
              topCost: entries[0]?.totalCost ?? null,
            });
          }
        } catch { /* leaderboard fetch failed — show overlay without stats */ }
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

  // Auth loading state
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: arena.bg }}>
        <ActivityIndicator size="large" color={arena.accent} />
      </View>
    );
  }

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

  const diffStyle = getDifficultyStyle(challenge.difficulty);
  const difficultyColor = diffStyle.color;

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
            background: diffStyle.bg,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
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
            {starting ? 'Starting...' : 'Start Challenge'}
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
      {/* Pulse animation for low-credit badge */}
      <style>{`
        @keyframes credit-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
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
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                flexShrink: 0,
              }}
              onClick={() => navigation.navigate('Challenges' as never)}
            >
              &larr;
            </button>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: arena.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}>
              {challenge.title}
            </span>
            {timeLeft != null && (
              <span style={{
                fontSize: 12,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                flexShrink: 0,
                ...(timerUrgency === 'critical' ? {
                  fontWeight: 700, background: arena.error, color: '#fff', padding: '2px 8px', borderRadius: 9999,
                } : timerUrgency === 'warning' ? {
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
                cursor: isRunning || isExpired ? 'not-allowed' : 'pointer',
                opacity: isRunning || isExpired ? 0.5 : 1,
                flexShrink: 0,
              }}
              onClick={handleRun}
              disabled={isRunning || isExpired}
            >
              {isExpired ? 'Expired' : isRunning ? '...' : 'Run'}
            </button>
            <button
              style={{
                background: isExpired ? arena.textMuted : arena.accent,
                border: 'none',
                borderRadius: 6,
                color: '#0d1117',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: isRunning || isExpired ? 'not-allowed' : 'pointer',
                opacity: isRunning || isExpired ? 0.5 : 1,
                flexShrink: 0,
              }}
              onClick={handleSubmit}
              disabled={isRunning || isExpired}
            >
              Submit
            </button>
          </div>

          {/* Row 2: Compact stats strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: 28,
            padding: '0 10px',
            gap: 12,
            borderTop: `1px solid ${arena.border}`,
            fontSize: 11,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          }}>
            <span style={{
              fontWeight: 700,
              color: costLimitReached ? arena.error : arena.accent,
            }}>
              {formatCost(attempt.totalCost)}
            </span>
            <span style={{
              color: tokenLimitReached ? arena.error : arena.textMuted,
            }}>
              {totalTokens.toLocaleString()} tok
            </span>
            {(() => {
              const badgeColor = creditsBadgeColor(userCredits);
              return (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  fontWeight: userCredits < 5000 ? 700 : 600,
                  color: badgeColor,
                  padding: '1px 6px',
                  borderRadius: 9999,
                  border: `1px solid ${badgeColor}40`,
                  background: `${badgeColor}10`,
                  ...(userCredits < 5000 ? { animation: 'credit-pulse 2s ease-in-out infinite' } : {}),
                }}>
                  {userCredits.toLocaleString()} cr (${(userCredits / 10000).toFixed(2)})
                </span>
              );
            })()}
            {/* Practice mode indicator */}
            <span style={{
              fontSize: 9,
              color: arena.textSubtle,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              whiteSpace: 'nowrap',
            }}>
              Free practice
            </span>
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
              background: diffStyle.bg,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              textTransform: 'lowercase',
            }}>
              {diffStyle.label}
            </span>
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
            {(() => {
              const badgeColor = creditsBadgeColor(userCredits);
              return (
                <span style={{
                  fontSize: 10,
                  fontWeight: userCredits < 5000 ? 700 : 600,
                  color: badgeColor,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  border: `1px solid ${badgeColor}40`,
                  background: `${badgeColor}10`,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  ...(userCredits < 5000 ? { animation: 'credit-pulse 2s ease-in-out infinite' } : {}),
                }}>
                  {userCredits.toLocaleString()} cr (${(userCredits / 10000).toFixed(2)})
                </span>
              );
            })()}

            {/* Practice mode indicator */}
            <span style={{
              fontSize: 10,
              color: arena.textSubtle,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              whiteSpace: 'nowrap',
            }}>
              Free practice — costs tracked for ranking only
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
                  cursor: isRunning || isExpired ? 'not-allowed' : 'pointer',
                  opacity: isRunning || isExpired ? 0.5 : 1,
                }}
                onClick={handleRun}
                disabled={isRunning || isExpired}
              >
                {isExpired ? 'Time Expired' : isRunning ? 'Running...' : 'Run Tests'}
              </button>
              <button
                style={{
                  background: isExpired ? arena.textMuted : arena.accent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#0d1117',
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isRunning || isExpired ? 'not-allowed' : 'pointer',
                  opacity: isRunning || isExpired ? 0.5 : 1,
                }}
                onClick={handleSubmit}
                disabled={isRunning || isExpired}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IDE Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ArenaErrorBoundary>
          <ArenaIDE
            challenge={challenge}
            attempt={attempt}
            userCredits={userCredits}
            code={code}
            onCodeChange={setCode}
            language={language}
            isExpired={isExpired}
            onExpire={() => { setIsExpired(true); isExpiredRef.current = true; }}
            onRunTests={onRunTests}
            onSubmit={onSubmit}
            onAttemptUpdate={(next) => setAttempt(next)}
            onRestart={onRestart}
            onRunCode={onRunCode}
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
            {/* CSS confetti */}
            <style>{`
              @keyframes confetti-fall {
                0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
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

              {/* Rank comparison stats */}
              <div style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'center',
                flexWrap: 'wrap',
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: arena.textMuted, marginBottom: 4 }}>Your Cost</div>
                  <div style={{ color: arena.accent, fontWeight: 700, fontSize: 16 }}>
                    {formatCost(attempt?.totalCost ?? 0)}
                  </div>
                </div>
                {successStats && successStats.topCost != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: arena.textMuted, marginBottom: 4 }}>Top Solver</div>
                    <div style={{ color: arena.text, fontWeight: 700, fontSize: 16 }}>
                      {formatCost(successStats.topCost)}
                    </div>
                  </div>
                )}
                {successStats && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: arena.textMuted, marginBottom: 4 }}>Your Rank</div>
                    <div style={{ color: successStats.rank === 1 ? arena.accent : arena.text, fontWeight: 700, fontSize: 16 }}>
                      #{successStats.rank}
                      <span style={{ fontSize: 11, fontWeight: 400, color: arena.textMuted }}> / {successStats.total}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 8 }}>
                <button
                  style={{
                    background: '#0A66C2',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${successOverlay.attemptId}`;
                    const text = `I solved "${challenge.title}" on ruwt.dev for ${formatCost(attempt?.totalCost ?? 0)} with AI`;
                    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(text)}`;
                    window.open(linkedinUrl, '_blank', 'width=600,height=500');
                  }}
                >
                  Share on LinkedIn
                </button>
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
                    if (navigatingRef.current) return;
                    navigatingRef.current = true;
                    try {
                      const res = await fetch(`/api/challenges`);
                      if (res.ok) {
                        const allChallenges = await res.json();
                        const sameCat = allChallenges.filter((ch: any) => ch.category === challenge?.category && ch.id !== challengeId);
                        if (sameCat.length > 0) {
                          setSuccessOverlay(null);
                          (navigation.navigate as any)('Arena', { challengeId: sameCat[0].id });
                          return;
                        }
                      }
                    } catch (err) {
                      console.error('Failed to load next challenge:', err);
                      showToast('Could not load next challenge', 'error');
                    }
                    navigatingRef.current = false;
                    setSuccessOverlay(null);
                    navigation.navigate('Challenges' as never);
                  }}
                >
                  Try Next Challenge
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
                    if (navigatingRef.current) return;
                    navigatingRef.current = true;
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
