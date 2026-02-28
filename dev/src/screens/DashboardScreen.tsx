/**
 * DashboardScreen: The main home screen after login.
 * A rich, engaging dashboard with streak tracking, daily challenge,
 * stats, progress, activity heatmap, badges, and activity feed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { getDifficultyStyle } from '@/lib/difficulty';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  profile: {
    name: string;
    email: string;
    avatarUrl: string | null;
    username: string | null;
    credits: number;
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
    streakFreezes: number;
    onboardingCompleted: number;
  };
  progress: {
    totalChallenges: number;
    solvedCount: number;
    categorySolves: Record<string, number>;
    categoryTotals: Record<string, number>;
  };
  rank: { position: number | null; totalRanked: number };
  dailyChallenge: {
    challengeId: string;
    title: string;
    difficulty: string;
    category: string | null;
    solvedToday: boolean;
  } | null;
  recentBadges: Array<{
    badgeType: string;
    title: string;
    icon: string;
    earnedAt: string;
  }>;
  recentActivity: Array<{
    user: string;
    avatarUrl: string | null;
    challenge: string;
    cost: number;
    timestamp: string;
  }>;
  unreadNotifications: number;
  heatmap: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCost(hundredths: number): string {
  const d = hundredths / 10000;
  if (d === 0) return '$0.00';
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

function formatCategory(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Generate the last 91 days (13 full weeks). */
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

// ---------------------------------------------------------------------------
// Skeleton Loader Components
// ---------------------------------------------------------------------------

function SkeletonBox({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: any;
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radii.md,
          backgroundColor: c.border,
        },
        style,
      ]}
    />
  );
}

