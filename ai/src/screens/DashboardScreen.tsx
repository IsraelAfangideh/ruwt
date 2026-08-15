import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/layout/DashboardLayout';
import { useAuth } from '@/lib/AuthContext';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, radii, spacing } from '@/theme/tokens';

type Overview = { activeAgents: number; sessions: number; events: number; totalCostMicros: number; firstPassTestRate: number; mergedPullRequests: number; coverage: number };
type Insight = { ruleId: string; title: string; summary: string; confidence: 'high' | 'medium' | 'low'; coverage: number; sampleSize: number; recommendation: string; limitations: string };
type Event = { id: string; timestamp: string; type: string; agentVendor?: string; repository?: string; outcome?: string; redactionStatus: string; confidence: string };
type Workspace = { id: string; name: string; role: string };

const emptyOverview: Overview = { activeAgents: 0, sessions: 0, events: 0, totalCostMicros: 0, firstPassTestRate: 0, mergedPullRequests: 0, coverage: 0 };

function formatMoney(micros: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(micros / 1_000_000);
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const c = useColors();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState('');
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState('');
  const [sampled, setSampled] = useState(false);

  const loadOverview = useCallback(async (id: string) => {
    if (!id) { setBusy(false); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/intelligence/overview?orgId=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('Ruwt cannot load this workspace.');
      const data = await response.json() as { overview: Overview; insights: Insight[]; recentEvents: Event[]; sampled: boolean };
      setOverview(data.overview);
      setInsights(data.insights);
      setEvents(data.recentEvents);
      setSampled(data.sampled);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ruwt cannot load this workspace.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/orgs').then(async (response) => {
      if (!response.ok) throw new Error('Ruwt cannot load workspaces.');
      return response.json() as Promise<Workspace[]>;
    }).then((items) => {
      setWorkspaces(items);
      const first = items[0]?.id ?? '';
      setOrgId(first);
      return loadOverview(first);
    }).catch(() => {
      setError('Ruwt cannot load your workspaces.');
      setBusy(false);
    });
  }, [user, loadOverview]);

  const createDemo = async () => {
    if (!orgId) return;
    setLoadingDemo(true);
    setError('');
    try {
      const response = await fetch('/api/intelligence/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!response.ok) throw new Error('Ruwt cannot create demo data. You need an administrator role.');
      await loadOverview(orgId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ruwt cannot create demo data.');
    } finally {
      setLoadingDemo(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <View style={styles.page}>
        <View style={[styles.masthead, { borderBottomColor: c.borderStrong }]}>
          <View style={styles.mastheadCopy}>
            <Text style={[styles.kicker, { color: c.accent }]}>AGENT OBSERVATION</Text>
            <Text style={[styles.title, { color: c.text }]}>Evidence before opinion.</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              ruwt.ai connects agent activity to tests, delivery, cost, and policy signals. It does not grade people.
            </Text>
          </View>
          <View style={[styles.workspaceBox, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.workspaceLabel, { color: c.textMuted }]}>WORKSPACE</Text>
            <View style={styles.workspaceChoices}>
              {workspaces.map((workspace) => (
                <Pressable
                  key={workspace.id}
                  onPress={() => { setOrgId(workspace.id); void loadOverview(workspace.id); }}
                  style={[styles.workspaceChoice, workspace.id === orgId && { backgroundColor: c.accentBg }]}
                >
                  <Text style={[styles.workspaceText, { color: workspace.id === orgId ? c.text : c.textMuted }]}>{workspace.name}</Text>
                </Pressable>
              ))}
              {!workspaces.length && (
                <Pressable onPress={() => (navigation as any).navigate('OrgSettings')}>
                  <Text style={[styles.workspaceText, { color: c.accent }]}>Create a workspace</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {error ? <View style={[styles.notice, { backgroundColor: c.errorBg, borderColor: c.error }]}><Text style={[styles.noticeText, { color: c.error }]}>{error}</Text></View> : null}
        {busy ? <View style={styles.center}><ActivityIndicator color={c.accent} /></View> : !orgId ? (
          <EmptyWorkspace onCreate={() => (navigation as any).navigate('OrgSettings')} c={c} />
        ) : (
          <>
            <View style={styles.metricGrid}>
              <Metric label="Active agents" value={String(overview.activeAgents)} note="Observed in this workspace" c={c} />
              <Metric label="Agent sessions" value={String(overview.sessions)} note={sampled ? 'Latest 2,000 event sample' : `${overview.events} accepted events`} c={c} />
              <Metric label="Estimated cost" value={formatMoney(overview.totalCostMicros)} note={sampled ? 'Latest 2,000 event sample' : 'From recorded usage metadata'} c={c} />
              <Metric label="First-pass tests" value={`${overview.firstPassTestRate}%`} note="Only observed completed tests" c={c} />
              <Metric label="Merged pull requests" value={String(overview.mergedPullRequests)} note="Connected activity only" c={c} />
              <Metric label="Data coverage" value={`${overview.coverage}%`} note="Actor, repository, and agent known" c={c} />
            </View>

            {!overview.events ? (
              <View style={[styles.emptyData, { borderColor: c.border, backgroundColor: c.card }]}>
                <Text style={[styles.emptyTitle, { color: c.text }]}>Start with a reliable sample</Text>
                <Text style={[styles.emptyText, { color: c.textMuted }]}>Add clearly labeled simulated data to explore the metrics and insight rules.</Text>
                <Pressable onPress={() => void createDemo()} disabled={loadingDemo} style={[styles.demoButton, { backgroundColor: c.primary }]}>
                  <Text style={[styles.demoButtonText, { color: c.primaryForeground }]}>{loadingDemo ? 'Creating simulated events…' : 'Create simulated demo data'}</Text>
                </Pressable>
              </View>
            ) : null}

            <SectionHeading kicker="EVIDENCE LEDGER" title="What needs attention" note="Rules are deterministic. Results show correlation, not causation." c={c} />
            <View style={styles.ledger}>
              {insights.length ? insights.map((insight) => (
                <View key={insight.ruleId} style={[styles.insight, { borderColor: c.border, backgroundColor: c.card }]}>
                  <View style={[styles.insightRail, { backgroundColor: insight.confidence === 'high' ? c.accent : c.borderStrong }]} />
                  <View style={styles.insightBody}>
                    <View style={styles.insightTop}>
                      <Text style={[styles.insightTitle, { color: c.text }]}>{insight.title}</Text>
                      <Text style={[styles.confidence, { color: c.textMuted }]}>{insight.confidence} confidence · n={insight.sampleSize}</Text>
                    </View>
                    <Text style={[styles.insightSummary, { color: c.textMuted }]}>{insight.summary}</Text>
                    <Text style={[styles.recommendation, { color: c.text }]}>{insight.recommendation}</Text>
                    <Text style={[styles.limitation, { color: c.textSubtle }]}>{insight.limitations}</Text>
                  </View>
                </View>
              )) : (
                <View style={[styles.emptyInsight, { borderColor: c.border }]}>
                  <Text style={{ color: c.textMuted }}>Ruwt needs more complete activity before it can generate a supported insight.</Text>
                </View>
              )}
            </View>

            <SectionHeading kicker="RECENT ACTIVITY" title="Normalized and redacted" note="Raw prompts and source code stay disabled by default." c={c} />
            <View style={[styles.activityTable, { borderColor: c.border, backgroundColor: c.card }]}>
              {events.length ? events.map((event) => (
                <View key={event.id} style={[styles.eventRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.eventTime, { color: c.textMuted }]}>{relativeTime(event.timestamp)}</Text>
                  <View style={styles.eventMiddle}>
                    <Text style={[styles.eventName, { color: c.text }]}>{event.type}</Text>
                    <Text style={[styles.eventDetail, { color: c.textMuted }]}>{event.agentVendor ?? 'Unknown agent'} · {event.repository ?? 'Repository not available'}</Text>
                  </View>
                  <Text style={[styles.eventState, { color: c.textMuted }]}>{event.redactionStatus}</Text>
                </View>
              )) : (
                <Text style={[styles.emptyActivity, { color: c.textMuted }]}>No accepted activity exists in this workspace.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </DashboardLayout>
  );
}

function Metric({ label, value, note, c }: { label: string; value: string; note: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.metric, { borderColor: c.border, backgroundColor: c.card }]}>
      <Text style={[styles.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.metricNote, { color: c.textSubtle }]}>{note}</Text>
    </View>
  );
}

function SectionHeading({ kicker, title, note, c }: { kicker: string; title: string; note: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={[styles.sectionLabel, { color: c.accent }]}>{kicker}</Text>
        <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
      </View>
      <Text style={[styles.methodNote, { color: c.textMuted }]}>{note}</Text>
    </View>
  );
}

function EmptyWorkspace({ onCreate, c }: { onCreate: () => void; c: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.emptyData, { borderColor: c.border, backgroundColor: c.card }]}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>Create an organization workspace</Text>
      <Text style={[styles.emptyText, { color: c.textMuted }]}>Organizations isolate data, roles, ingestion keys, and policy records.</Text>
      <Pressable onPress={onCreate} style={[styles.demoButton, { backgroundColor: c.primary }]}>
        <Text style={[styles.demoButtonText, { color: c.primaryForeground }]}>Open organization settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.xl, paddingBottom: spacing['2xl'] },
  center: { minHeight: 320, justifyContent: 'center', alignItems: 'center' },
  masthead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xl, paddingBottom: spacing.xl, borderBottomWidth: 1, flexWrap: 'wrap' },
  mastheadCopy: { flex: 1, minWidth: 280, maxWidth: 680, gap: spacing.sm },
  kicker: { fontFamily: fontFamily.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: fontFamily.display, fontSize: 46, lineHeight: 50, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, lineHeight: 24, maxWidth: 620 },
  workspaceBox: { width: 260, minWidth: 220, padding: spacing.md, borderWidth: 1, borderRadius: radii.md, gap: spacing.sm },
  workspaceLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1 },
  workspaceChoices: { gap: 2 },
  workspaceChoice: { padding: 8, borderRadius: radii.sm },
  workspaceText: { fontSize: fontSizes.sm, fontWeight: '600' },
  notice: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  noticeText: { fontSize: fontSizes.sm },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { width: '31%', minWidth: 160, flexGrow: 1, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: 6 },
  metricLabel: { fontSize: fontSizes.xs, fontWeight: '600' },
  metricValue: { fontFamily: fontFamily.display, fontWeight: '700', fontSize: 32, lineHeight: 38 },
  metricNote: { fontSize: 11, lineHeight: 16 },
  emptyData: { padding: spacing.xl, borderWidth: 1, borderRadius: radii.md, gap: spacing.md, alignItems: 'flex-start' },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: fontSizes['3xl'], fontWeight: '700' },
  emptyText: { fontSize: fontSizes.sm, lineHeight: 21, maxWidth: 640 },
  demoButton: { paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radii.sm },
  demoButtonText: { fontSize: fontSizes.sm, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.lg, gap: spacing.md, flexWrap: 'wrap' },
  sectionLabel: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1 },
  sectionTitle: { fontFamily: fontFamily.display, fontSize: 30, fontWeight: '700', marginTop: 3 },
  methodNote: { fontSize: 11, maxWidth: 280, textAlign: 'right', lineHeight: 16 },
  ledger: { gap: spacing.sm },
  insight: { borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', overflow: 'hidden' },
  insightRail: { width: 4 },
  insightBody: { flex: 1, padding: spacing.md, gap: 7 },
  insightTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  insightTitle: { fontSize: fontSizes.md, fontWeight: '700', flex: 1 },
  confidence: { fontFamily: fontFamily.mono, fontSize: 10 },
  insightSummary: { fontSize: fontSizes.sm, lineHeight: 20 },
  recommendation: { fontSize: fontSizes.sm, fontWeight: '600', marginTop: 2 },
  limitation: { fontSize: 11, lineHeight: 16 },
  emptyInsight: { borderWidth: 1, borderStyle: 'dashed', padding: spacing.lg, borderRadius: radii.md },
  activityTable: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 1, flexWrap: 'wrap' },
  eventTime: { width: 82, fontFamily: fontFamily.mono, fontSize: 10 },
  eventMiddle: { flex: 1, minWidth: 180, gap: 3 },
  eventName: { fontSize: fontSizes.sm, fontWeight: '700' },
  eventDetail: { fontSize: 12 },
  eventState: { width: 95, textAlign: 'right', fontFamily: fontFamily.mono, fontSize: 10 },
  emptyActivity: { padding: spacing.lg, textAlign: 'center', fontSize: fontSizes.sm },
});
