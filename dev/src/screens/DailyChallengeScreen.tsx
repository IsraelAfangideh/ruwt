/**
 * DailyChallengeScreen: Today's challenge with mini-leaderboard and countdown.
 * Route: /daily
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

interface DailyData {
  date: string;
  challenge: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    category: string | null;
  } | null;
  leaderboard: Array<{
    rank: number;
    user: { id: string; name: string; avatarUrl?: string | null };
    attemptId: string;
    cost: number;
    tokens: number;
    submittedAt: string | null;
  }>;
  secondsUntilNext: number;
}

export function DailyChallengeScreen() {
  useDocumentMeta({ title: 'Daily Challenge', description: "Today's AI coding challenge. Compete daily, build your streak, climb the seasonal leaderboard.", canonicalPath: '/daily' });
  const navigation = useNavigation();
  const c = useColors();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);

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
        const res = await fetch('/api/daily-challenge');
        if (res.ok) {
          const d = await res.json() as DailyData;
          setData(d);
          setCountdown(d.secondsUntilNext);
        }
      } catch {}
      setLoading(false);
    };
    init();
  }, [navigation]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const formatCost = (hundredths: number) => {
    const d = hundredths / 10000;
    return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Badge variant="default">Daily Challenge</Badge>
          <Text style={[styles.date, { color: c.textMuted }]}>{data?.date}</Text>
        </View>

        {data?.challenge ? (
          <>
            <Card style={[styles.challengeCard, { borderColor: c.accent, borderWidth: 1 }]}>
              <CardHeader>
                <View style={styles.badgeRow}>
                  <Badge variant="outline">{data.challenge.difficulty}</Badge>
                  {data.challenge.category && (
                    <Badge variant="outline">{data.challenge.category.replace('_', ' ')}</Badge>
                  )}
                </View>
                <CardTitle>{data.challenge.title}</CardTitle>
                <CardDescription>{data.challenge.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="lg"
                  onPress={() => (navigation.navigate as any)('Arena', { challengeId: data.challenge!.id })}
                >
                  Start Today's Challenge
                </Button>
              </CardContent>
            </Card>

            {/* Countdown */}
            <View style={styles.countdownWrap}>
              <Text style={[styles.countdownLabel, { color: c.textMuted }]}>Next challenge in</Text>
              <Text style={[styles.countdownValue, { color: c.accent }]}>{formatCountdown(countdown)}</Text>
            </View>

            {/* Mini-leaderboard */}
            <Text style={[styles.sectionTitle, { color: c.text }]}>Today's Leaderboard</Text>
            {data.leaderboard.length === 0 ? (
              <Card style={styles.empty}>
                <CardContent>
                  <Text style={[styles.emptyText, { color: c.textMuted }]}>
                    Be the first to solve today's challenge and set the record!
                  </Text>
                </CardContent>
              </Card>
            ) : (
              <View style={styles.table}>
                {data.leaderboard.map((entry) => (
                  <View key={entry.attemptId} style={[styles.row, { borderBottomColor: c.border }]}>
                    <Text style={[styles.rank, { color: entry.rank <= 3 ? c.accent : c.textMuted }]}>
                      {entry.rank <= 3 ? ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][entry.rank - 1] : `#${entry.rank}`}
                    </Text>
                    <View style={styles.nameCell}>
                      <Avatar src={entry.user.avatarUrl} fallback={entry.user.name?.[0] ?? '?'} size={28} />
                      <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{entry.user.name}</Text>
                    </View>
                    <Text style={[styles.cost, { color: c.accent }]}>{formatCost(entry.cost)}</Text>
                    <Text style={[styles.tokens, { color: c.textMuted }]}>{entry.tokens.toLocaleString()} tokens</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Card style={styles.empty}>
            <CardContent>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>No daily challenge available.</Text>
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  date: { fontSize: fontSizes.sm },
  challengeCard: { marginBottom: spacing.lg },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  countdownWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  countdownLabel: { fontSize: fontSizes.sm },
  countdownValue: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body },
  sectionTitle: { fontSize: fontSizes.xl, fontWeight: '700', marginBottom: spacing.md, fontFamily: fontFamily.body },
  empty: { marginBottom: spacing.lg },
  emptyText: { textAlign: 'center', fontSize: fontSizes.sm },
  table: {},
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
  cost: { fontSize: fontSizes.sm, fontWeight: '600' },
  tokens: { fontSize: fontSizes.xs, width: 100, textAlign: 'right' },
});
