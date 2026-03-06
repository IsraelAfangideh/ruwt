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
import { getModelById, tierColor, formatCostFromHundredths } from '@/lib/ai/pricing';
import { AIProfileRadar, type AIProfile } from '@/components/AIProfileRadar';
import { CandidateInsightsPanel } from '@/components/CandidateInsightsPanel';
import { CandidateComparisonView } from '@/components/CandidateComparisonView';
import { VerdictBadge, computeVerdict, type Verdict } from '@/components/VerdictBadge';
import { InviteManagementTable } from '@/components/InviteManagementTable';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttemptDetail {
  attemptId: string;
  challengeId: string;
  challengeTitle?: string;
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

interface BehavioralInsight {
  type: string;
  severity: 'green' | 'yellow' | 'red';
  narrative: string;
  challengeIndex: number;
  timestamp: string;
}

interface ComparativeMetric {
  metric: string;
  candidateValue: number;
  medianValue: number;
  percentile: number;
  narrative: string;
}

interface HighlightMoment {
  timestamp: string;
  type: 'model_switch' | 'error_recovery' | 'cost_spike' | 'escalation' | 'pass';
  narrative: string;
  challengeIndex: number;
  cost?: number;
}

interface SessionInsights {
  insights: BehavioralInsight[];
  comparatives: ComparativeMetric[];
  flags: { green: string[]; red: string[]; yellow: string[] };
  highlights: HighlightMoment[];
}

type SortKey = 'name' | 'status' | 'passed' | 'cost' | 'tokens' | 'time' | 'verdict';
type VerdictFilter = 'all' | 'pass' | 'fail' | 'review';

interface PassThreshold {
  enabled: boolean;
  mode: 'all_dimensions' | 'weighted_average';
  minOverall?: number;
  dimensions: Record<string, number>;
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const [aiProfiles, setAiProfiles] = useState<Record<string, AIProfile>>({});
  const [allInsights, setAllInsights] = useState<Record<string, SessionInsights>>({});
  const [showComparison, setShowComparison] = useState(false);
  const [passThreshold, setPassThreshold] = useState<PassThreshold | null>(null);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number> | undefined>(undefined);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [activeTab, setActiveTab] = useState<'results' | 'invites'>('results');

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const [resultsRes, analyticsRes, insightsRes, assessmentRes] = await Promise.all([
          fetch(`/api/assessments/${params.assessmentId}/results`),
          fetch(`/api/assessments/${params.assessmentId}/analytics`),
          fetch(`/api/assessments/${params.assessmentId}/insights`),
          fetch(`/api/assessments/${params.assessmentId}`),
        ]);
        if (resultsRes.ok) setResults(await resultsRes.json());
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json() as { profiles: Record<string, AIProfile> };
          setAiProfiles(analyticsData.profiles ?? {});
        }
        if (insightsRes.ok) {
          setAllInsights(await insightsRes.json());
        }
        if (assessmentRes.ok) {
          const aData = await assessmentRes.json();
          if (aData.passThreshold) {
            try { setPassThreshold(JSON.parse(aData.passThreshold)); } catch {}
          }
          if (aData.categoryWeights) {
            try { setCategoryWeights(JSON.parse(aData.categoryWeights)); } catch {}
          }
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, params.assessmentId]);

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

  const getVerdict = useCallback((sessionId: string): Verdict => {
    const profile = aiProfiles[sessionId];
    if (!profile || !passThreshold) return null;
    return computeVerdict(profile as unknown as Record<string, number>, passThreshold, categoryWeights);
  }, [aiProfiles, passThreshold, categoryWeights]);

  const filtered = verdictFilter === 'all'
    ? results
    : results.filter((r) => getVerdict(r.session.id) === verdictFilter);

  const sorted = [...filtered].sort((a, b) => {
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
      case 'verdict': {
        const order = { pass: 3, review: 2, fail: 1 };
        const va = getVerdict(a.session.id);
        const vb = getVerdict(b.session.id);
        cmp = (order[va as keyof typeof order] ?? 0) - (order[vb as keyof typeof order] ?? 0);
        break;
      }
    }
    return sortAsc ? cmp : -cmp;
  });

  const getRowBg = (r: CandidateResult): string => {
    if (r.challengesPassed === r.totalChallenges) return 'rgba(63,185,80,0.06)';
    if (r.challengesPassed > 0) return 'rgba(201,169,98,0.06)';
    return 'rgba(248,81,73,0.06)';
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Candidate', 'Email', 'Status', 'Verdict', 'Passed', 'Total', 'Cost', 'Tokens', 'Duration', 'Green Flags', 'Red Flags'];
    const rows = sorted.map((r) => {
      const ins = allInsights[r.session.id];
      const v = getVerdict(r.session.id);
      return [
        r.candidate.name || '',
        r.candidate.email,
        r.session.status,
        v ?? '',
        r.challengesPassed,
        r.totalChallenges,
        (r.session.totalCost / 10000).toFixed(4),
        r.session.totalTokens,
        formatDuration(getDuration(r)),
        ins?.flags.green.join('; ') ?? '',
        ins?.flags.red.join('; ') ?? '',
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-results-${params.assessmentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, params.assessmentId, allInsights, getVerdict]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  // Summary stats for the header
  const completed = results.filter((r) => r.session.status === 'completed');
  const avgCost = completed.length > 0
    ? completed.reduce((s, r) => s + r.session.totalCost, 0) / completed.length
    : 0;
  const passCount = passThreshold?.enabled
    ? results.filter((r) => getVerdict(r.session.id) === 'pass').length
    : completed.filter((r) => r.challengesPassed === r.totalChallenges).length;
  const failCount = passThreshold?.enabled
    ? results.filter((r) => getVerdict(r.session.id) === 'fail').length
    : completed.filter((r) => r.challengesPassed === 0).length;
  const inProgress = results.filter((r) => r.session.status === 'in_progress').length;

  const SortHeader = ({ label, sortKey, style }: { label: string; sortKey: SortKey; style?: any }) => (
    <Pressable onPress={() => handleSort(sortKey)} style={style}>
      <Text style={[styles.th, { color: c.textMuted }]}>
        {label} {sortBy === sortKey ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
      </Text>
    </Pressable>
  );

  // Build candidate options for comparison view
  const comparisonCandidates = results.map((r) => ({
    sessionId: r.session.id,
    name: r.candidate.name || '',
    email: r.candidate.email,
    challengesPassed: r.challengesPassed,
    totalChallenges: r.totalChallenges,
    totalCost: r.session.totalCost,
    totalTokens: r.session.totalTokens,
  }));

  return (
    <DashboardLayout user={user} requireTeam>
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
          <View style={styles.headerActions}>
            {results.length >= 2 && (
              <Button
                variant={showComparison ? 'default' : 'outline'}
                size="sm"
                onPress={() => setShowComparison(!showComparison)}
              >
                {showComparison ? 'Hide Comparison' : 'Compare Candidates'}
              </Button>
            )}
            {results.length > 0 && (
              <Button variant="outline" size="sm" onPress={handleExportCSV}>
                Export CSV
              </Button>
            )}
          </View>
        </View>
      </View>

      {/* Summary stats */}
      {results.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: c.text }]}>{completed.length}</Text>
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Completed</Text>
          </View>
          {inProgress > 0 && (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: c.accent }]}>{inProgress}</Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>In Progress</Text>
            </View>
          )}
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: c.success }]}>{passCount}</Text>
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>{passThreshold?.enabled ? 'Pass' : 'All Passed'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: c.destructive }]}>{failCount}</Text>
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>{passThreshold?.enabled ? 'Fail' : 'None Passed'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: c.accent }]}>{formatCostFromHundredths(avgCost)}</Text>
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>Avg Cost</Text>
          </View>
        </View>
      )}

      {/* Tab switcher: Results / Invites */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('results')}
          style={[styles.tabBtn, activeTab === 'results' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
        >
          <Text style={{ color: activeTab === 'results' ? c.accent : c.textMuted, fontSize: fontSizes.sm, fontWeight: '600' }}>
            Results ({results.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('invites')}
          style={[styles.tabBtn, activeTab === 'invites' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
        >
          <Text style={{ color: activeTab === 'invites' ? c.accent : c.textMuted, fontSize: fontSizes.sm, fontWeight: '600' }}>
            Invites
          </Text>
        </Pressable>
      </View>

      {activeTab === 'invites' ? (
        <View style={{ marginTop: spacing.md }}>
          <InviteManagementTable assessmentId={params.assessmentId} />
        </View>
      ) : (
      <>

      {/* Verdict filter bar */}
      {passThreshold?.enabled && (
        <View style={styles.verdictFilterBar}>
          {(['all', 'pass', 'fail', 'review'] as VerdictFilter[]).map((v) => {
            const count = v === 'all'
              ? results.length
              : results.filter((r) => getVerdict(r.session.id) === v).length;
            return (
              <Pressable
                key={v}
                onPress={() => setVerdictFilter(v)}
                style={[
                  styles.verdictFilterBtn,
                  { borderColor: verdictFilter === v ? c.accent : c.border },
                  verdictFilter === v && { backgroundColor: c.accent + '10' },
                ]}
              >
                <Text style={{
                  fontSize: fontSizes.xs,
                  fontWeight: '600',
                  color: verdictFilter === v ? c.accent : c.textMuted,
                  textTransform: 'capitalize',
                }}>
                  {v} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Candidate comparison panel */}
      {showComparison && results.length >= 2 && (
        <CandidateComparisonView
          candidates={comparisonCandidates}
          profiles={aiProfiles}
          insightsData={allInsights}
          formatCost={formatCostFromHundredths}
        />
      )}

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
            {passThreshold?.enabled && (
              <SortHeader label="Verdict" sortKey="verdict" style={styles.thVerdict} />
            )}
            <SortHeader label="Passed" sortKey="passed" style={styles.thPassed} />
            <SortHeader label="Cost" sortKey="cost" style={styles.thCost} />
            <SortHeader label="Tokens" sortKey="tokens" style={styles.thTokens} />
            <SortHeader label="Time" sortKey="time" style={styles.thTime} />
            <View style={styles.thSignals}>
              <Text style={[styles.th, { color: c.textMuted }]}>Signals</Text>
            </View>
            <View style={styles.thActions}>
              <Text style={[styles.th, { color: c.textMuted }]}>Actions</Text>
            </View>
          </View>
          {sorted.map((r) => {
            const sessionInsights = allInsights[r.session.id];
            const verdict = getVerdict(r.session.id);
            return (
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
                    {passThreshold?.enabled && (
                      <View style={[styles.td, styles.thVerdict]}>
                        <VerdictBadge verdict={verdict} size="sm" />
                      </View>
                    )}
                    <Text style={[styles.td, styles.thPassed, { color: r.challengesPassed === r.totalChallenges ? c.success : c.text }]}>
                      {r.challengesPassed}/{r.totalChallenges}
                    </Text>
                    <Text style={[styles.td, styles.thCost, { color: c.accent }]}>
                      {formatCostFromHundredths(r.session.totalCost)}
                    </Text>
                    <Text style={[styles.td, styles.thTokens, { color: c.textMuted }]}>
                      {r.session.totalTokens.toLocaleString()}
                    </Text>
                    <Text style={[styles.td, styles.thTime, { color: c.textMuted }]}>
                      {formatDuration(getDuration(r))}
                    </Text>
                    {/* Inline signal flags */}
                    <View style={[styles.td, styles.thSignals]}>
                      {sessionInsights && (
                        <View style={styles.inlineFlags}>
                          {sessionInsights.flags.green.length > 0 && (
                            <View style={[styles.flagDot, { backgroundColor: '#5a8a5a' }]}>
                              <Text style={styles.flagDotText}>{sessionInsights.flags.green.length}</Text>
                            </View>
                          )}
                          {sessionInsights.flags.red.length > 0 && (
                            <View style={[styles.flagDot, { backgroundColor: '#c87878' }]}>
                              <Text style={styles.flagDotText}>{sessionInsights.flags.red.length}</Text>
                            </View>
                          )}
                          {sessionInsights.flags.yellow.length > 0 && (
                            <View style={[styles.flagDot, { backgroundColor: '#e5a639' }]}>
                              <Text style={styles.flagDotText}>{sessionInsights.flags.yellow.length}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={[styles.td, styles.thActions]}>
                      {r.session.shareToken && (
                        <Pressable
                          onPress={(e: any) => {
                            e.stopPropagation?.();
                            window.open(`/results/${r.session.shareToken}`, '_blank');
                          }}
                        >
                          <Text style={{ fontSize: fontSizes.xs, color: c.accent, textDecorationLine: 'underline' }}>
                            View Results
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>

                {/* Expanded row: Full insights panel */}
                {expandedRow === r.session.id && (
                  <View style={[styles.expandedRow, { backgroundColor: c.muted + '10', borderBottomColor: c.border }]}>
                    {sessionInsights ? (
                      <CandidateInsightsPanel
                        profile={aiProfiles[r.session.id]}
                        insights={sessionInsights.insights}
                        comparatives={sessionInsights.comparatives}
                        flags={sessionInsights.flags}
                        highlights={sessionInsights.highlights}
                        formatCost={formatCostFromHundredths}
                      />
                    ) : (
                      // Fallback: show radar + basic attempt info if insights not available
                      <>
                        {aiProfiles[r.session.id] && (
                          <View style={styles.fallbackRadar}>
                            <Text style={[styles.fallbackTitle, { color: c.text }]}>AI Profile</Text>
                            <AIProfileRadar profile={aiProfiles[r.session.id]} size={240} />
                          </View>
                        )}
                      </>
                    )}

                    {/* Per-challenge details */}
                    {r.attempts && r.attempts.length > 0 && (
                      <View style={styles.challengeDetails}>
                        <Text style={[styles.challengeDetailsTitle, { color: c.text }]}>Challenge Breakdown</Text>
                        {r.attempts.map((a, i) => (
                          <View key={i} style={[styles.attemptRow, { borderBottomColor: c.border }]}>
                            <View style={styles.attemptHeader}>
                              <Text style={[styles.attemptChallenge, { color: c.text }]}>
                                {a.challengeTitle || `Challenge ${i + 1}`}
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
                                {formatCostFromHundredths(a.totalCost)}
                              </Text>
                            </View>
                            {Object.keys(a.modelUsage).length > 0 && (
                              <View style={styles.modelUsageRow}>
                                {Object.entries(a.modelUsage).map(([modelId, usage]) => {
                                  const mi = getModelById(modelId);
                                  return (
                                    <View key={modelId} style={[styles.modelUsageBadge, { borderColor: mi ? tierColor(mi.tier) : c.border }]}>
                                      <Text style={{ fontSize: 10, color: mi ? tierColor(mi.tier) : c.textMuted }}>
                                        {mi?.displayName || modelId.split('/').pop()} {'\u00B7'} {usage.calls}x {'\u00B7'} {formatCostFromHundredths(usage.cost)}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                            {a.attemptId && (
                              <Pressable
                                onPress={() => navigation.navigate('Replay', { attemptId: a.attemptId })}
                                style={{ marginTop: spacing.xs }}
                              >
                                <Text style={{ fontSize: fontSizes.xs, color: c.accent, textDecorationLine: 'underline' }}>
                                  View Replay
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      </>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body, marginTop: spacing.sm },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  empty: { borderWidth: 1 },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  th: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'uppercase' },
  td: { fontSize: fontSizes.sm },
  thName: { flex: 2.5 },
  thStatus: { flex: 1.5 },
  thPassed: { flex: 1, textAlign: 'center' },
  thCost: { flex: 1, textAlign: 'right' },
  thTokens: { flex: 1, textAlign: 'right' },
  thTime: { flex: 1, textAlign: 'right' },
  thVerdict: { flex: 1, alignItems: 'center' },
  thSignals: { flex: 1.2, alignItems: 'center' },
  thActions: { flex: 1.2, alignItems: 'flex-end' },
  summaryBar: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(201,169,98,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,98,0.12)',
  },
  summaryItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  summaryValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  summaryLabel: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  tabBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  verdictFilterBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  verdictFilterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: 6,
  },
  inlineFlags: { flexDirection: 'row', gap: 4 },
  flagDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flagDotText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  expandedRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  challengeDetails: { marginTop: spacing.lg },
  challengeDetailsTitle: { fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.sm },
  attemptRow: { paddingVertical: spacing.xs, borderBottomWidth: 1 },
  attemptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attemptChallenge: { fontSize: fontSizes.xs, fontWeight: '600' },
  modelUsageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  modelUsageBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  fallbackRadar: { alignItems: 'center', marginBottom: spacing.md, paddingVertical: spacing.sm },
  fallbackTitle: { fontSize: fontSizes.sm, fontWeight: '600', marginBottom: spacing.xs, fontFamily: fontFamily.body },
});
