import { useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Pressable } from 'react-native';
import { TableSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';

import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ActivityFeed } from '@/shared/social/ActivityFeed';
import { ReplayViewer } from '@/features/replay/ReplayViewer';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { useDashboardData } from '@/shared/lib/DashboardDataContext';

type GlobalEntry = {
  rank: number;
  user: { id: string; name: string; avatarUrl?: string | null; username?: string | null };
  stats?: { solved: number; attempts: number; avgCost: number; totalCost: number };
};

type ChallengeEntry = {
  rank: number;
  user: { id: string; name: string; avatarUrl?: string | null; username?: string | null };
  attemptId: string;
  cost: number;
  tokens: number;
  submittedAt: string | null;
};

type Division = 'open' | 'unlimited';

type ChallengeInfo = {
  id: string;
  title: string;
  category: string;
};

type Tab = 'global' | 'challenge';
type Period = 'all' | 'month' | 'week';

interface SeasonInfo {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
}

export function LeaderboardScreen() {
  useDocumentMeta({ title: 'Leaderboard', description: 'See who uses AI most efficiently. Global rankings by challenges solved and average cost.', canonicalPath: '/leaderboard' });
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const { state: cachedData } = useDashboardData();
  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<Period>('week');
  const [localGlobalEntries, setLocalGlobalEntries] = useState<GlobalEntry[] | null>(null);
  const globalEntries = localGlobalEntries ?? cachedData.leaderboard.data as GlobalEntry[];
  const [challengeEntries, setChallengeEntries] = useState<ChallengeEntry[]>([]);
  const challenges = cachedData.challenges.data as ChallengeInfo[];
  const [selectedChallenge, setSelectedChallenge] = useState<string>('');
  const loading = cachedData.leaderboard.status === 'loading' || cachedData.leaderboard.status === 'idle';
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [replayAttemptId, setReplayAttemptId] = useState<string | null>(null);
  const allSeasons = cachedData.seasons.data as SeasonInfo[];
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [division, setDivision] = useState<Division>('open');
  const c = useColors();

  const fetchGlobal = async (p: Period, seasonId?: string, div?: Division) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      let url = `${base}/api/leaderboard?limit=50&period=${p}&division=${div || division}`;
      if (seasonId) url += `&season=${seasonId}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json() as { entries: GlobalEntry[] };
        setLocalGlobalEntries(data.entries ?? []);
      }
    } catch {}
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setSelectedSeason(''); // Clear season filter when using period
    if (tab === 'global') {
      fetchGlobal(p);
    } else if (selectedChallenge) {
      fetchChallengeLeaderboard(selectedChallenge, p);
    }
  };

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeason(seasonId);
    if (seasonId) {
      fetchGlobal(period, seasonId);
    } else {
      fetchGlobal(period);
    }
  };

  const fetchChallengeLeaderboard = async (challengeId: string, p?: Period, div?: Division) => {
    if (!challengeId) { setChallengeEntries([]); return; }
    setChallengeLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const r = await fetch(`${base}/api/leaderboard?challengeId=${challengeId}&limit=50&period=${p || period}&division=${div || division}`);
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

  if (authLoading || !user) {
    return <TableSkeleton />;
  }

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>Leaderboard</Text>

      {loading && <TableSkeleton />}
      {!loading && <>

      {/* Period tabs */}
      <View style={[styles.periodBar, { borderBottomColor: c.border }]}>
        {([['all', 'All Time'], ['month', 'This Month'], ['week', 'This Week']] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => handlePeriodChange(key)}
            style={[styles.periodTab, { borderBottomColor: period === key ? c.accent : 'transparent' }]}
            accessibilityState={{ selected: period === key }}
          >
            <Text style={{ fontSize: fontSizes.xs, fontWeight: period === key ? '700' : '500', color: period === key ? c.text : c.textMuted }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Division toggle */}
      <View style={[styles.periodBar, { borderBottomColor: c.border }]}>
        {([['open', 'Open'], ['unlimited', 'Unlimited']] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => {
              setDivision(key);
              if (tab === 'global') {
                fetchGlobal(period, selectedSeason || undefined, key);
              } else if (selectedChallenge) {
                fetchChallengeLeaderboard(selectedChallenge, period, key);
              }
            }}
            style={[styles.periodTab, { borderBottomColor: division === key ? c.accent : 'transparent' }]}
            accessibilityState={{ selected: division === key }}
          >
            <Text style={{ fontSize: fontSizes.xs, fontWeight: division === key ? '700' : '500', color: division === key ? c.text : c.textMuted }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
        Open: Cloudflare models only. Unlimited: All models.
      </Text>

      {/* Season filter */}
      {allSeasons.length > 0 && (
        <View style={styles.seasonBar}>
          <select
            value={selectedSeason}
            onChange={(e: any) => handleSeasonChange(e.target.value)}
            aria-label="Filter by season"
            style={{
              padding: '6px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: `1px solid ${c.border}`,
              background: c.card,
              color: c.text as string,
              fontFamily: fontFamily.body,
            }}
          >
            <option value="">All Time</option>
            {allSeasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'active' ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </View>
      )}

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
          <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
            <Text style={{ fontSize: fontSizes.lg, fontWeight: '700', color: c.text, textAlign: 'center' }}>
              {period === 'week' ? 'No solves this week yet.' : period === 'month' ? 'No solves this month yet.' : 'Early leaderboard \u2014 your scores set the benchmark.'}
            </Text>
            <Text style={{ fontSize: fontSizes.sm, color: c.textMuted, textAlign: 'center' }}>
              Be the first to claim the #1 spot. Solve a challenge and your rank appears here.
            </Text>
            <Button onPress={() => navigation.navigate('Problems')}>Browse Problems</Button>
            <View style={{ marginTop: spacing.lg, width: '100%' }}>
              <ActivityFeed limit={10} />
            </View>
          </View>
        ) : (
          <ScrollView style={styles.scroll}>
            <View style={styles.podium}>
              {[1, 0, 2].map((i) => {
                const e = globalEntries[i];
                if (!e) return null;
                const ordinal = e.rank === 1 ? '1st' : e.rank === 2 ? '2nd' : '3rd';
                return (
                  <View key={e.user.id} style={[styles.podiumItem, i === 1 && styles.podiumFirst]} accessibilityLabel={`${ordinal} place: ${e.user.name}`}>
                    <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={i === 1 ? 56 : 40} />
                    <Text style={[styles.podiumName, { color: c.text }]} numberOfLines={1}>{e.user.name}</Text>
                    <Text style={[styles.podiumRank, { color: c.accent }]}>#{e.rank}</Text>
                  </View>
                );
              })}
            </View>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: fontFamily.body }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${c.border}` }}>
                  <th scope="col" style={{ width: 32, fontSize: fontSizes.xs, fontWeight: 600, color: c.textMuted as string, textAlign: 'left', padding: `${spacing.xs}px 0` }}>#</th>
                  <th scope="col" style={{ fontSize: fontSizes.xs, fontWeight: 600, color: c.textMuted as string, textAlign: 'left', padding: `${spacing.xs}px 0` }}>User</th>
                  <th scope="col" style={{ width: 80, fontSize: fontSizes.xs, fontWeight: 600, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.xs}px 0` }}>Solved</th>
                  <th scope="col" style={{ width: 80, fontSize: fontSizes.xs, fontWeight: 600, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.xs}px 0` }}>Avg Cost</th>
                  <th scope="col" style={{ width: 80, fontSize: fontSizes.xs, fontWeight: 600, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.xs}px 0` }}>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {globalEntries.map((e) => (
                  <tr key={e.user.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                    <td style={{ width: 32, fontSize: fontSizes.sm, color: c.textMuted as string, padding: `${spacing.sm}px 0` }}>{e.rank}</td>
                    <td style={{ padding: `${spacing.sm}px 0` }}>
                      <Pressable style={styles.nameCell} onPress={() => e.user.username && (navigation.navigate as any)('PublicProfile', { username: e.user.username })}>
                        <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={28} />
                        <Text style={[styles.name, { color: e.user.username ? c.accent : c.text }]} numberOfLines={1}>{e.user.name}</Text>
                      </Pressable>
                    </td>
                    {e.stats ? (
                      <>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.text as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>{e.stats.solved}</td>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>{formatCostFromHundredths(e.stats.avgCost)}</td>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>{formatCostFromHundredths(e.stats.totalCost)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>-</td>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>-</td>
                        <td style={{ width: 80, fontSize: fontSizes.xs, color: c.textMuted as string, textAlign: 'right', padding: `${spacing.sm}px 0` }}>-</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

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
              aria-label="Select challenge"
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
            <View style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ fontSize: fontSizes.md, fontWeight: '600', color: c.text, textAlign: 'center' }}>
                Nobody has solved this challenge yet.
              </Text>
              <Text style={{ fontSize: fontSizes.sm, color: c.textMuted, textAlign: 'center' }}>
                Be the first!
              </Text>
              <Button variant="outline" onPress={() => (navigation.navigate as any)('Arena', { challengeId: selectedChallenge })}>
                Try This Challenge
              </Button>
            </View>
          ) : (
            <View style={styles.table}>
              {challengeEntries.map((e) => (
                <View key={`${e.user.id}-${e.rank}`} style={[styles.row, { borderBottomColor: c.border }]}>
                  <Text style={[styles.rank, { color: e.rank <= 3 ? c.accent : c.textMuted }]}>
                    {e.rank <= 3 ? ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][e.rank] : e.rank}
                  </Text>
                  <Pressable style={styles.nameCell} onPress={() => e.user.username && (navigation.navigate as any)('PublicProfile', { username: e.user.username })}>
                    <Avatar src={e.user.avatarUrl} fallback={e.user.name?.[0] ?? '?'} size={28} />
                    <Text style={[styles.name, { color: e.user.username ? c.accent : c.text }]} numberOfLines={1}>{e.user.name}</Text>
                  </Pressable>
                  <Text style={[styles.stat, { color: c.accent }]}>{formatCostFromHundredths(e.cost)}</Text>
                  <Text style={[styles.stat, { color: c.textMuted }]}>{e.tokens.toLocaleString()} {e.tokens === 1 ? 'token' : 'tokens'}</Text>
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

      {/* Teams hint — below the leaderboard content */}
      <View style={[styles.teamsHint, { borderColor: c.accent + '20', backgroundColor: c.accent + '05' }]}>
        <Text style={{ fontSize: fontSizes.sm, color: c.textMuted }}>
          These rankings measure real AI efficiency. Use the same system to{' '}
          <Text
            style={{ color: c.accent, textDecorationLine: 'underline' }}
            onPress={() => navigation.navigate('Hiring')}
          >
            assess engineering candidates
          </Text>
          .
        </Text>
      </View>

      {/* Replay modal */}
      {replayAttemptId && (
        <ReplayViewer attemptId={replayAttemptId} onClose={() => setReplayAttemptId(null)} />
      )}
      </>}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.md, fontFamily: fontFamily.body },
  periodBar: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1 },
  periodTab: { paddingBottom: spacing.xs, borderBottomWidth: 2 },
  seasonBar: { flexDirection: 'row', marginBottom: spacing.sm },
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
  teamsHint: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 8,
  },
});
