import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type LeaderboardEntry = {
  rank: number;
  user: { id: string; name: string; avatarUrl?: string | null };
  stats?: { solved: number; attempts: number; avgCost: number; totalCost: number };
};

export function LeaderboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const c = useColors();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const r = await fetch(`${base}/api/leaderboard?limit=50`);
        if (r.ok) {
          const data = await r.json();
          setEntries(data.entries ?? []);
        }
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, [navigation]);

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }
  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>Leaderboard</Text>
      {entries.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No rankings yet. Be the first to submit!</Text>
        </Card>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.podium}>
            {[1, 0, 2].map((i) => {
              const e = entries[i];
              if (!e) return null;
              return (
                <View key={e.user.id} style={[styles.podiumItem, i === 1 && styles.podiumFirst]}>
                  <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={i === 1 ? 56 : 40} />
                  <Text style={[styles.podiumName, { color: c.text }]} numberOfLines={1}>{e.user.name}</Text>
                  <Text style={[styles.podiumRank, { color: c.accent }]}>#{e.rank}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.table}>
            {entries.map((e) => (
              <View key={e.user.id} style={[styles.row, { borderBottomColor: c.border }]}>
                <Text style={[styles.rank, { color: c.textMuted }]}>{e.rank}</Text>
                <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={28} />
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{e.user.name}</Text>
                {e.stats ? (
                  <Text style={[styles.stats, { color: c.textMuted }]}>
                    {e.stats.solved} solved · avg ${(e.stats.avgCost / 10000).toFixed(4)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.lg, fontFamily: fontFamily.body },
  empty: { padding: spacing.lg },
  emptyText: { textAlign: 'center' },
  scroll: { flex: 1 },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.lg, marginBottom: spacing.xl },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumFirst: { order: -1 },
  podiumName: { fontSize: fontSizes.sm, fontWeight: '600', marginTop: spacing.xs },
  podiumRank: { fontSize: fontSizes.xs, marginTop: 2 },
  table: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  rank: { width: 32, fontSize: fontSizes.sm },
  name: { flex: 1, fontSize: fontSizes.sm },
  stats: { fontSize: fontSizes.xs },
});
