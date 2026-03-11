/**
 * PublicProfileScreen: Public user profile page.
 * Route: /u/:username
 * Includes: badges showcase, follow button, follower/following counts,
 * similar solvers, social share buttons.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ProfileSkeleton } from '@/components/ui/ScreenSkeletons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { RadarChart } from '@/components/RadarChart';
import { FollowButton } from '@/components/FollowButton';
import { SocialShareButtons } from '@/components/SocialShareButtons';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface BadgeData {
  badgeType: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

interface SimilarSolver {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  shared: number;
}

interface ProfileData {
  user: {
    name: string;
    avatarUrl: string | null;
    username: string;
    bio: string | null;
    createdAt: string;
  };
  stats: {
    solved: number;
    avgCost: number;
    globalRank: number;
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  badges: BadgeData[];
  similarSolvers: SimilarSolver[];
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

export function PublicProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { username?: string };
  const username = params.username ?? '';
  const c = useColors();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);

  useDocumentMeta({
    title: data ? `${data.user.name || data.user.username}'s Profile` : undefined,
    description: data ? `${data.user.name || data.user.username} has solved ${data.stats.solved} challenges with an average cost of ${formatCostFromHundredths(data.stats.avgCost)}. View their AI efficiency stats on ruwt.dev.` : undefined,
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
        const d = await res.json() as ProfileData;
        setData(d);
        setFollowerCount(d.stats.followers);
      } catch {
        setError('Failed to load profile');
      }
      setLoading(false);
    };
    load();
  }, [username]);

  if (loading) {
    return <ProfileSkeleton />;
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
  const profileUrl = `https://ruwt.dev/u/${data.user.username}`;
  const shareText = `${data.user.name || data.user.username} has solved ${data.stats.solved} challenges on ruwt.dev with an avg cost of ${formatCostFromHundredths(data.stats.avgCost)}`;

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
        {data.user.bio && (
          <Text style={[styles.bio, { color: c.text }]}>{data.user.bio}</Text>
        )}
        <Text style={[styles.memberSince, { color: c.textMuted }]}>Member since {memberSince}</Text>

        {/* Follow button */}
        <View style={styles.followRow}>
          <FollowButton
            username={data.user.username}
            initialFollowing={data.isFollowing}
            onToggle={(following) => setFollowerCount((prev) => following ? prev + 1 : prev - 1)}
          />
        </View>

        {/* Follower / Following counts */}
        <View style={styles.followCounts}>
          <Text style={[styles.followCount, { color: c.text }]}>
            <Text style={{ fontWeight: '700' }}>{followerCount}</Text>{' '}
            <Text style={{ color: c.textMuted }}>followers</Text>
          </Text>
          <Text style={[styles.followCount, { color: c.text }]}>
            <Text style={{ fontWeight: '700' }}>{data.stats.following}</Text>{' '}
            <Text style={{ color: c.textMuted }}>following</Text>
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{data.stats.solved}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Challenges Solved</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>{formatCostFromHundredths(data.stats.avgCost)}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Avg Cost</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: c.accent }]}>#{data.stats.globalRank}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Global Rank</Text>
        </View>
      </View>

      {/* Badges showcase */}
      {data.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Badges</Text>
          <View style={styles.badgeGrid}>
            {data.badges.map((badge) => (
              <View
                key={badge.badgeType}
                style={[styles.badgeCard, { backgroundColor: c.accentBg, borderColor: c.accent + '30' }]}
              >
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={[styles.badgeTitle, { color: c.text }]} numberOfLines={2}>
                  {badge.title}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

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
                      {replay.challengeDifficulty} {'\u00B7'} {formatCostFromHundredths(replay.totalCost)} {'\u00B7'} {(replay.inputTokens + replay.outputTokens).toLocaleString()} tokens
                    </Text>
                  </View>
                  <Text style={{ color: c.textMuted, fontSize: fontSizes.sm }}>{'\u2192'}</Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      {/* Similar solvers */}
      {data.similarSolvers.length > 0 && (
        <View style={styles.similarSection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Similar Solvers</Text>
          <View style={styles.similarList}>
            {data.similarSolvers.map((solver) => (
              <Pressable
                key={solver.username}
                onPress={() => solver.username && (navigation.navigate as any)('PublicProfile', { username: solver.username })}
                style={[styles.similarRow, { borderBottomColor: c.border }]}
              >
                <Avatar src={solver.avatarUrl} fallback={(solver.name || solver.username || '?')[0]} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.similarName, { color: c.text }]}>{solver.name || solver.username}</Text>
                  <Text style={[styles.similarMeta, { color: c.textMuted }]}>
                    {solver.shared} shared solves
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Social share */}
      <View style={styles.shareSection}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Share Profile</Text>
        <SocialShareButtons text={shareText} url={profileUrl} />
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
  bio: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, marginTop: spacing.sm, textAlign: 'center', maxWidth: 400, lineHeight: 20 },
  memberSince: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  followRow: { marginTop: spacing.md },
  followCounts: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  followCount: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
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
  badgesSection: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  badgeCard: {
    width: 80,
    height: 80,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  badgeIcon: { fontSize: 24 },
  badgeTitle: { fontSize: 10, fontWeight: '600', fontFamily: fontFamily.body, textAlign: 'center' },
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
    paddingBottom: spacing.lg,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg },
  replayCard: { marginBottom: spacing.sm, borderWidth: 1, borderRadius: 8 },
  replayRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  replayTitle: { fontSize: fontSizes.sm, fontWeight: '600' },
  replayMeta: { fontSize: fontSizes.xs, marginTop: 2 },
  similarSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  similarList: { gap: 0 },
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  similarName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  similarMeta: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  shareSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
});
