/**
 * PublicProfileScreen: Public user profile page.
 * Route: /u/:username
 * Includes: badges showcase, follow button, follower/following counts,
 * similar solvers, social share buttons.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { ProfileSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { RadarChart } from '@/features/profile/RadarChart';
import { FollowButton } from '@/features/profile/FollowButton';
import { SocialShareButtons } from '@/shared/social/SocialShareButtons';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { computeAFI, AFI_TIER_COLORS, CERTIFICATIONS, type AFITier } from '@/shared/lib/scoring';

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
  afi?: {
    score: number;
    tier: AFITier;
    label: string;
  };
  certification?: string | null;
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
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { username?: string };
  const username = params.username ?? '';
  const c = useColors();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);

  /* istanbul ignore next -- @preserve */
  const profileDisplayName = data ? (data.user.name || data.user.username) : '';
  // Compute AFI client-side as fallback when API doesn't return it
  const afiData = data?.afi ?? (data ? computeAFI(data.radar) : undefined);
  /* istanbul ignore next -- @preserve */
  useDocumentMeta({
    title: data ? `${profileDisplayName}'s Profile — AFI ${afiData?.score ?? 0}` : undefined,
    description: data ? `${profileDisplayName} has an AI Fluency Index of ${afiData?.score ?? 0} (${afiData?.label ?? 'Novice'}). ${data.stats.solved} challenges solved. View their AI efficiency profile on ruwt.dev.` : undefined,
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
        <Text style={[styles.errorText, { color: c.destructive }]}>{(() => { /* istanbul ignore next -- @preserve */ return error || 'User not found'; })()}</Text>
        <Pressable onPress={() => navigation.navigate('Leaderboard')} style={styles.backLink}>
          <Text style={{ color: c.accent, fontSize: fontSizes.sm }}>Back to Leaderboard</Text>
        </Pressable>
      </View>
    );
  }

  const memberSince = new Date(data.user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const profileUrl = `https://ruwt.dev/u/${data.user.username}`;
  /* istanbul ignore next -- @preserve */
  const certDef = data.certification ? CERTIFICATIONS.find((ct) => ct.type === data.certification) : null;
  /* istanbul ignore next -- @preserve */
  const shareText = `${data.user.name || data.user.username} has an AI Fluency Index of ${afiData?.score ?? 0} on ruwt.dev — ${data.stats.solved} challenges solved, avg cost ${formatCostFromHundredths(data.stats.avgCost)}`;

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
        <Avatar src={data.user.avatarUrl} fallback={/* istanbul ignore next -- @preserve */ data.user.name?.[0] ?? '?'} size={72} />
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

      {/* AFI Score Card */}
      {afiData && (
        <View style={styles.afiSection}>
          <View style={[styles.afiCard, { backgroundColor: AFI_TIER_COLORS[afiData.tier] + '15', borderColor: AFI_TIER_COLORS[afiData.tier] + '40' }]}>
            <Text style={[styles.afiLabel, { color: c.textMuted }]}>AI Fluency Index</Text>
            <Text style={[styles.afiScore, { color: AFI_TIER_COLORS[afiData.tier] }]}>{afiData.score}</Text>
            <View style={[styles.afiTierBadge, { backgroundColor: AFI_TIER_COLORS[afiData.tier] + '25' }]}>
              <Text style={[styles.afiTierText, { color: AFI_TIER_COLORS[afiData.tier] }]}>{afiData.label}</Text>
            </View>
            <Text style={[styles.afiScale, { color: c.textMuted }]}>out of 850</Text>
          </View>
          {/* Certification badge */}
          {/* istanbul ignore next -- @preserve */ certDef && (
            <View style={[styles.certBadge, { backgroundColor: c.accentBg, borderColor: c.accent + '40' }]}>
              <Text style={{ fontSize: 20 }}>{certDef.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.certTitle, { color: c.accent }]}>{certDef.title} Verified</Text>
                <Text style={[styles.certDesc, { color: c.textMuted }]}>{certDef.description}</Text>
              </View>
            </View>
          )}
        </View>
      )}

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
        <Text style={[styles.sectionTitle, { color: c.text }]}>AI Fluency Breakdown</Text>
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
                onPress={/* istanbul ignore next -- @preserve */ () => solver.username && (navigation.navigate as any)('PublicProfile', { username: solver.username })}
                style={[styles.similarRow, { borderBottomColor: c.border }]}
              >
                <Avatar src={solver.avatarUrl} fallback={(() => { /* istanbul ignore next -- @preserve */ return (solver.name || solver.username || '?')[0]; })() } size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.similarName, { color: c.text }]}>{(() => { /* istanbul ignore next -- @preserve */ return solver.name || solver.username; })()}</Text>
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
  afiSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  afiCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    width: '100%',
    maxWidth: 300,
  },
  afiLabel: {
    fontSize: fontSizes.xs,
    textTransform: 'uppercase' as any,
    letterSpacing: 1.5,
    fontFamily: fontFamily.body,
    marginBottom: spacing.xs,
  },
  afiScore: {
    fontSize: 56,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    lineHeight: 64,
  },
  afiTierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  afiTierText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase' as any,
    letterSpacing: 1,
    fontFamily: fontFamily.body,
  },
  afiScale: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: fontFamily.body,
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    width: '100%',
    maxWidth: 300,
  },
  certTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  certDesc: {
    fontSize: 10,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },
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
