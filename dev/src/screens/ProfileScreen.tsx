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
  heatmap?: Record<string, number>;
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

function generateHeatmapDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function ActivityHeatmap({ heatmap }: { heatmap: Record<string, number> }) {
  const c = useColors();
  const days = generateHeatmapDays();
  const maxCount = Math.max(1, ...Object.values(heatmap));
  const totalActivity = Object.values(heatmap).reduce((s, v) => s + v, 0);
  const activeDays = Object.values(heatmap).filter((v) => v > 0).length;

  function getCellColor(count: number): string {
    if (count === 0) return c.border;
    const intensity = Math.min(count / maxCount, 1);
    if (intensity <= 0.33) return c.accent + '40';
    /* istanbul ignore next -- @preserve */
    if (intensity <= 0.66) return c.accent + '80';
    return c.accent + 'CC';
  }

  const grid: string[][] = Array.from({ length: 7 }, () => []);
  days.forEach((day) => {
    const d = new Date(day + 'T00:00:00');
    const dow = d.getDay();
    grid[dow].push(day);
  });

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card style={styles.section} accessibilityRole="region" accessibilityLabel="Activity heatmap">
      <CardHeader>
        <View style={styles.heatmapHeaderRow}>
          <CardTitle>Activity</CardTitle>
          <Text style={[styles.heatmapSubtitle, { color: c.textSubtle }]}>Last 90 days</Text>
        </View>
      </CardHeader>
      <CardContent>
        <Text style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }} accessibilityRole="summary">
          {totalActivity} activities across {activeDays} active days in the last 90 days
        </Text>
        <View style={styles.heatmapContainer} accessibilityRole="img" accessibilityLabel={`Activity heatmap: ${totalActivity} activities across ${activeDays} days in the last 90 days`}>
          <View style={styles.heatmapDayLabels}>
            {dayLabels.map((label, i) => (
              <View key={label} style={styles.heatmapDayLabel}>
                {i % 2 === 1 ? (
                  <Text style={[styles.heatmapDayText, { color: c.textSubtle }]}>{label}</Text>
                ) : null}
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmapGrid}>
              {grid.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.heatmapRow}>
                  {row.map((day) => (
                    <View key={day} style={[styles.heatmapCell, { backgroundColor: getCellColor(heatmap[day] || 0) }]} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={[styles.heatmapLegendText, { color: c.textSubtle }]}>Less</Text>
          {[0, 0.33, 0.66, 1].map((intensity, i) => (
            <View
              key={i}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: intensity === 0 ? c.border
                    : intensity <= 0.33 ? c.accent + '40'
                    : intensity <= 0.66 ? c.accent + '80'
                    : c.accent + 'CC',
                },
              ]}
            />
          ))}
          <Text style={[styles.heatmapLegendText, { color: c.textSubtle }]}>More</Text>
        </View>
      </CardContent>
    </Card>
  );
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

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <ProfileSkeleton />
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout user={user}>
        <View style={[styles.center, { backgroundColor: c.bg, padding: spacing.xl }]}>
          <Card style={styles.wideCard}>
            <CardContent style={{ alignItems: 'center', padding: spacing.xl }}>
              <Text style={{ fontSize: fontSizes.lg, fontWeight: '600', color: c.text, marginBottom: spacing.sm }}>
                Profile data unavailable
              </Text>
              <Text style={{ fontSize: fontSizes.sm, color: c.textMuted, textAlign: 'center', marginBottom: spacing.md }}>
                Could not load your profile. Try refreshing the page.
              </Text>
              <Button onPress={() => { setLoading(true); fetchData(); }}>Refresh</Button>
            </CardContent>
          </Card>
        </View>
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

        {/* Heatmap */}
        {data.heatmap && <ActivityHeatmap heatmap={data.heatmap} />}

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

  // Heatmap
  heatmapHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heatmapSubtitle: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  heatmapContainer: { flexDirection: 'row', gap: spacing.xs },
  heatmapDayLabels: { gap: 3, paddingTop: 0 },
  heatmapDayLabel: { height: 12, justifyContent: 'center' },
  heatmapDayText: { fontSize: 9, fontFamily: fontFamily.body },
  heatmapGrid: { gap: 3 },
  heatmapRow: { flexDirection: 'row', gap: 3 },
  heatmapCell: { width: 12, height: 12, borderRadius: 2 },
  heatmapLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.sm },
  heatmapLegendText: { fontSize: 10, fontFamily: fontFamily.body },

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
