import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

interface ProfileData {
  profile: {
    name: string;
    email: string;
    avatarUrl: string | null;
    username: string | null;
    credits: number;
    currentStreak: number;
    longestStreak: number;
    streakFreezes: number;
  };
  progress: {
    totalChallenges: number;
    solvedCount: number;
    categorySolves: Record<string, number>;
    categoryTotals: Record<string, number>;
  };
  rank: { position: number | null; totalRanked: number };
  recentBadges: Array<{
    badgeType: string;
    title: string;
    icon: string;
    description?: string;
    earnedAt: string;
  }>;
}

interface BadgeCatalogEntry {
  type: string;
  title: string;
  description: string;
  icon: string;
}

function formatCategory(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProfileSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.bg, padding: spacing.xl }]}>
      <Card style={styles.wideCard}>
        <CardContent style={styles.profileHeader}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <Skeleton width={160} height={24} borderRadius={radii.sm} />
          <Skeleton width={220} height={14} borderRadius={radii.sm} />
        </CardContent>
      </Card>
    </View>
  );
}

export function ProfileScreen() {
  useDocumentMeta({ title: 'Profile', canonicalPath: '/profile' });
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const c = useColors();
  const [data, setData] = useState<ProfileData | null>(null);
  const [allBadges, setAllBadges] = useState<BadgeCatalogEntry[]>([]);
  const [earnedTypes, setEarnedTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Username editing
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, badgeRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/badges'),
      ]);
      if (dashRes.ok) {
        const d = await dashRes.json();
        setData(d as ProfileData);
        setUsername(d.profile.username || '');
      }
      if (badgeRes.ok) {
        const b = await badgeRes.json();
        setAllBadges(b.catalog || []);
        setEarnedTypes(new Set((b.earned || []).map((e: any) => e.badgeType)));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleSaveUsername = async () => {
    if (!username.trim()) return;
    setSavingUsername(true);
    setUsernameError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setUsernameError(err.error || 'Failed to save');
      } else {
        setEditingUsername(false);
        fetchData();
      }
    } catch {
      setUsernameError('Network error');
    }
    setSavingUsername(false);
  };

  if (authLoading || !user) return <ProfileSkeleton />;

  const initials = user.user_metadata?.name
    ? (user.user_metadata.name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  if (loading || !data) {
    return (
      <DashboardLayout user={user}>
        <ProfileSkeleton />
      </DashboardLayout>
    );
  }

  const { profile, progress, rank } = data;
  const pct = progress.totalChallenges > 0
    ? Math.round((progress.solvedCount / progress.totalChallenges) * 100)
    : 0;

  const categoryColors = [
    c.accent, c.success, c.error, '#6b8cce', '#b07acc', '#cc8c5e', '#5ead94',
  ];

  return (
    <DashboardLayout user={user}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: c.text }]}>Profile</Text>

        {/* Profile Card */}
        <Card style={styles.wideCard}>
          <CardContent style={styles.profileHeader}>
            <Avatar src={user.user_metadata?.avatar_url} fallback={initials} size={80} />
            <Text style={[styles.name, { color: c.text }]}>{profile.name || 'User'}</Text>
            <Text style={[styles.email, { color: c.textMuted }]}>{profile.email}</Text>

            {/* Username */}
            {editingUsername ? (
              <View style={styles.usernameEditRow}>
                <View style={styles.usernameInputWrap}>
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="your-username"
                    autoCapitalize="none"
                    editable={!savingUsername}
                    label="Username"
                  />
                  {usernameError && (
                    <Text style={[styles.errorText, { color: c.error }]}>{usernameError}</Text>
                  )}
                </View>
                <View style={styles.usernameActions}>
                  <Button size="sm" onPress={handleSaveUsername} disabled={savingUsername}>
                    {savingUsername ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setEditingUsername(false)}>
                    Cancel
                  </Button>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setEditingUsername(true)}>
                <Text style={[styles.usernameDisplay, { color: c.accent }]}>
                  {profile.username ? `@${profile.username}` : 'Set username'}
                </Text>
              </Pressable>
            )}

            {profile.username && (
              <Pressable
                onPress={() => (navigation.navigate as any)('PublicProfile', { username: profile.username })}
              >
                <Text style={[styles.viewPublicLink, { color: c.textMuted }]}>
                  View public profile
                </Text>
              </Pressable>
            )}
          </CardContent>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Solved', value: `${progress.solvedCount}/${progress.totalChallenges}`, icon: '\uD83C\uDFAF' },
            { label: 'Rank', value: rank.position != null ? `#${rank.position}` : '--', icon: '\uD83C\uDF0D' },
            { label: 'Streak', value: `${profile.currentStreak}`, icon: '\uD83D\uDD25' },
            { label: 'Best Streak', value: `${profile.longestStreak}`, icon: '\uD83C\uDFC6' },
          ].map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <CardContent style={styles.statContent}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: c.textMuted }]}>{s.label}</Text>
              </CardContent>
            </Card>
          ))}
        </View>

        {/* Progress */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Challenge Progress</CardTitle>
            <CardDescription>
              {pct}% complete ({progress.solvedCount} of {progress.totalChallenges})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={pct} style={{ height: 10, borderRadius: radii.full }} />
            {Object.keys(progress.categoryTotals).length > 0 && (
              <View style={styles.categoryRow}>
                {Object.entries(progress.categoryTotals).map(([key, total], i) => (
                  <View
                    key={key}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: categoryColors[i % categoryColors.length] + '18',
                        borderColor: categoryColors[i % categoryColors.length] + '40',
                      },
                    ]}
                  >
                    <View
                      style={[styles.categoryDot, { backgroundColor: categoryColors[i % categoryColors.length] }]}
                    />
                    <Text style={[styles.categoryText, { color: c.text }]}>
                      {formatCategory(key)}{' '}
                      <Text style={{ color: c.textMuted }}>
                        {progress.categorySolves[key] || 0}/{total}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Badges */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>
              {earnedTypes.size} of {allBadges.length} unlocked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View style={styles.badgeGrid}>
              {allBadges.map((badge) => {
                const earned = earnedTypes.has(badge.type);
                return (
                  <View
                    key={badge.type}
                    style={[
                      styles.badgeCard,
                      {
                        backgroundColor: earned ? c.accentBg : c.muted,
                        borderColor: earned ? c.accent + '30' : c.border,
                        opacity: earned ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeIcon, !earned && { opacity: 0.4 }]}>{badge.icon}</Text>
                    <Text
                      style={[styles.badgeTitle, { color: earned ? c.text : c.textSubtle }]}
                      numberOfLines={2}
                    >
                      {badge.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card style={styles.sectionLast}>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.accountRow}>
              <Text style={[styles.accountLabel, { color: c.textMuted }]}>Credits</Text>
              <Text style={[styles.accountValue, { color: c.text }]}>
                {profile.credits.toLocaleString()}
              </Text>
            </View>
            <View style={styles.accountRow}>
              <Text style={[styles.accountLabel, { color: c.textMuted }]}>Streak Freezes</Text>
              <Text style={[styles.accountValue, { color: c.text }]}>
                {profile.streakFreezes}
              </Text>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <Button
                variant="outline"
                onPress={() => (navigation.navigate as any)('Settings')}
              >
                Account Settings
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },
  pageTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
  },
  wideCard: { marginBottom: spacing.lg },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  name: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body },
  email: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  usernameDisplay: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textDecorationLine: 'underline',
  },
  viewPublicLink: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    textDecorationLine: 'underline',
  },
  usernameEditRow: { width: '100%', maxWidth: 300, gap: spacing.sm, marginTop: spacing.xs },
  usernameInputWrap: { gap: spacing.xs },
  usernameActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  errorText: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },

  // Stats
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: { flex: 1, minWidth: 130 },
  statContent: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: fontSizes['2xl'], fontWeight: '800', fontFamily: fontFamily.body },
  statLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    fontFamily: fontFamily.body,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionLast: { marginBottom: 0 },

  // Progress categories
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  categoryText: { fontSize: fontSizes.xs, fontFamily: fontFamily.body, fontWeight: '500' },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  badgeCard: {
    width: 100,
    height: 100,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  badgeIcon: { fontSize: 28 },
  badgeTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },

  // Account info
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  accountLabel: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  accountValue: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
});
