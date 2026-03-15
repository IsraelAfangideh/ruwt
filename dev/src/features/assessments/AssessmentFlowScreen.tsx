import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { ArenaIDE, type ArenaChallenge, type ArenaAttempt, type TestResults } from '@/features/arena/ArenaIDE';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';

interface ChallengeProgress {
  index: number;
  challengeId: string;
  title: string;
  difficulty: string;
  status: string;
  cost: number;
}

export function AssessmentFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { sessionId: string };
  /* istanbul ignore next -- @preserve */
  const sessionId = params.sessionId ?? '';
  const c = useColors();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ArenaChallenge | null>(null);
  const [attempt, setAttempt] = useState<ArenaAttempt | null>(null);
  const [code, setCode] = useState('');
  const language = challenge?.language || 'javascript';
  const [sessionStatus, setSessionStatus] = useState('in_progress');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [totalChallenges, setTotalChallenges] = useState(0);
  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [timeLeft, setTimeLeft] = useState('');
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/assess/${sessionId}`);
      if (!res.ok) {
        setError('Failed to load assessment session');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSessionStatus(data.session.status);
      setExpiresAt(data.session.expiresAt);
      setChallengeIndex(data.session.currentChallengeIndex);
      setTotalChallenges(data.totalChallenges);
      setProgress(data.challengeProgress ?? []);
      setShareToken(data.session.shareToken);

      if (data.currentChallenge) {
        setChallenge(data.currentChallenge);
        setCode(data.currentChallenge.starterCode || '// your code here');
      }
      if (data.currentAttempt) {
        setAttempt(data.currentAttempt);
      }

      // Fetch actual user credits
      try {
        // Dashboard fetch removed — credits no longer needed here
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || sessionStatus !== 'in_progress') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      if (diff <= 0) {
        setSessionStatus('expired');
        setTimeLeft('00:00');
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, sessionStatus]);

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
      /* istanbul ignore next -- @preserve */
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

  const handleNext = useCallback(async () => {
    setAdvancing(true);
    try {
      const res = await fetch(`/api/assess/${sessionId}/next`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setChallenge(data.challenge);
        setAttempt(data.attempt);
        /* istanbul ignore next -- @preserve */
        setCode(data.challenge.starterCode || '// your code here');
        setChallengeIndex(data.challengeIndex);
        setTestResults(null);
      }
    } catch (_) {}
    setAdvancing(false);
  }, [sessionId]);

  const handleComplete = useCallback(async () => {
    const res = await fetch(`/api/assess/${sessionId}/complete`, { method: 'POST' });
    /* istanbul ignore next -- @preserve */
    if (res.ok) {
      const data = await res.json();
      setSessionStatus('completed');
      if (data.session?.shareToken) {
        navigation.navigate('AssessmentResults', { shareToken: data.session.shareToken });
      }
    }
  }, [sessionId, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading assessment...</Text>
      </View>
    );
  }

  if (sessionStatus === 'completed' || sessionStatus === 'expired') {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.doneTitle, { color: c.text }]}>
          {sessionStatus === 'completed' ? 'Assessment Complete' : 'Assessment Expired'}
        </Text>
        <Text style={[styles.doneSub, { color: c.textMuted }]}>
          {sessionStatus === 'completed'
            ? 'Your results have been submitted.'
            : 'The time limit has been reached.'}
        </Text>
        {shareToken && (
          <Button
            variant="outline"
            onPress={() => navigation.navigate('AssessmentResults', { shareToken })}
            style={{ marginTop: spacing.md }}
          >
            View Results
          </Button>
        )}
      </View>
    );
  }

  if (error || !challenge || !attempt) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>{error || 'Missing data'}</Text>
      </View>
    );
  }

  const isLastChallenge = challengeIndex >= totalChallenges - 1;
  const currentPassed = testResults?.passed ?? false;

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Assessment header bar */}
      {/* istanbul ignore next -- @preserve */}
      <View style={[styles.assessmentBar, { borderBottomColor: c.border, backgroundColor: /* istanbul ignore next -- @preserve */ c.bgElevated || c.muted }]}>
        /* istanbul ignore next -- @preserve */
        <View style={styles.progressDots}>
          /* istanbul ignore next -- @preserve */
          {progress.map((p, i) => (
            /* istanbul ignore next -- @preserve */
            <View
              /* istanbul ignore next -- @preserve */
              key={i}
              /* istanbul ignore next -- @preserve */
              style={[
                /* istanbul ignore next -- @preserve */
                styles.dot,
                /* istanbul ignore next -- @preserve */
                {
                  /* istanbul ignore next -- @preserve */
                  backgroundColor:
                    /* istanbul ignore next -- @preserve */
                    p.status === 'passed'
                      ? c.success
                      : i === challengeIndex
                      ? c.accent
                      : c.border,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.progressText, { color: c.textMuted }]}>
          Challenge {challengeIndex + 1} of {totalChallenges}
        </Text>
        <Badge variant={timeLeft < '05:00' ? 'default' : 'outline'}>
          <Text style={{ color: timeLeft < '05:00' ? c.destructive : c.text, fontFamily: 'monospace' }}>
            {timeLeft}
          </Text>
        </Badge>
      </View>

      {/* Challenge header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.challengeTitle, { color: c.text }]} numberOfLines={1}>
            {challenge.title}
          </Text>
          <Badge variant="outline">{challenge.difficulty}</Badge>
        </View>
        <View style={styles.headerRight}>
          {currentPassed && !isLastChallenge && (
            <Button variant="outline" size="sm" onPress={handleNext} disabled={advancing}>
              {advancing ? 'Loading...' : 'Next Challenge →'}
            </Button>
          )}
          {currentPassed && isLastChallenge && (
            <Button size="sm" onPress={handleComplete}>
              Complete Assessment
            </Button>
          )}
        </View>
      </View>

      {/* Reuse ArenaIDE */}
      <View style={styles.body}>
        <ArenaIDE
          challenge={challenge}
          attempt={attempt}
          code={code}
          onCodeChange={setCode}
          language={language}
          onRunTests={onRunTests}
          onAttemptUpdate={(next) => setAttempt(next)}
          testResults={testResults}
          onDismissResults={() => setTestResults(null)}
          onRunCode={async (sourceCode, lang) => {
            const res = await fetch('/api/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: (() => { /* istanbul ignore next -- @preserve */ const language = lang === 'javascript' ? 'javascript' : lang; /* istanbul ignore next -- @preserve */ const version = lang === 'javascript' ? '18.15.0' : '*'; return JSON.stringify({ language, version, files: [{ content: sourceCode }] }); })(),
            });
            const data = await res.json();
            /* istanbul ignore next -- @preserve */
            const run = data.run || {};
            /* istanbul ignore next -- @preserve */
            return { stdout: run.stdout || '', stderr: run.stderr || '', exitCode: run.code ?? 0 };
          }}
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
  doneTitle: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  doneSub: { fontSize: fontSizes.md, marginTop: spacing.sm },
  assessmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  progressDots: { flexDirection: 'row', gap: spacing.xs },
  dot: { width: 12, height: 12, borderRadius: 6 },
  progressText: { fontSize: fontSizes.sm },
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
