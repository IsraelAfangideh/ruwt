import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { getModelById, tierColor } from '@/lib/ai/pricing';

interface AttemptDetail {
  challengeId: string;
  status: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  passedTests: number;
  totalTests: number;
  modelUsage: Record<string, { calls: number; cost: number; tokens: number }>;
}

interface CandidateResult {
  session: {
    id: string;
    status: string;
    totalCost: number;
    totalTokens: number;
    startedAt: string;
    completedAt: string | null;
    shareToken: string | null;
  };
  candidate: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  challengesPassed: number;
  totalChallenges: number;
  attempts?: AttemptDetail[];
}

type SortKey = 'name' | 'status' | 'passed' | 'cost' | 'tokens' | 'time';

export function AssessmentResultsDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { assessmentId: string };
  const c = useColors();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('cost');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const res = await fetch(`/api/assessments/${params.assessmentId}/results`);
        if (res.ok) setResults(await res.json());
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, params.assessmentId]);

  const formatCost = (cost: number) => {
    const dollars = cost / 10000;
    return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
  };

  const getDuration = (r: CandidateResult): number => {
    if (!r.session.completedAt) return 0;
    return new Date(r.session.completedAt).getTime() - new Date(r.session.startedAt).getTime();
  };

  const formatDuration = (ms: number): string => {
    if (ms <= 0) return '-';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(true);
    }
  };

  const sorted = [...results].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = (a.candidate.name || a.candidate.email).localeCompare(b.candidate.name || b.candidate.email);
        break;
      case 'status':
        cmp = a.session.status.localeCompare(b.session.status);
        break;
      case 'passed':
        cmp = a.challengesPassed - b.challengesPassed;
        break;
      case 'cost':
        cmp = a.session.totalCost - b.session.totalCost;
        break;
      case 'tokens':
        cmp = a.session.totalTokens - b.session.totalTokens;
        break;
      case 'time':
        cmp = getDuration(a) - getDuration(b);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const getRowBg = (r: CandidateResult): string => {
    if (r.challengesPassed === r.totalChallenges) return 'rgba(63,185,80,0.06)';
    if (r.challengesPassed > 0) return 'rgba(201,169,98,0.06)';
    return 'rgba(248,81,73,0.06)';
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Candidate', 'Email', 'Status', 'Passed', 'Total', 'Cost', 'Tokens', 'Duration'];
    const rows = sorted.map((r) => [
      r.candidate.name || '',
      r.candidate.email,
      r.session.status,
      r.challengesPassed,
      r.totalChallenges,
      (r.session.totalCost / 10000).toFixed(4),
      r.session.totalTokens,
      formatDuration(getDuration(r)),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-results-${params.assessmentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, params.assessmentId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const SortHeader = ({ label, sortKey, style }: { label: string; sortKey: SortKey; style?: any }) => (
    <Pressable onPress={() => handleSort(sortKey)} style={style}>
      <Text style={[styles.th, { color: c.textMuted }]}>
        {label} {sortBy === sortKey ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
      </Text>
    </Pressable>
  );

  return (
    <DashboardLayout user={user}>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => navigation.navigate('Assessments' as never)}
            >
              {'\u2190'} Back to Assessments
            </Button>
            <Text style={[styles.title, { color: c.text }]}>Assessment Results</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {results.length} candidate{results.length !== 1 ? 's' : ''} have taken this assessment.
            </Text>
          </View>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onPress={handleExportCSV}>
              Export CSV
            </Button>
          )}
        </View>
      </View>

      {results.length === 0 ? (
        <Card style={[styles.empty, { backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No Results Yet</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              Invite candidates to take this assessment.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <View style={[styles.table, { borderColor: c.border }]}>
          <View style={[styles.tableHeader, { borderBottomColor: c.border }]}>
            <SortHeader label="Candidate" sortKey="name" style={styles.thName} />
            <SortHeader label="Status" sortKey="status" style={styles.thStatus} />
            <SortHeader label="Passed" sortKey="passed" style={styles.thPassed} />
            <SortHeader label="Cost" sortKey="cost" style={styles.thCost} />
            <SortHeader label="Tokens" sortKey="tokens" style={styles.thTokens} />
            <SortHeader label="Time" sortKey="time" style={styles.thTime} />
          </View>
          {sorted.map((r) => (
            <View key={r.session.id}>
              <Pressable onPress={() => setExpandedRow(expandedRow === r.session.id ? null : r.session.id)}>
                <View style={[styles.tableRow, { borderBottomColor: c.border, backgroundColor: getRowBg(r) }]}>
                  <Text style={[styles.td, styles.thName, { color: c.text }]} numberOfLines={1}>
                    {r.candidate.name || r.candidate.email}
                  </Text>
                  <View style={[styles.td, styles.thStatus]}>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor:
                          r.session.status === 'completed' ? c.success : c.textMuted,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSizes.xs,
                          color:
                            r.session.status === 'completed' ? c.success : c.textMuted,
                        }}
                      >
                        {r.session.status}
                      </Text>
                    </Badge>
                  </View>
                  <Text style={[styles.td, styles.thPassed, { color: r.challengesPassed === r.totalChallenges ? c.success : c.text }]}>
                    {r.challengesPassed}/{r.totalChallenges}
                  </Text>
                  <Text style={[styles.td, styles.thCost, { color: c.accent }]}>
                    {formatCost(r.session.totalCost)}
                  </Text>
                  <Text style={[styles.td, styles.thTokens, { color: c.textMuted }]}>
                    {r.session.totalTokens.toLocaleString()}
                  </Text>
                  <Text style={[styles.td, styles.thTime, { color: c.textMuted }]}>
                    {formatDuration(getDuration(r))}
                  </Text>
                </View>
              </Pressable>

              {/* Expanded row: per-challenge AI analytics */}
              {expandedRow === r.session.id && r.attempts && (
                <View style={[styles.expandedRow, { backgroundColor: c.muted + '10', borderBottomColor: c.border }]}>
                  {r.attempts.map((a, i) => (
                    <View key={i} style={[styles.attemptRow, { borderBottomColor: c.border }]}>
                      <View style={styles.attemptHeader}>
                        <Text style={[styles.attemptChallenge, { color: c.text }]}>
                          Challenge {i + 1}
                        </Text>
                        <Badge
                          variant="outline"
                          style={{ borderColor: a.status === 'passed' ? c.success : c.destructive }}
                        >
                          <Text style={{ fontSize: 10, color: a.status === 'passed' ? c.success : c.destructive }}>
                            {a.status} ({a.passedTests}/{a.totalTests})
                          </Text>
                        </Badge>
                        <Text style={{ fontSize: fontSizes.xs, color: c.accent, marginLeft: 'auto' }}>
                          {formatCost(a.totalCost)}
                        </Text>
                      </View>
                      {Object.keys(a.modelUsage).length > 0 && (
                        <View style={styles.modelUsageRow}>
                          {Object.entries(a.modelUsage).map(([modelId, usage]) => {
                            const mi = getModelById(modelId);
                            return (
                              <View key={modelId} style={[styles.modelUsageBadge, { borderColor: mi ? tierColor(mi.tier) : c.border }]}>
                                <Text style={{ fontSize: 10, color: mi ? tierColor(mi.tier) : c.textMuted }}>
                                  {mi?.displayName || modelId.split('/').pop()} {'\u00B7'} {usage.calls}x {'\u00B7'} {formatCost(usage.cost)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body, marginTop: spacing.sm },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  empty: { borderWidth: 1 },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  th: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'uppercase' },
  td: { fontSize: fontSizes.sm },
  thName: { flex: 3 },
  thStatus: { flex: 2 },
  thPassed: { flex: 1, textAlign: 'center' },
  thCost: { flex: 1, textAlign: 'right' },
  thTokens: { flex: 1, textAlign: 'right' },
  thTime: { flex: 1, textAlign: 'right' },
  expandedRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  attemptRow: { paddingVertical: spacing.xs, borderBottomWidth: 1 },
  attemptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attemptChallenge: { fontSize: fontSizes.xs, fontWeight: '600' },
  modelUsageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  modelUsageBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
});
