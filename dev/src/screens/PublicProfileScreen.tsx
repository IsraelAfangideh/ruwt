/**
 * PublicProfileScreen: Public user profile page.
 * Route: /u/:username
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RadarChart } from '@/components/RadarChart';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

interface ProfileData {
  user: {
    name: string;
    avatarUrl: string | null;
    username: string;
    createdAt: string;
  };
  stats: {
    solved: number;
    avgCost: number;
    globalRank: number;
  };
  radar: {
    modelSelection: number;
    promptEfficiency: number;
    debugging: number;
    multiModel: number;
    realWorld: number;
  };
  recentReplays: Array<{
    attemptId: string;
    challengeTitle: string;
    challengeDifficulty: string;
    challengeCategory: string;
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    submittedAt: string | null;
  }>;
}

function formatCost(hundredths: number): string {
  const d = hundredths / 10000;
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

export function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { username?: string };
  const username = params.username ?? '';
  const c = useColors();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: data ? `${data.user.name || data.user.username}'s Profile` : undefined,
    description: data ? `${data.user.name || data.user.username} has solved ${data.stats.solved} challenges with an average cost of ${formatCost(data.stats.avgCost)}. View their AI efficiency stats on ruwt.dev.` : undefined,
    canonicalPath: username ? `/u/${username}` : undefined,
  });

  useEffect(() => {
    if (!username) {
      setError('No username provided');
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setError(err.error || 'User not found');
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load profile');
      }
      setLoading(false);
    };
    load();
  }, [username]);

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
        <Text style={[styles.errorText, { color: c.destructive }]}>{error || 'User not found'}</Text>
        <Pressable onPress={() => navigation.navigate('Leaderboard' as never)} style={styles.backLink}>
          <Text style={{ color: c.accent, fontSize: fontSizes.sm }}>Back to Leaderboard</Text>
        </Pressable>
      </View>
    );
  }

  const memberSince = new Date(data.user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>{'\u2190'} Back</Text>
        </Pressable>
      </View>

      {/* Profile info */}
      <View style={styles.profileSection}>
        <Avatar src={data.user.avatarUrl} fallback={data.user.name?.[0] ?? '?'} size={72} />
        <Text style={[styles.name, { color: c.text }]}>{data.user.name}</Text>
        <Text style={[styles.username, { color: c.textMuted }]}>@{data.user.username}</Text>
        <Text style={[styles.memberSince, { color: c.textMuted }]}>Member since {memberSince}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{data.stats.solved}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Challenges Solved</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{formatCost(data.stats.avgCost)}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Avg Cost</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>#{data.stats.globalRank}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Global Rank</Text>
        </View>
      </View>

      {/* Radar chart */}
      <View style={styles.radarSection}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Skill Profile</Text>
        <View style={styles.radarWrap}>
          <RadarChart data={data.radar} accentColor={c.accent as string} />
        </View>
      </View>

      {/* Recent replays */}
      <View style={styles.replaysSection}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Recent Replays</Text>
        {data.recentReplays.length === 0 ? (
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No public replays yet.</Text>
        ) : (
          data.recentReplays.map((replay) => (
            <Pressable
              key={replay.attemptId}
              onPress={() => (navigation.navigate as any)('Replay', { attemptId: replay.attemptId })}
            >
              <Card style={[styles.replayCard, { borderColor: c.border }]}>
                <View style={styles.replayRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replayTitle, { color: c.text }]}>{replay.challengeTitle}</Text>
                    <Text style={[styles.replayMeta, { color: c.textMuted }]}>
                      {replay.challengeDifficulty} {'\u00B7'} {formatCost(replay.totalCost)} {'\u00B7'} {(replay.inputTokens + replay.outputTokens).toLocaleString()} tokens
                    </Text>
                  </View>
                  <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>{'\u2192'}</Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSizes.md, marginBottom: spacing.md },
  backLink: { marginTop: spacing.md },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  name: { fontSize: fontSizes.xl, fontWeight: '700', marginTop: spacing.md, fontFamily: fontFamily.body },
  username: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  memberSince: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body },
  statLabel: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  statDivider: { width: 1, height: 40 },
  radarSection: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: { fontSize: fontSizes.lg, fontWeight: '700', marginBottom: spacing.md, fontFamily: fontFamily.body },
  radarWrap: { alignItems: 'center' },
  replaysSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg },
  replayCard: { marginBottom: spacing.sm, borderWidth: 1, borderRadius: 8 },
  replayRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  replayTitle: { fontSize: fontSizes.sm, fontWeight: '600' },
  replayMeta: { fontSize: fontSizes.xs, marginTop: 2 },
});
