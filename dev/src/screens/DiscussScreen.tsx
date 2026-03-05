/**
 * DiscussScreen: Community hub surfacing activity feed and recent challenge discussions.
 * Route: /discuss
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface ActivityEntry {
  user: string;
  avatarUrl: string | null;
  challenge: string;
  challengeId?: string;
  cost: number;
  timestamp: string;
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

export function DiscussScreen() {
  useDocumentMeta({ title: 'Discuss', canonicalPath: '/discuss' });
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const c = useColors();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/activity?limit=30');
        if (res.ok) {
          const data = await res.json();
          setActivity(data.activities || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (authLoading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <DashboardLayout user={user}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: c.text }]}>Discuss</Text>
        <Text style={[styles.pageSub, { color: c.textMuted }]}>
          See what the community is solving and join challenge discussions.
        </Text>

        {/* Recent Activity */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Recent Solves</CardTitle>
            <CardDescription>Latest activity across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={c.accent} />
              </View>
            ) : activity.length === 0 ? (
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                No recent activity yet. Be the first to solve a challenge!
              </Text>
            ) : (
              <View accessibilityRole="list">
                {activity.map((entry, i) => (
                  <View
                    key={`${entry.user}-${entry.timestamp}-${i}`}
                    accessibilityRole="listitem"
                    style={[
                      styles.activityRow,
                      i < activity.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
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
                    <View style={[styles.costBadge, { backgroundColor: c.accentBg, borderColor: c.accent + '30' }]}>
                      <Text style={[styles.costText, { color: c.accent }]}>
                        {formatCostFromHundredths(entry.cost)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Discussions CTA */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Challenge Discussions</CardTitle>
            <CardDescription>
              Every challenge has its own comment thread. Share strategies, compare approaches, and learn from other solvers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Pressable
              onPress={() => (navigation.navigate as any)('Problems')}
              style={[styles.browseCta, { backgroundColor: c.accent + '10', borderColor: c.accent + '30' }]}
            >
              <Text style={[styles.browseCtaText, { color: c.accent }]}>
                Browse Problems to Join Discussions
              </Text>
            </Pressable>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card style={styles.sectionLast}>
          <CardHeader>
            <CardTitle>Community Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.guidelineList}>
              <GuidelineItem colors={c} text="Share your approach and what you learned, not just the solution" />
              <GuidelineItem colors={c} text="Compare model choices — which models work best for which challenges?" />
              <GuidelineItem colors={c} text="Help others debug without giving away the full answer" />
              <GuidelineItem colors={c} text="Discuss prompt strategies that improve efficiency" />
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </DashboardLayout>
  );
}

function GuidelineItem({ colors: c, text }: { colors: any; text: string }) {
  return (
    <View style={styles.guidelineRow}>
      <View style={[styles.guidelineDot, { backgroundColor: c.accent }]} />
      <Text style={[styles.guidelineText, { color: c.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },
  pageTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
    marginBottom: spacing.xs,
  },
  pageSub: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
    marginBottom: spacing.lg,
  },
  section: { marginBottom: spacing.lg },
  sectionLast: { marginBottom: 0 },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingVertical: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  activityTextWrap: { flex: 1, gap: 2 },
  activityText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  activityTime: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  costBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  costText: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  browseCta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  browseCtaText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  guidelineList: { gap: spacing.sm },
  guidelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  guidelineDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  guidelineText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, flex: 1, lineHeight: 20 },
});
