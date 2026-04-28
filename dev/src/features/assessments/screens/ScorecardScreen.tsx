/**
 * ScorecardScreen: recruiter-facing public scorecard at /scorecard/:token.
 * No auth required, no candidate PII — just the AFI-style summary, behavioral
 * flags, and per-challenge breakdown that a non-technical reviewer can act on.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DetailCardSkeleton } from '@/shared/ui/ScreenSkeletons';

type Tier = 'strong' | 'solid' | 'developing' | 'novice';

interface ScorecardChallenge {
  title: string;
  difficulty: string;
  category: string | null;
  status: 'passed' | 'failed' | 'not_attempted';
  passedTests: number;
  totalTests: number;
  costCents: number;
  modelsUsed: string[];
}

interface ScorecardFlag {
  type: 'positive' | 'caution' | 'negative';
  label: string;
  detail: string;
}

interface Scorecard {
  candidateRef: string;
  assessmentTitle: string | null;
  completedAt: string | null;
  passRate: number;
  challengesPassed: number;
  totalChallenges: number;
  totalCostCents: number;
  totalTokens: number;
  rating: { tier: Tier; label: string; summary: string };
  flags: ScorecardFlag[];
  challenges: ScorecardChallenge[];
}

const TIER_COLORS: Record<Tier, string> = {
  strong: '#16a34a',
  solid: '#c9a962',
  developing: '#3b82f6',
  novice: '#71717a',
};

const FLAG_COLORS: Record<ScorecardFlag['type'], string> = {
  positive: '#16a34a',
  caution: '#d97706',
  negative: '#dc2626',
};

function fmtMoney(cents: number) {
  const dollars = cents / 10000;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

export function ScorecardScreen() {
  const route = useRoute();
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { token?: string };
  const token = params.token ?? '';
  const c = useColors();

  const [data, setData] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: data
      ? `${data.candidateRef} — AI Fluency Scorecard`
      : 'AI Fluency Scorecard | Ruwt',
    description: data
      ? `Verified scorecard: ${data.rating.label} (${Math.round(data.passRate * 100)}% pass rate, ${data.challengesPassed}/${data.totalChallenges} challenges).`
      : 'Recruiter-facing AI Fluency Scorecard — verified on Ruwt.',
    canonicalPath: token ? `/scorecard/${token}` : undefined,
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid scorecard link');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/scorecard/${token}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Scorecard not found' : 'Failed to load scorecard');
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load scorecard');
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <View style={[styles.page, { backgroundColor: c.bg }]} testID="scorecard-loading">
        <DetailCardSkeleton />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.page, styles.center, { backgroundColor: c.bg }]} testID="scorecard-error">
        <Text style={[styles.errorTitle, { color: c.text }]}>{error ?? 'Scorecard unavailable'}</Text>
        <Text style={[styles.errorSub, { color: c.textMuted }]}>
          The link may be incorrect or the assessment may not be complete yet.
        </Text>
      </View>
    );
  }

  const tierColor = TIER_COLORS[data.rating.tier];
  const passPct = Math.round(data.passRate * 100);

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]} testID="scorecard-screen">
      {/* Print-friendly trust mark */}
      <View style={[styles.trustBar, { borderBottomColor: c.border }]}>
        <Text style={[styles.trustMark, { color: c.textMuted }]}>
          Verified by Ruwt · ruwt.dev/scorecard
        </Text>
      </View>

      <View style={styles.body}>
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={[styles.candidateRef, { color: c.textMuted }]}>{data.candidateRef}</Text>
          {data.assessmentTitle && (
            <Text style={[styles.assessmentTitle, { color: c.text }]}>{data.assessmentTitle}</Text>
          )}
          {data.completedAt && (
            <Text style={[styles.completedAt, { color: c.textMuted }]}>
              Completed {new Date(data.completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
          )}
        </View>

        {/* Rating panel */}
        <Card style={[styles.ratingCard, { borderColor: tierColor, backgroundColor: c.cardBg }]}>
          <CardContent style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text style={[styles.ratingTier, { color: tierColor }]} testID="scorecard-tier">
              {data.rating.label}
            </Text>
            <Text style={[styles.ratingSummary, { color: c.textMuted }]}>{data.rating.summary}</Text>
            <View style={styles.headlineMetrics}>
              <Metric label="Pass rate" value={`${passPct}%`} c={c} testID="scorecard-pass-rate" />
              <Metric label="Solved" value={`${data.challengesPassed} / ${data.totalChallenges}`} c={c} />
              <Metric label="AI cost" value={fmtMoney(data.totalCostCents)} c={c} />
            </View>
          </CardContent>
        </Card>

        {/* Flags */}
        {data.flags.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Behavioral signals</Text>
            <View style={styles.flagList}>
              {data.flags.map((f) => (
                <View
                  key={f.label}
                  testID={`scorecard-flag-${f.type}`}
                  style={[styles.flag, { borderLeftColor: FLAG_COLORS[f.type], backgroundColor: c.cardBg, borderColor: c.border }]}
                >
                  <Text style={[styles.flagLabel, { color: FLAG_COLORS[f.type] }]}>{f.label}</Text>
                  <Text style={[styles.flagDetail, { color: c.textMuted }]}>{f.detail}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Per-challenge breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Challenge-by-challenge</Text>
          <View style={styles.challengeList}>
            {data.challenges.map((ch, i) => (
              <Card key={`${ch.title}-${i}`} style={[styles.challengeCard, { borderColor: c.border, backgroundColor: c.cardBg }]}>
                <CardHeader>
                  <View style={styles.challengeHeader}>
                    <CardTitle>{ch.title}</CardTitle>
                    <Badge variant={ch.status === 'passed' ? 'default' : 'secondary'}>
                      {ch.status === 'passed' ? 'Passed' : ch.status === 'failed' ? 'Failed' : 'Skipped'}
                    </Badge>
                  </View>
                </CardHeader>
                <CardContent>
                  <View style={styles.challengeMeta}>
                    <Text style={[styles.metaText, { color: c.textMuted }]}>{ch.difficulty}</Text>
                    {ch.category && <Text style={[styles.metaText, { color: c.textMuted }]}>· {ch.category}</Text>}
                    <Text style={[styles.metaText, { color: c.textMuted }]}>· {ch.passedTests}/{ch.totalTests} tests</Text>
                    <Text style={[styles.metaText, { color: c.textMuted }]}>· {fmtMoney(ch.costCents)}</Text>
                  </View>
                  {ch.modelsUsed.length > 0 && (
                    <Text style={[styles.modelsList, { color: c.textMuted }]}>
                      Models: {ch.modelsUsed.join(', ')}
                    </Text>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            Scorecards are tamper-proof — every metric is computed server-side from the candidate's assessment session.
            Visit ruwt.dev to learn more.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, c, testID }: { label: string; value: string; c: any; testID?: string }) {
  return (
    <View style={styles.metricBlock}>
      <Text style={[styles.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: c.text }]} testID={testID}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  trustBar: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderBottomWidth: 1 },
  trustMark: { fontSize: fontSizes.xs, letterSpacing: 1 },
  body: { padding: spacing.lg, maxWidth: 800, marginHorizontal: 'auto', width: '100%', gap: spacing.lg },
  headerBlock: { gap: spacing.xs, marginTop: spacing.md, alignItems: 'center' },
  candidateRef: { fontSize: fontSizes.sm, letterSpacing: 1 },
  assessmentTitle: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  completedAt: { fontSize: fontSizes.sm },
  ratingCard: { borderWidth: 2, borderRadius: 12 },
  ratingTier: { fontSize: 56, fontWeight: '800', marginBottom: spacing.xs },
  ratingSummary: { fontSize: fontSizes.md, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 480 },
  headlineMetrics: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  metricBlock: { alignItems: 'center', minWidth: 100 },
  metricLabel: { fontSize: fontSizes.xs, letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '700' },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  flagList: { gap: spacing.sm },
  flag: { borderLeftWidth: 4, borderWidth: 1, borderRadius: 6, padding: spacing.md, gap: spacing.xs },
  flagLabel: { fontSize: fontSizes.sm, fontWeight: '700' },
  flagDetail: { fontSize: fontSizes.sm, lineHeight: 20 },
  challengeList: { gap: spacing.sm },
  challengeCard: { borderWidth: 1 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  challengeMeta: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  metaText: { fontSize: fontSizes.sm },
  modelsList: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  footer: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  footerText: { fontSize: fontSizes.xs, textAlign: 'center', lineHeight: 18 },
  errorTitle: { fontSize: fontSizes.lg, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  errorSub: { fontSize: fontSizes.sm, textAlign: 'center', maxWidth: 400, lineHeight: 22 },
});
