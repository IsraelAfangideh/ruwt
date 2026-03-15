import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { DetailCardSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useRoute } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { AIProfileRadar, type AIProfile } from '@/features/profile/AIProfileRadar';
import {
  formatCostFromHundredths, friendlyModelName, getModelTier, tierColor,
  tierLabel, getCostEfficiencySignal, TIER_ORDER,
} from '@/shared/lib/ai/pricing';

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
  assessment: {
    title: string;
    description: string | null;
    companyName?: string | null;
    companyLogoUrl?: string | null;
  } | null;
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
  /* istanbul ignore next -- @preserve */
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
    return <DetailCardSkeleton />;
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>{error || 'No data'}</Text>
      </View>
    );
  }

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
        {/* Company branding or Ruwt logo */}
        {data.assessment?.companyLogoUrl ? (
          <View style={styles.brandingHeader}>
            <img
              src={data.assessment.companyLogoUrl}
              alt={data.assessment.companyName || 'Company'}
              style={{ maxHeight: 48, maxWidth: 200, objectFit: 'contain' }}
            />
          </View>
        ) : data.assessment?.companyName ? (
          <Text style={[styles.companyName, { color: c.text }]}>{data.assessment.companyName}</Text>
        ) : (
          <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        )}

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

        {/* Overall verdict banner */}
        {(() => {
          const passRate = data.summary.challengesPassed / Math.max(1, data.summary.totalChallenges);
          const costDollars = data.summary.totalCost / 10000;
          /* istanbul ignore next -- @preserve */
          const isStrongPass = passRate === 1 && costDollars < 1;
          const isPass = passRate >= 0.75;
          const isFail = passRate < 0.25;

          const verdictConfig = isStrongPass
            ? { label: 'Strong Performance', color: c.success, bg: c.success + '12', border: c.success + '30', desc: 'Solved all challenges with efficient AI usage' }
            : isPass
            ? { label: 'Passed', color: c.success, bg: c.success + '08', border: c.success + '20', desc: `Solved ${data.summary.challengesPassed} of ${data.summary.totalChallenges} challenges` }
            : isFail
            ? { label: 'Needs Improvement', color: c.destructive, bg: c.destructive + '08', border: c.destructive + '20', desc: 'Solved fewer than 25% of challenges' }
            : { label: 'Partial Completion', color: c.accent, bg: c.accent + '08', border: c.accent + '20', desc: `Solved ${data.summary.challengesPassed} of ${data.summary.totalChallenges} challenges` };

          return (
            <View style={[styles.verdictBanner, { backgroundColor: verdictConfig.bg, borderColor: verdictConfig.border }]}>
              <Text style={[styles.verdictLabel, { color: verdictConfig.color }]}>{verdictConfig.label}</Text>
              <Text style={[styles.verdictDesc, { color: c.textMuted }]}>{verdictConfig.desc}</Text>
            </View>
          );
        })()}

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
                {formatCostFromHundredths(data.summary.totalCost)}
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
          {data.session.completedAt && (
            <Card style={styles.summaryCard}>
              <CardContent style={styles.summaryContent}>
                <Text style={[styles.summaryValue, { color: c.text }]}>
                  {(() => {
                    const ms = new Date(data.session.completedAt!).getTime() - new Date(data.session.startedAt).getTime();
                    const mins = Math.floor(ms / 60000);
                    /* istanbul ignore next -- @preserve */
                    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                  })()}
                </Text>
                <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Duration</Text>
              </CardContent>
            </Card>
          )}
        </View>

        {/* AI Profile Radar */}
        {data.challengeResults.length > 0 && (() => {
          // Compute an approximate AI profile from challenge results
          const totalCost = data.summary.totalCost;
          const totalTokens = data.summary.totalTokens;
          const modelsUsed = new Set<string>();
          const tiers = new Set<string>();
          let debugCost = 0;
          let debugCount = 0;
          for (const cr of data.challengeResults) {
            for (const model of Object.keys(cr.modelUsage)) {
              modelsUsed.add(model);
              /* istanbul ignore next -- @preserve */
              if (model.includes('70b') || model.includes('deepseek')) tiers.add('premium');
              /* istanbul ignore next -- @preserve */
              else if (model.includes('14b')) tiers.add('mid');
              else if (model.includes('8b') || model.includes('7b')) tiers.add('budget');
              else tiers.add('micro');
            }
            if (cr.challenge.category === 'iterative_debugging') {
              debugCost += cr.cost;
              debugCount++;
            }
          }
          // Simple scoring (without percentiles since we don't have population data)
          const costScore = Math.max(0, Math.min(100, 100 - (totalCost / 100)));
          const tokenScore = Math.max(0, Math.min(100, 100 - (totalTokens / 1000)));
          const debugScore = debugCount > 0 ? Math.max(0, Math.min(100, 100 - (debugCost / debugCount / 50))) : 50;
          const strategyScore = Math.min(100, tiers.size * 25);
          const passRate = data.summary.challengesPassed / Math.max(1, data.summary.totalChallenges);
          const speedScore = Math.round(passRate * 80 + 20);

          const profile: AIProfile = {
            modelSelection: Math.round(costScore),
            promptEfficiency: Math.round(tokenScore),
            debugging: Math.round(debugScore),
            strategy: strategyScore,
            speed: speedScore,
          };
          return (
            <View style={styles.radarSection}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>AI Profile</Text>
              <AIProfileRadar profile={profile} size={280} />
            </View>
          );
        })()}

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
                  variant="default"
                  style={{ backgroundColor: statusColor(cr.status), borderColor: statusColor(cr.status) }}
                >
                  <Text style={{ color: c.primaryForeground, fontWeight: '600', fontSize: fontSizes.xs }}>
                    {cr.status === 'passed' ? 'PASSED' : cr.status === 'failed' ? 'FAILED' : cr.status.toUpperCase()}
                  </Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.accent }]}>{formatCostFromHundredths(cr.cost)}</Text>
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
              {/* Cost proportion bar */}
              {data.summary.totalCost > 0 && (
                <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, minWidth: 110 }}>
                    {Math.round((cr.cost / data.summary.totalCost) * 100)}% of total cost
                  </Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: c.border }}>
                    <View style={{ height: '100%', borderRadius: 3, backgroundColor: c.accent, width: `${Math.min(100, (cr.cost / data.summary.totalCost) * 100)}%` }} />
                  </View>
                </View>
              )}
              {/* Model usage with tier badges */}
              {Object.keys(cr.modelUsage).length > 0 && (
                <View style={styles.modelSection}>
                  <Text style={[styles.modelTitle, { color: c.textMuted }]}>Models Used:</Text>
                  {Object.entries(cr.modelUsage).map(([model, usage]) => {
                    const tier = getModelTier(model);
                    return (
                      <View key={model} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 }}>
                        <Badge variant="outline" style={{ borderColor: tierColor(tier) + '40', backgroundColor: tierColor(tier) + '10' }}>
                          <Text style={{ fontSize: 10, color: tierColor(tier) }}>{tierLabel(tier)}</Text>
                        </Badge>
                        <Text style={[styles.modelRow, { color: c.text }]}>
                          {friendlyModelName(model)} — {usage.calls} call{usage.calls !== 1 ? 's' : ''} · {formatCostFromHundredths(usage.cost)}
                        </Text>
                      </View>
                    );
                  })}
                  {/* Cost efficiency signal */}
                  {(() => {
                    const tiers = Object.keys(cr.modelUsage).map((m) => getModelTier(m));
                    const highestTier = [...tiers].sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0];
                    /* istanbul ignore next -- @preserve */
                    if (!highestTier) return null;
                    const signal = getCostEfficiencySignal(cr.challenge.difficulty, highestTier, cr.status === 'passed');
                    if (!signal) return null;
                    const signalColor = signal.type === 'positive' ? c.success : c.accent;
                    return (
                      <Text style={{ fontSize: fontSizes.xs, color: signalColor, marginTop: spacing.xs, fontStyle: 'italic' }}>
                        {signal.type === 'positive' ? '\u2713 ' : '\u26A0 '}{signal.message}
                      </Text>
                    );
                  })()}
                </View>
              )}
            </CardContent>
          </Card>
        ))}

        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            {data.assessment?.companyName
              ? `Powered by Ruwt \u2014 AI-Efficiency Assessment`
              : 'Ruwt \u2014 AI-Efficiency Assessment'}
          </Text>
          <Text style={[styles.footerLink, { color: c.accent }]}
            onPress={() => { window.open('https://ruwt.dev/teams', '_blank'); }}
          >
            Assess your engineering candidates with Ruwt
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
  verdictBanner: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  verdictLabel: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  verdictDesc: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  summaryGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl, flexWrap: 'wrap' },
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
  radarSection: { alignItems: 'center', marginBottom: spacing.xl },
  footer: { paddingVertical: spacing.lg, marginTop: spacing.xl, borderTopWidth: 1 },
  footerText: { fontSize: fontSizes.sm, textAlign: 'center' },
  footerLink: { fontSize: fontSizes.sm, textAlign: 'center', marginTop: spacing.sm, textDecorationLine: 'underline' },
  brandingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  companyName: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.lg },
});
