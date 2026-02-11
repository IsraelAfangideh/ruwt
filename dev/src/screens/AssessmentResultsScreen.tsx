import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface ChallengeResult {
  challenge: {
    id: string;
    title: string;
    difficulty: string;
    category: string | null;
    skillTested: string | null;
  };
  status: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  passedTests: number;
  totalTests: number;
  modelUsage: Record<string, { calls: number; cost: number; tokens: number }>;
}

interface ResultsData {
  assessment: { title: string; description: string | null } | null;
  candidate: { name: string | null; avatarUrl: string | null };
  session: {
    status: string;
    totalCost: number;
    totalTokens: number;
    startedAt: string;
    completedAt: string | null;
  };
  summary: {
    challengesPassed: number;
    totalChallenges: number;
    totalCost: number;
    totalTokens: number;
  };
  challengeResults: ChallengeResult[];
}

export function AssessmentResultsScreen() {
  const route = useRoute();
  const params = (route.params || {}) as { shareToken: string };
  const c = useColors();

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/results/${params.shareToken}`);
        if (!res.ok) {
          setError('Results not found');
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load results');
      }
      setLoading(false);
    };
    load();
  }, [params.shareToken]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>{error || 'No data'}</Text>
      </View>
    );
  }

  const formatCost = (cost: number) => {
    const dollars = cost / 10000;
    return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
  };

  const statusColor = (status: string) => {
    if (status === 'passed') return c.success;
    if (status === 'failed') return c.destructive;
    return c.textMuted;
  };

  const categoryLabel = (cat: string | null) => {
    if (cat === 'model_selection') return 'Model Selection';
    if (cat === 'prompt_efficiency') return 'Prompt Efficiency';
    if (cat === 'iterative_debugging') return 'Iterative Debugging';
    return 'Practice';
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: c.text }]}>Assessment Results</Text>
          {data.assessment && (
            <Text style={[styles.assessmentTitle, { color: c.textMuted }]}>
              {data.assessment.title}
            </Text>
          )}
          <Text style={[styles.candidateName, { color: c.text }]}>
            {data.candidate.name || 'Candidate'}
          </Text>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <CardContent style={styles.summaryContent}>
              <Text style={[styles.summaryValue, { color: c.text }]}>
                {data.summary.challengesPassed}/{data.summary.totalChallenges}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Challenges Passed</Text>
            </CardContent>
          </Card>
          <Card style={styles.summaryCard}>
            <CardContent style={styles.summaryContent}>
              <Text style={[styles.summaryValue, { color: c.accent }]}>
                {formatCost(data.summary.totalCost)}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Total AI Cost</Text>
            </CardContent>
          </Card>
          <Card style={styles.summaryCard}>
            <CardContent style={styles.summaryContent}>
              <Text style={[styles.summaryValue, { color: c.text }]}>
                {data.summary.totalTokens.toLocaleString()}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Total Tokens</Text>
            </CardContent>
          </Card>
        </View>

        {/* Per-challenge breakdown */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Challenge Breakdown</Text>
        {data.challengeResults.map((cr) => (
          <Card key={cr.challenge.id} style={styles.challengeCard}>
            <CardHeader>
              <View style={styles.challengeHeader}>
                <View style={{ flex: 1 }}>
                  <CardTitle>{cr.challenge.title}</CardTitle>
                  <View style={styles.badges}>
                    <Badge variant="outline">
                      <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
                        {cr.challenge.difficulty}
                      </Text>
                    </Badge>
                    <Badge variant="outline">
                      <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
                        {categoryLabel(cr.challenge.category)}
                      </Text>
                    </Badge>
                  </View>
                </View>
                <Badge
                  variant={cr.status === 'passed' ? 'default' : 'outline'}
                  style={{ borderColor: statusColor(cr.status) }}
                >
                  <Text style={{ color: statusColor(cr.status), fontWeight: '600', fontSize: fontSizes.xs }}>
                    {cr.status === 'passed' ? 'PASSED' : cr.status === 'failed' ? 'FAILED' : cr.status.toUpperCase()}
                  </Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.accent }]}>{formatCost(cr.cost)}</Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>Cost</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.text }]}>{cr.passedTests}/{cr.totalTests}</Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>Tests</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.text }]}>
                    {(cr.inputTokens + cr.outputTokens).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: c.textMuted }]}>Tokens</Text>
                </View>
              </View>
              {Object.keys(cr.modelUsage).length > 0 && (
                <View style={styles.modelSection}>
                  <Text style={[styles.modelTitle, { color: c.textMuted }]}>Models Used:</Text>
                  {Object.entries(cr.modelUsage).map(([model, usage]) => (
                    <Text key={model} style={[styles.modelRow, { color: c.text }]}>
                      {model.replace('@cf/meta/', '').replace('@cf/mistral/', '')} — {usage.calls} call{usage.calls !== 1 ? 's' : ''} · {formatCost(usage.cost)}
                    </Text>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        ))}

        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            Powered by Ruwt — AI-Efficiency Assessment
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSizes.md },
  container: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.lg },
  headerSection: { marginBottom: spacing.xl },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  assessmentTitle: { fontSize: fontSizes.md, marginTop: spacing.xs },
  candidateName: { fontSize: fontSizes.lg, fontWeight: '600', marginTop: spacing.md },
  summaryGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  summaryCard: { flex: 1 },
  summaryContent: { alignItems: 'center', paddingVertical: spacing.md },
  summaryValue: { fontSize: fontSizes['2xl'], fontWeight: '700' },
  summaryLabel: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  sectionTitle: { fontSize: fontSizes.xl, fontWeight: '700', marginBottom: spacing.md, fontFamily: fontFamily.body },
  challengeCard: { marginBottom: spacing.md },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.lg },
  stat: { alignItems: 'center' },
  statValue: { fontSize: fontSizes.lg, fontWeight: '600' },
  statLabel: { fontSize: fontSizes.xs, marginTop: 2 },
  modelSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  modelTitle: { fontSize: fontSizes.xs, fontWeight: '600', marginBottom: spacing.xs },
  modelRow: { fontSize: fontSizes.xs, fontFamily: 'monospace' },
  footer: { paddingVertical: spacing.lg, marginTop: spacing.xl, borderTopWidth: 1 },
  footerText: { fontSize: fontSizes.sm, textAlign: 'center' },
});
