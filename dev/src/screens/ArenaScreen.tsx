import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt } from '@/components/ArenaIDE';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function ArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { challengeId?: string };
  const challengeId = params.challengeId ?? '';
  const c = useColors();

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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading arena…</Text>
      </View>
    );
  }

  if (error || !challenge || !attempt) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>{error || 'Missing challenge or attempt'}</Text>
        <Button variant="outline" onPress={() => navigation.navigate('Challenges' as never)} style={{ marginTop: spacing.md }}>
          Back to Challenges
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Button variant="ghost" size="sm" onPress={() => navigation.navigate('Challenges' as never)}>
            ← Back
          </Button>
          <Separator vertical />
          <View>
            <Text style={[styles.challengeTitle, { color: c.text }]} numberOfLines={1}>
              {challenge.title}
            </Text>
            <Badge variant="outline">{challenge.difficulty}</Badge>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Button variant="outline" size="sm" onPress={handleRun} disabled={isRunning}>
            Run Tests
          </Button>
          <Button size="sm" onPress={handleSubmit} disabled={isRunning}>
            Submit Solution
          </Button>
        </View>
      </View>
      <View style={styles.body}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.sm, fontSize: fontSizes.sm },
  errorText: { fontSize: fontSizes.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  challengeTitle: { fontSize: fontSizes.md, fontWeight: '600', fontFamily: fontFamily.body },
  body: { flex: 1, minHeight: 0 },
});
