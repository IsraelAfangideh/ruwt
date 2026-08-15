import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DashboardLayout } from '@/layout/DashboardLayout';
import { useAuth } from '@/lib/AuthContext';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, radii, spacing } from '@/theme/tokens';

type Snapshot = {
  totals: { visits: number; uniqueVisitors: number; downloads: number };
  today: {
    visits: number;
    newVisitors: number;
    downloads: number;
    humanVisits: number;
    botVisits: number;
  };
  recentVisits: Array<{
    id: string;
    path: string;
    referrer: string | null;
    visitorKind: string;
    isNewVisitor: boolean;
    createdAt: string;
  }>;
  recentDownloads: Array<{
    id: string;
    platform: string;
    source: string;
    createdAt: string;
  }>;
};

function clock(value: string) {
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}

export function HitsScreen() {
  const { user } = useAuth();
  const c = useColors();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    fetch('/api/marketing/stats')
      .then(async (res) => {
        if (res.status === 404) throw new Error('Hits are only visible to the ruwt.ai operator.');
        if (!res.ok) throw new Error('Could not load hits.');
        return res.json() as Promise<Snapshot>;
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  }, []);

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <View style={styles.page}>
        <Text style={[styles.kicker, { color: c.accent }]}>SITE</Text>
        <Text style={[styles.title, { color: c.text }]}>Hits</Text>
        <Text style={[styles.lede, { color: c.textMuted }]}>
          ruwt.ai visits and download clicks. Counts are exact — no inbox arithmetic.
        </Text>

        {busy ? <View style={styles.center}><ActivityIndicator color={c.accent} /></View> : null}
        {error ? (
          <View style={[styles.notice, { backgroundColor: c.errorBg, borderColor: c.error }]}>
            <Text style={[styles.noticeText, { color: c.error }]}>{error}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.grid}>
              <Stat label="Visits today" value={String(data.today.visits)} note={`${data.today.humanVisits} human · ${data.today.botVisits} bot`} c={c} />
              <Stat label="New today" value={String(data.today.newVisitors)} note="First-time visitor IDs" c={c} />
              <Stat label="Downloads today" value={String(data.today.downloads)} note="Header, landing, or /download" c={c} />
              <Stat label="All unique" value={String(data.totals.uniqueVisitors)} note={`${data.totals.visits} visits · ${data.totals.downloads} downloads`} c={c} />
            </View>

            <Text style={[styles.section, { color: c.text }]}>Recent visits</Text>
            <View style={[styles.table, { borderColor: c.border, backgroundColor: c.card }]}>
              {data.recentVisits.length ? data.recentVisits.map((visit) => (
                <View key={visit.id} style={[styles.row, { borderBottomColor: c.border }]}>
                  <Text style={[styles.time, { color: c.textMuted }]}>{clock(visit.createdAt)}</Text>
                  <View style={styles.mid}>
                    <Text style={[styles.path, { color: c.text }]}>{visit.path}</Text>
                    <Text style={[styles.meta, { color: c.textMuted }]}>{visit.referrer || 'Direct'}</Text>
                  </View>
                  <Text style={[styles.kind, { color: c.textMuted }]}>
                    {visit.visitorKind}{visit.isNewVisitor ? ' · new' : ''}
                  </Text>
                </View>
              )) : (
                <Text style={[styles.empty, { color: c.textMuted }]}>No visits recorded yet.</Text>
              )}
            </View>

            <Text style={[styles.section, { color: c.text }]}>Downloads</Text>
            <View style={[styles.table, { borderColor: c.border, backgroundColor: c.card }]}>
              {data.recentDownloads.length ? data.recentDownloads.map((click) => (
                <View key={click.id} style={[styles.row, { borderBottomColor: c.border }]}>
                  <Text style={[styles.time, { color: c.textMuted }]}>{clock(click.createdAt)}</Text>
                  <Text style={[styles.path, { color: c.text }]}>{click.platform}</Text>
                  <Text style={[styles.kind, { color: c.textMuted }]}>{click.source}</Text>
                </View>
              )) : (
                <Text style={[styles.empty, { color: c.textMuted }]}>No download clicks yet.</Text>
              )}
            </View>
          </>
        ) : null}
      </View>
    </DashboardLayout>
  );
}

function Stat({
  label, value, note, c,
}: { label: string; value: string; note: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.stat, { borderColor: c.border, backgroundColor: c.card }]}>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.statNote, { color: c.textSubtle }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: spacing['2xl'] },
  center: { minHeight: 180, justifyContent: 'center', alignItems: 'center' },
  kicker: { fontFamily: fontFamily.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: fontFamily.display, fontSize: 46, lineHeight: 50, fontWeight: '700' },
  lede: { fontSize: fontSizes.md, lineHeight: 24, maxWidth: 620 },
  notice: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1 },
  noticeText: { fontSize: fontSizes.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { width: '22%', minWidth: 150, flexGrow: 1, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: 6 },
  statLabel: { fontSize: fontSizes.xs, fontWeight: '600' },
  statValue: { fontFamily: fontFamily.display, fontWeight: '700', fontSize: 32, lineHeight: 38 },
  statNote: { fontSize: 11, lineHeight: 16 },
  section: { fontFamily: fontFamily.display, fontSize: 28, fontWeight: '700', marginTop: spacing.md },
  table: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 1, flexWrap: 'wrap' },
  time: { width: 110, fontFamily: fontFamily.mono, fontSize: 11 },
  mid: { flex: 1, minWidth: 180, gap: 3 },
  path: { fontSize: fontSizes.sm, fontWeight: '700' },
  meta: { fontSize: 12 },
  kind: { fontFamily: fontFamily.mono, fontSize: 11 },
  empty: { padding: spacing.lg, textAlign: 'center', fontSize: fontSizes.sm },
});
