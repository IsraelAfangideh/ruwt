import { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt } from '@/components/ArenaIDE';
import { arena } from '@/theme/colors';

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
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ passed: boolean; passedTests: number; totalTests: number } | null>(null);

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
        const attemptRes = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId }),
        });
        if (cancelled) return;
        if (!attemptRes.ok) {
          setError('Failed to start attempt');
          setLoading(false);
          return;
        }
        const attemptData = await attemptRes.json();
        setAttempt(attemptData.attempt);
        setCode(attemptData.challenge?.starterCode || '// your code here');
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

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const r = await onRunTests(code, language);
      setRunResult({ passed: r.passed, passedTests: r.passedTests, totalTests: r.totalTests });
    } finally {
      setIsRunning(false);
    }
  }, [code, language, onRunTests]);

  const handleSubmit = useCallback(async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const r = await onSubmit(code, language);
      setRunResult({ passed: r.passed, passedTests: r.passedTests, totalTests: r.totalTests });
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

  // Error state
  if (error || !challenge || !attempt) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: arena.bg }}>
        <Text style={{ fontSize: 14, color: arena.error, marginBottom: 12 }}>{error || 'Missing challenge or attempt'}</Text>
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

  const difficultyColor =
    challenge.difficulty === 'easy' ? arena.success :
    challenge.difficulty === 'hard' ? arena.error : arena.accent;

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
            ← Back
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
          runResult={runResult}
        />
      </div>
    </div>
  );
}
