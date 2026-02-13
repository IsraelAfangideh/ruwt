import { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt } from '@/components/ArenaIDE';
import { arena } from '@/theme/colors';

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
  }, []);

  const onRunTests = useCallback(
    async (sourceCode: string, language: string) => {
      if (!attempt?.id) return { passed: false, passedTests: 0, totalTests: 0, results: [] };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, sourceCode, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      return {
        passed: data.success ?? false,
        passedTests: data.passedTests ?? 0,
        totalTests: data.totalTests ?? 0,
        results: data.results,
      };
    },
    [attempt?.id]
  );

  const onSubmit = useCallback(
    async (sourceCode: string, lang: string) => {
      return onRunTests(sourceCode, lang);
    },
    [onRunTests]
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
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
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
    } finally {
      setIsRunning(false);
    }
  }, [code, language, onRunTests]);

  const handleSubmit = useCallback(async () => {
    setIsRunning(true);
    try {
      await onSubmit(code, language);
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: arena.bg,
      color: arena.text,
      overflow: 'hidden',
    }}>
      {/* Header — 44px */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        padding: '0 12px',
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

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{
              background: 'transparent',
              border: `1px solid ${arena.border}`,
              borderRadius: 6,
              color: arena.text,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 500,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
            }}
            onClick={handleRun}
            disabled={isRunning}
          >
            Run Tests
          </button>
          <button
            style={{
              background: arena.accent,
              border: 'none',
              borderRadius: 6,
              color: '#0d1117',
              padding: '5px 14px',
              fontSize: 12,
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
        />
      </div>
    </div>
  );
}
