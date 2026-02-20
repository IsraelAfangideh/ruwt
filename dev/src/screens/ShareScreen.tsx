/**
 * ShareScreen: Public page at /share/:attemptId
 * Shows challenge completion details with CTA to try on ruwt.dev
 */
import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { getDifficultyStyle } from '@/lib/difficulty';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

interface ShareData {
  attemptId: string;
  cost: number;
  passedTests: number;
  totalTests: number;
  submittedAt: string | null;
  rank: number;
  challenge: {
    id: string;
    title: string;
    difficulty: string;
    category: string | null;
    language: string | null;
  } | null;
  solver: {
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
}

function formatCost(cents: number): string {
  const d = cents / 10000;
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

export function ShareScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params || {}) as { attemptId?: string };
  const attemptId = params.attemptId ?? '';
  const c = useColors();

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: data ? `${data.solver?.name || 'A developer'} solved "${data.challenge?.title || 'Challenge'}" for ${formatCost(data.cost)}` : undefined,
    description: data ? `Solved with ${formatCost(data.cost)} AI cost on ruwt.dev. Ranked by efficiency.` : undefined,
    canonicalPath: attemptId ? `/share/${attemptId}` : undefined,
  });

  useEffect(() => {
    if (!attemptId) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/share/${attemptId}`);
        if (!res.ok) {
          setError('Share not found');
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load');
      }
      setLoading(false);
    })();
  }, [attemptId]);

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
        <Text style={{ color: c.textMuted, fontSize: 16 }}>{error || 'Not found'}</Text>
      </View>
    );
  }

  const diffStyle = getDifficultyStyle(data.challenge?.difficulty || 'medium');
  const diffColor = diffStyle.color;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.card}>
        <Text style={[styles.brand, { color: c.accent }]}>ruwt.dev</Text>

        <Text style={[styles.solverName, { color: c.text }]}>
          {data.solver?.name || 'A developer'} solved
        </Text>

        <Text style={[styles.challengeTitle, { color: c.text }]}>
          {data.challenge?.title || 'Challenge'}
        </Text>

        <View style={styles.badges}>
          {data.challenge?.difficulty && (
            <View style={[styles.badge, { borderColor: diffColor, backgroundColor: diffStyle.bg }]}>
              <Text style={[styles.badgeText, { color: diffColor }]}>
                {diffStyle.label}
              </Text>
            </View>
          )}
          {data.challenge?.language && data.challenge.language !== 'javascript' && (
            <View style={[styles.badge, { borderColor: '#3b82f6' }]}>
              <Text style={[styles.badgeText, { color: '#3b82f6' }]}>
                {data.challenge.language}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.accent }]}>{formatCost(data.cost)}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>AI Cost</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.text }]}>#{data.rank}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Rank</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: c.success }]}>{data.passedTests}/{data.totalTests}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>Tests</Text>
          </View>
        </View>

        <button
          style={{
            background: c.accent,
            border: 'none',
            borderRadius: 8,
            color: '#0d1117',
            padding: '12px 32px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 24,
            width: '100%',
          }}
          onClick={() => {
            if (data.challenge?.id) {
              (navigation.navigate as any)('Arena', { challengeId: data.challenge.id });
            } else {
              (navigation.navigate as any)('Challenges');
            }
          }}
        >
          Try This Challenge
        </button>

        <button
          style={{
            background: 'transparent',
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            color: c.textMuted,
            padding: '10px 32px',
            fontSize: 14,
            cursor: 'pointer',
            marginTop: 8,
            width: '100%',
          }}
          onClick={() => (navigation.navigate as any)('Replay', { attemptId: data.attemptId })}
        >
          Watch Replay
        </button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    maxWidth: 460,
    width: '100%',
    alignItems: 'center',
    padding: spacing.xl,
  },
  brand: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  solverName: {
    fontSize: fontSizes.sm,
    marginBottom: spacing.xs,
  },
  challengeTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
