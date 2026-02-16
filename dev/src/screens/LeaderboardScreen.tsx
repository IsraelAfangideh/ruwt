import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PlatformStats } from '@/components/PlatformStats';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ReplayViewer } from '@/components/ReplayViewer';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

type GlobalEntry = {
  rank: number;
  user: { id: string; name: string; avatarUrl?: string | null };
  stats?: { solved: number; attempts: number; avgCost: number; totalCost: number };
};

type ChallengeEntry = {
  rank: number;
  user: { id: string; name: string; avatarUrl?: string | null };
  attemptId: string;
  cost: number;
  tokens: number;
  submittedAt: string | null;
};

type ChallengeInfo = {
  id: string;
  title: string;
  category: string;
};

type Tab = 'global' | 'challenge';
type Period = 'all' | 'month' | 'week';

export function LeaderboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<Period>('all');
  const [globalEntries, setGlobalEntries] = useState<GlobalEntry[]>([]);
  const [challengeEntries, setChallengeEntries] = useState<ChallengeEntry[]>([]);
  const [challenges, setChallenges] = useState<ChallengeInfo[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [replayAttemptId, setReplayAttemptId] = useState<string | null>(null);
  const c = useColors();

  const fetchGlobal = async (p: Period) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const r = await fetch(`${base}/api/leaderboard?limit=50&period=${p}`);
      if (r.ok) {
        const data = await r.json() as { entries: GlobalEntry[] };
        setGlobalEntries(data.entries ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      try {
        const [, chRes] = await Promise.all([
          fetchGlobal('all'),
          fetch(`${base}/api/challenges`),
        ]);
        if (chRes.ok) {
          const chData = await chRes.json() as ChallengeInfo[];
          setChallenges(chData);
        }
      } catch {}
      setLoading(false);
    };
    init();
  }, [navigation]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    if (tab === 'global') {
      fetchGlobal(p);
    } else if (selectedChallenge) {
      fetchChallengeLeaderboard(selectedChallenge, p);
    }
  };

  const fetchChallengeLeaderboard = async (challengeId: string, p?: Period) => {
    if (!challengeId) { setChallengeEntries([]); return; }
    setChallengeLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const r = await fetch(`${base}/api/leaderboard?challengeId=${challengeId}&limit=50&period=${p || period}`);
      if (r.ok) {
        const data = await r.json() as { entries: ChallengeEntry[] };
        setChallengeEntries(data.entries ?? []);
      }
    } catch {}
    setChallengeLoading(false);
  };

  const handleChallengeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedChallenge(id);
    fetchChallengeLeaderboard(id);
  };

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }
  if (!user) return null;

  const formatCost = (hundredths: number) => {
    const d = hundredths / 10000;
    return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
  };

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>Leaderboard</Text>

      {/* Platform stats */}
      <View style={styles.statsWrap}>
        <PlatformStats />
      </View>

      {/* Period tabs */}
      <View style={[styles.periodBar, { borderBottomColor: c.border }]}>
        {([['all', 'All Time'], ['month', 'This Month'], ['week', 'This Week']] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => handlePeriodChange(key)}
            style={[styles.periodTab, { borderBottomColor: period === key ? c.accent : 'transparent' }]}
          >
            <Text style={{ fontSize: fontSizes.xs, fontWeight: period === key ? '700' : '500', color: period === key ? c.text : c.textMuted }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Main tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
        <Button
          variant={tab === 'global' ? 'default' : 'ghost'}
          size="sm"
          onPress={() => setTab('global')}
        >
          Global
        </Button>
        <Button
          variant={tab === 'challenge' ? 'default' : 'ghost'}
          size="sm"
          onPress={() => setTab('challenge')}
        >
          By Challenge
        </Button>
      </View>

      {tab === 'global' ? (
        /* Global leaderboard */
        globalEntries.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>No rankings yet. Be the first to submit!</Text>
          </Card>
        ) : (
          <ScrollView style={styles.scroll}>
            <View style={styles.podium}>
              {[1, 0, 2].map((i) => {
                const e = globalEntries[i];
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
              <View style={[styles.tableHeader, { borderBottomColor: c.border }]}>
                <Text style={[styles.thRank, { color: c.textMuted }]}>#</Text>
                <Text style={[styles.thName, { color: c.textMuted }]}>User</Text>
                <Text style={[styles.thStat, { color: c.textMuted }]}>Solved</Text>
                <Text style={[styles.thStat, { color: c.textMuted }]}>Avg Cost</Text>
                <Text style={[styles.thStat, { color: c.textMuted }]}>Total Cost</Text>
              </View>
              {globalEntries.map((e) => (
                <View key={e.user.id} style={[styles.row, { borderBottomColor: c.border }]}>
                  <Text style={[styles.rank, { color: c.textMuted }]}>{e.rank}</Text>
                  <View style={styles.nameCell}>
                    <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={28} />
                    <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{e.user.name}</Text>
                  </View>
                  {e.stats ? (
                    <>
                      <Text style={[styles.stat, { color: c.text }]}>{e.stats.solved}</Text>
                      <Text style={[styles.stat, { color: c.textMuted }]}>{formatCost(e.stats.avgCost)}</Text>
                      <Text style={[styles.stat, { color: c.textMuted }]}>{formatCost(e.stats.totalCost)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.stat, { color: c.textMuted }]}>-</Text>
                      <Text style={[styles.stat, { color: c.textMuted }]}>-</Text>
                      <Text style={[styles.stat, { color: c.textMuted }]}>-</Text>
                    </>
                  )}
                </View>
              ))}
            </View>

            {/* Activity feed below */}
            <View style={styles.activitySection}>
              <ActivityFeed limit={10} />
            </View>
          </ScrollView>
        )
      ) : (
        /* Per-challenge leaderboard */
        <ScrollView style={styles.scroll}>
          <View style={styles.selectWrap}>
            {/* Use a native <select> for web */}
            <select
              value={selectedChallenge}
              onChange={handleChallengeSelect as any}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 14,
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.card,
                color: c.text as string,
                fontFamily: fontFamily.body,
              }}
            >
              <option value="">Select a challenge...</option>
              {challenges.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title} ({ch.category.replace('_', ' ')})
                </option>
              ))}
            </select>
          </View>

          {challengeLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={c.accent} />
            </View>
          ) : selectedChallenge && challengeEntries.length === 0 ? (
            <Card style={styles.empty}>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>No one has passed this challenge yet.</Text>
            </Card>
          ) : (
            <View style={styles.table}>
              {challengeEntries.map((e) => (
                <View key={`${e.user.id}-${e.rank}`} style={[styles.row, { borderBottomColor: c.border }]}>
                  <Text style={[styles.rank, { color: e.rank <= 3 ? c.accent : c.textMuted }]}>
                    {e.rank <= 3 ? ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][e.rank] : e.rank}
                  </Text>
                  <View style={styles.nameCell}>
                    <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={28} />
                    <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{e.user.name}</Text>
                  </View>
                  <Text style={[styles.stat, { color: c.accent }]}>{formatCost(e.cost)}</Text>
                  <Text style={[styles.stat, { color: c.textMuted }]}>{e.tokens.toLocaleString()} tok</Text>
                  <Pressable
                    onPress={() => setReplayAttemptId(e.attemptId)}
                    style={[styles.replayBtn, { borderColor: c.border }]}
                  >
                    <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Replay</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Replay modal */}
      {replayAttemptId && (
        <ReplayViewer attemptId={replayAttemptId} onClose={() => setReplayAttemptId(null)} />
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.md, fontFamily: fontFamily.body },
  statsWrap: { marginBottom: spacing.lg },
  periodBar: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  periodTab: { paddingBottom: spacing.xs, borderBottomWidth: 2 },
  tabBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  empty: { padding: spacing.lg },
  emptyText: { textAlign: 'center' },
  scroll: { flex: 1 },
  selectWrap: { marginBottom: spacing.lg },
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing.lg, marginBottom: spacing.xl },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumFirst: { order: -1 },
  podiumName: { fontSize: fontSizes.sm, fontWeight: '600', marginTop: spacing.xs },
  podiumRank: { fontSize: fontSizes.xs, marginTop: 2 },
  table: {},
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    marginBottom: spacing.xs,
  },
  thRank: { width: 32, fontSize: fontSizes.xs, fontWeight: '600' },
  thName: { flex: 1, fontSize: fontSizes.xs, fontWeight: '600' },
  thStat: { width: 80, fontSize: fontSizes.xs, fontWeight: '600', textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  rank: { width: 32, fontSize: fontSizes.sm },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: fontSizes.sm },
  stat: { width: 80, fontSize: fontSizes.xs, textAlign: 'right' },
  replayBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activitySection: { marginTop: spacing.xl, paddingTop: spacing.lg },
});