function DashboardSkeleton() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Greeting skeleton */}
      <View style={styles.greetingRow}>
        <SkeletonBox width={220} height={32} />
        <SkeletonBox width={120} height={28} />
      </View>

      {/* Daily challenge skeleton */}
      <SkeletonBox width="100%" height={180} style={{ marginBottom: spacing.lg }} />

      {/* Stats row skeleton */}
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} width={140} height={90} style={{ flex: 1, minWidth: 140 }} />
        ))}
      </View>

      {/* Progress skeleton */}
      <SkeletonBox width="100%" height={140} style={{ marginBottom: spacing.lg }} />

      {/* Heatmap skeleton */}
      <SkeletonBox width="100%" height={130} style={{ marginBottom: spacing.lg }} />

      {/* Badges skeleton */}
      <SkeletonBox width="100%" height={100} style={{ marginBottom: spacing.lg }} />

      {/* Activity feed skeleton */}
      <SkeletonBox width="100%" height={200} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function GreetingSection({
  data,
}: {
  data: DashboardData;
}) {
  const c = useColors();
  const { profile } = data;
  const firstName = profile.name?.split(' ')[0] || 'there';

  return (
    <View style={styles.greetingRow}>
      <View style={styles.greetingTextWrap}>
        <Text style={[styles.greeting, { color: c.text }]} accessibilityRole="header" aria-level={1}>
          {getGreeting()}, {firstName}
        </Text>
        <Text style={[styles.greetingSub, { color: c.textMuted }]}>
          {profile.currentStreak > 0
            ? "Keep up the momentum. Every challenge sharpens your edge."
            : "Ready to start building your streak?"}
        </Text>
      </View>
      <View style={styles.streakWrap}>
        {profile.currentStreak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: c.accentBg, borderColor: c.accent }]}>
            <Text style={styles.streakFlame}>{'\uD83D\uDD25'}</Text>
            <Text style={[styles.streakCount, { color: c.accent }]}>
              {profile.currentStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: c.textMuted }]}>
              day streak
            </Text>
          </View>
        ) : (
          <View style={[styles.streakBadge, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Text style={styles.streakFlame}>{'\uD83D\uDD25'}</Text>
            <Text style={[styles.streakLabel, { color: c.textMuted }]}>
              Start your streak!
            </Text>
          </View>
        )}
        {profile.streakFreezes > 0 && (
          <View style={styles.freezeWrap}>
            <Text style={styles.freezeIcon}>{'\u2744\uFE0F'}</Text>
            <Text style={[styles.freezeText, { color: c.textSubtle }]}>
              {profile.streakFreezes} freeze{profile.streakFreezes !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function GetStartedBanner({ onTryFizzBuzz, onBrowse }: { onTryFizzBuzz: () => void; onBrowse: () => void }) {
  const c = useColors();
  return (
    <Card style={{ borderColor: c.accent, borderWidth: 1, borderLeftWidth: 4 }}>
      <CardHeader>
        <CardTitle>Start Your First Challenge</CardTitle>
        <CardDescription>
          Pick an easy challenge, use AI to solve it, and see how efficiently you can do it. Most people finish their first one in under 3 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent style={{ gap: spacing.sm }}>
        <Button
          size="lg"
          fullWidth
          onPress={onTryFizzBuzz}
          style={{ backgroundColor: c.accent }}
          textStyle={{ color: c.primaryForeground, fontWeight: '700' }}
        >
          Try FizzBuzz Budget
        </Button>
        <Pressable onPress={onBrowse}>
          <Text style={{ color: c.accent, textAlign: 'center', fontSize: fontSizes.sm, fontFamily: fontFamily.body }}>
            Browse all challenges
          </Text>
        </Pressable>
      </CardContent>
    </Card>
  );
}

function DailyChallengeSection({
  data,
  countdown,
  onStart,
}: {
  data: DashboardData;
  countdown: number;
  onStart: () => void;
}) {
  const c = useColors();
  const dc = data.dailyChallenge;

  if (!dc) {
    return (
      <Card style={[styles.dailyCard, { borderColor: c.border }]}>
        <CardContent style={styles.dailyEmpty}>
          <Text style={[styles.dailyEmptyText, { color: c.textMuted }]}>
            No daily challenge available right now. Check back soon!
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={[
        styles.dailyCard,
        {
          borderColor: c.accent,
          borderWidth: 2,
          shadowColor: c.accent,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        },
      ]}
    >
      <CardHeader>
        <View style={styles.dailyHeaderRow}>
          <Badge variant="default">Today's Challenge</Badge>
          <View style={styles.countdownWrap}>
            <Text style={[styles.countdownLabel, { color: c.textSubtle }]}>
              Next in
            </Text>
            <Text style={[styles.countdownValue, { color: c.accent }]}>
              {formatCountdown(countdown)}
            </Text>
          </View>
        </View>
        <CardTitle style={styles.dailyTitle}>{dc.title}</CardTitle>
        <View style={styles.dailyPills}>
          <Badge
            variant="outline"
            style={{ borderColor: getDifficultyStyle(dc.difficulty).color, backgroundColor: getDifficultyStyle(dc.difficulty).bg }}
            textStyle={{ color: getDifficultyStyle(dc.difficulty).color }}
          >
            {getDifficultyStyle(dc.difficulty).label}
          </Badge>
          {dc.category && (
            <Badge variant="outline">{formatCategory(dc.category)}</Badge>
          )}
        </View>
      </CardHeader>
      <CardContent>
        {dc.solvedToday ? (
          <View style={[styles.solvedRow, { backgroundColor: c.successBg }]}>
            <Text style={styles.solvedCheck}>{'\u2705'}</Text>
            <View style={styles.solvedTextWrap}>
              <Text style={[styles.solvedText, { color: c.success }]}>
                Completed!
              </Text>
            </View>
          </View>
        ) : (
          <Button
            size="lg"
            fullWidth
            onPress={onStart}
            style={{ backgroundColor: c.accent }}
            textStyle={{ color: c.primaryForeground, fontWeight: '700' }}
          >
            Start Today's Challenge
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatsRow({ data }: { data: DashboardData }) {
  const c = useColors();
  const { progress, rank, profile } = data;

  const creditsUsed = 50000 - profile.credits; // signup bonus minus remaining

  const stats = [
    {
      label: 'Solved',
      value: `${progress.solvedCount} / ${progress.totalChallenges}`,
      icon: '\uD83C\uDFAF', // target emoji
    },
    {
      label: 'Global Rank',
      value: rank.position != null ? `#${rank.position}` : '--',
      icon: '\uD83C\uDF0D', // globe emoji
    },
    {
      label: 'Streak',
      value: `${profile.currentStreak}`,
      icon: '\uD83D\uDD25', // fire emoji
    },
    {
      label: 'AI Spend',
      value: formatCost(creditsUsed),
      icon: '\uD83D\uDCB0', // money bag emoji
    },
  ];

  return (
    <View style={styles.statsRow} accessibilityRole="group" accessibilityLabel="Your statistics">
      {stats.map((s) => (
        <Card key={s.label} style={styles.statCard}>
          <CardContent style={styles.statContent}>
            <Text style={styles.statIcon} accessibilityRole="none">{s.icon}</Text>
            <Text style={[styles.statValue, { color: c.text }]} accessibilityLabel={`${s.label}: ${s.value}`}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>{s.label}</Text>
          </CardContent>
        </Card>
      ))}
    </View>
  );
}

function ProgressSection({ data }: { data: DashboardData }) {
  const c = useColors();
  const { progress } = data;
  const pct =
    progress.totalChallenges > 0
      ? Math.round((progress.solvedCount / progress.totalChallenges) * 100)
      : 0;

  // Merge categoryTotals + categorySolves into display format
  const categoryEntries = Object.entries(progress.categoryTotals).map(([key, total]) => [
    key,
    { total, solved: progress.categorySolves[key] || 0 },
  ] as [string, { total: number; solved: number }]);

  // Assign a color to each category for visual distinction
  const categoryColors = [
    c.accent,
    c.success,
    c.error,
    '#6b8cce',
    '#b07acc',
    '#cc8c5e',
    '#5ead94',
    '#9a7b3c',
    '#7d6430',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
        <CardDescription>
          {pct}% of challenges completed ({progress.solvedCount} of{' '}
          {progress.totalChallenges})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={pct} style={{ height: 10, borderRadius: radii.full }} />
        {categoryEntries.length > 0 && (
          <View style={styles.categoryRow}>
            {categoryEntries.map(([key, val], i) => (
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
                  style={[
                    styles.categoryDot,
                    {
                      backgroundColor:
                        categoryColors[i % categoryColors.length],
                    },
                  ]}
                />
                <Text style={[styles.categoryText, { color: c.text }]}>
                  {formatCategory(key)}{' '}
                  <Text style={{ color: c.textMuted }}>
                    {val.solved}/{val.total}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityHeatmap({ data }: { data: DashboardData }) {
  const c = useColors();
  const days = generateHeatmapDays();
  const heatmap = data.heatmap;

  // Determine max count for intensity scaling
  const maxCount = Math.max(1, ...Object.values(heatmap));
  const totalActivity = Object.values(heatmap).reduce((s, v) => s + v, 0);
  const activeDays = Object.values(heatmap).filter((v) => v > 0).length;

  function getCellColor(count: number): string {
    if (count === 0) return c.border;
    const intensity = Math.min(count / maxCount, 1);
    if (intensity <= 0.33) return c.accent + '40';
    if (intensity <= 0.66) return c.accent + '80';
    return c.accent + 'CC';
  }

  // Arrange into 7 rows (Mon-Sun) x 13 columns
  const grid: string[][] = Array.from({ length: 7 }, () => []);
  days.forEach((day) => {
    const d = new Date(day + 'T00:00:00');
    const dow = d.getDay(); // 0=Sun
    grid[dow].push(day);
  });

  // Day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card>
      <CardHeader>
        <View style={styles.heatmapHeaderRow}>
          <CardTitle>Activity</CardTitle>
          <Text style={[styles.heatmapSubtitle, { color: c.textSubtle }]}>
            Last 90 days
          </Text>
        </View>
      </CardHeader>
      <CardContent>
        {/* Accessible text summary of heatmap data */}
        <Text style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }} accessibilityRole="summary">
          {totalActivity} activities across {activeDays} active days in the last 90 days
        </Text>
        <View style={styles.heatmapContainer} accessibilityRole="img" accessibilityLabel={`Activity heatmap: ${totalActivity} activities across ${activeDays} days in the last 90 days`}>
          {/* Day labels column */}
          <View style={styles.heatmapDayLabels}>
            {dayLabels.map((label, i) => (
              <View key={label} style={styles.heatmapDayLabel}>
                {i % 2 === 1 ? (
                  <Text style={[styles.heatmapDayText, { color: c.textSubtle }]}>
                    {label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          {/* Grid */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmapGrid}>
              {grid.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.heatmapRow}>
                  {row.map((day) => {
                    const count = heatmap[day] || 0;
                    return (
                      <View
                        key={day}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: getCellColor(count) },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        {/* Legend */}
        <View style={styles.heatmapLegend}>
          <Text style={[styles.heatmapLegendText, { color: c.textSubtle }]}>
            Less
          </Text>
          {[0, 0.33, 0.66, 1].map((intensity, i) => (
            <View
              key={i}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor:
                    intensity === 0
                      ? c.border
                      : intensity <= 0.33
                        ? c.accent + '40'
                        : intensity <= 0.66
                          ? c.accent + '80'
                          : c.accent + 'CC',
                },
              ]}
            />
          ))}
          <Text style={[styles.heatmapLegendText, { color: c.textSubtle }]}>
            More
          </Text>
        </View>
      </CardContent>
    </Card>
  );
}

function RecentBadgesSection({ data }: { data: DashboardData }) {
  const c = useColors();
  const navigation = useNavigation();
  const badges = data.recentBadges;

  const ghostBadges = [
    { title: 'First Solve', icon: '?' },
    { title: '3-Day Streak', icon: '?' },
    { title: 'Speed Demon', icon: '?' },
    { title: 'Budget Master', icon: '?' },
  ];

  return (
    <Card>
      <CardHeader style={styles.badgesHeaderRow}>
        <CardTitle>Achievements</CardTitle>
        <Pressable onPress={() => (navigation.navigate as any)('Profile')}>
          <Text style={[styles.viewAllLink, { color: c.accent }]}>View All</Text>
        </Pressable>
      </CardHeader>
      <CardContent>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesScroll}
        >
          {badges.length > 0
            ? badges.map((badge, i) => (
                <View
                  key={`${badge.badgeType}-${i}`}
                  style={[
                    styles.badgeCard,
                    { backgroundColor: c.accentBg, borderColor: c.accent + '30' },
                  ]}
                >
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text
                    style={[styles.badgeTitle, { color: c.text }]}
                    numberOfLines={2}
                  >
                    {badge.title}
                  </Text>
                </View>
              ))
            : ghostBadges.map((gb, i) => (
                <View
                  key={`ghost-${i}`}
                  style={[
                    styles.badgeCard,
                    {
                      backgroundColor: c.muted,
                      borderColor: c.border,
                      opacity: 0.6,
                    },
                  ]}
                >
                  <Text style={[styles.badgeIcon, { opacity: 0.4 }]}>{gb.icon}</Text>
                  <Text
                    style={[styles.badgeTitle, { color: c.textSubtle }]}
                    numberOfLines={2}
                  >
                    {gb.title}
                  </Text>
                </View>
              ))}
        </ScrollView>
        {badges.length === 0 && (
          <Text style={[styles.badgesHint, { color: c.textSubtle }]}>
            Solve challenges and build streaks to unlock achievements.
          </Text>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityFeedSection({ data }: { data: DashboardData }) {
  const c = useColors();
  const activity = data.recentActivity;

  // Count unique users — hide feed if < 3 to avoid "ghost town" feel
  const uniqueUsers = new Set(activity.map((e) => e.user)).size;

  if (activity.length === 0 || uniqueUsers < 3) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Community</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={[styles.emptyFeedText, { color: c.textMuted }]}>
            Be among the first to set the benchmark. Solve a challenge and your result appears here.
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest solves across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.map((entry, i) => (
          <View
            key={`${entry.user}-${entry.timestamp}-${i}`}
            style={[
              styles.activityRow,
              i < activity.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              },
            ]}
          >
            <Avatar
              src={entry.avatarUrl}
              fallback={entry.user?.[0]?.toUpperCase() ?? '?'}
              size={32}
            />
            <View style={styles.activityTextWrap}>
              <Text style={[styles.activityText, { color: c.text }]}>
                <Text style={{ fontWeight: '600' }}>{entry.user}</Text> solved{' '}
                <Text style={{ fontWeight: '600' }}>{entry.challenge}</Text>
              </Text>
              <Text style={[styles.activityTime, { color: c.textSubtle }]}>
                {relativeTime(entry.timestamp)}
              </Text>
            </View>
            <View
              style={[
                styles.activityCostBadge,
                { backgroundColor: c.accentBg, borderColor: c.accent + '30' },
              ]}
            >
              <Text style={[styles.activityCostText, { color: c.accent }]}>
                {formatCost(entry.cost)}
              </Text>
            </View>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DashboardScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const d = (await res.json()) as DashboardData;

          // Onboarding gate: redirect new users to onboarding flow
          if (d.profile.onboardingCompleted === 0) {
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' as never }] });
            return;
          }

          setData(d);
          // Calculate seconds until midnight UTC for countdown
          const now = new Date();
          const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
          setCountdown(Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
        }
      } catch {
        // API not available yet - show empty state
      }
      setLoading(false);
    };
    init();
  }, [navigation]);

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartDaily = useCallback(() => {
    if (data?.dailyChallenge) {
      (navigation.navigate as any)('Arena', {
        challengeId: data.dailyChallenge.challengeId,
      });
    }
  }, [data, navigation]);

  // Loading state
  if (loading) {
    if (!user) {
      return (
        <View style={[styles.center, { backgroundColor: c.bg }]}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      );
    }
    return (
      <DashboardLayout user={user}>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (!user) return null;

  // If the API is not yet available, show a minimal fallback
  if (!data) {
    return (
      <DashboardLayout user={user}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.greeting, { color: c.text }]}>
            {getGreeting()},{' '}
            {user.user_metadata?.name?.split(' ')[0] || 'there'}
          </Text>
          <Card style={{ marginTop: spacing.lg }}>
            <CardContent style={styles.fallbackContent}>
              <Text style={[styles.fallbackText, { color: c.textMuted }]}>
                Dashboard data is loading. Try refreshing the page.
              </Text>
              <Button
                variant="outline"
                onPress={() => window.location.reload()}
                style={{ marginTop: spacing.md }}
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Greeting + Streak */}
        <GreetingSection data={data} />

        {/* Get Started Banner — new users only */}
        {data.progress.solvedCount === 0 && (
          <View style={styles.section}>
            <GetStartedBanner
              onTryFizzBuzz={() => (navigation.navigate as any)('Arena', { challengeId: 'fizzbuzz-budget' })}
              onBrowse={() => (navigation.navigate as any)('Challenges')}
            />
          </View>
        )}

        {/* 2. Daily Challenge */}
        <View style={styles.section}>
          <DailyChallengeSection
            data={data}
            countdown={countdown}
            onStart={handleStartDaily}
          />
        </View>

        {/* 3. Stats Row */}
        <View style={styles.section}>
          <StatsRow data={data} />
        </View>

        {/* 4. Progress */}
        <View style={styles.section}>
          <ProgressSection data={data} />
        </View>

        {/* 5. Activity Heatmap */}
        <View style={styles.section}>
          <ActivityHeatmap data={data} />
        </View>

        {/* 6. Recent Badges */}
        <View style={styles.section}>
          <RecentBadgesSection data={data} />
        </View>

        {/* 7. Activity Feed */}
        <View style={styles.sectionLast}>
          <ActivityFeedSection data={data} />
        </View>
      </ScrollView>
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  greetingTextWrap: { flex: 1, minWidth: 200 },
  greeting: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  greetingSub: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
    fontFamily: fontFamily.body,
  },
  streakWrap: { alignItems: 'flex-end', gap: spacing.xs },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  streakFlame: { fontSize: 18 },
  streakCount: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    fontFamily: fontFamily.body,
  },
  streakLabel: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  freezeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freezeIcon: { fontSize: 12 },
  freezeText: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionLast: { marginBottom: 0 },

  // Daily Challenge
  dailyCard: {},
  dailyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dailyTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
    marginTop: spacing.sm,
  },
  dailyPills: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dailyEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  dailyEmptyText: { fontSize: fontSizes.sm, textAlign: 'center' },
  countdownWrap: { alignItems: 'flex-end' },
  countdownLabel: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  countdownValue: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    fontVariant: ['tabular-nums'],
  },
  solvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
  },
  solvedCheck: { fontSize: 22 },
  solvedTextWrap: { flex: 1 },
  solvedText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  solvedCost: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
  },
  statContent: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  statIcon: { fontSize: 20 },
  statValue: {
    fontSize: fontSizes['2xl'],
    fontWeight: '800',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    fontFamily: fontFamily.body,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress
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
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    fontWeight: '500',
  },

  // Heatmap
  heatmapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heatmapSubtitle: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  heatmapContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heatmapDayLabels: {
    gap: 3,
    paddingTop: 0,
  },
  heatmapDayLabel: {
    height: 12,
    justifyContent: 'center',
  },
  heatmapDayText: {
    fontSize: 9,
    fontFamily: fontFamily.body,
  },
  heatmapGrid: {
    gap: 3,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: spacing.sm,
  },
  heatmapLegendText: {
    fontSize: 10,
    fontFamily: fontFamily.body,
  },

  // Badges
  badgesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllLink: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  badgesScroll: {
    gap: spacing.md,
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
  badgeIcon: {
    fontSize: 28,
  },
  badgeTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
  badgesHint: {
    fontSize: fontSizes.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontFamily: fontFamily.body,
  },

  // Activity Feed
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityTextWrap: {
    flex: 1,
    gap: 2,
  },
  activityText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  activityTime: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  activityCostBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  activityCostText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  emptyFeedText: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingVertical: spacing.md,
  },

  // Fallback
  fallbackContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  fallbackText: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    fontFamily: fontFamily.body,
  },
});
