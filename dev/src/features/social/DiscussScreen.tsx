/**
 * DiscussScreen: Community hub surfacing activity feed and recent challenge discussions.
 * Route: /discuss
 */
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { timeAgo } from '@/shared/lib/utils';
import { UserSearch } from '@/features/social/UserSearch';
import { useDashboardData } from '@/shared/lib/DashboardDataContext';

interface ActivityEntry {
  user: string;
  avatarUrl: string | null;
  challenge: string;
  challengeId?: string;
  cost: number;
  timestamp: string;
}

export function DiscussScreen() {
  useDocumentMeta({ title: 'Discuss', canonicalPath: '/discuss' });
  const { user, loading: authLoading } = useAuthGuard();
  const navigation = useNavigation();
  const c = useColors();
  const { state: cachedData } = useDashboardData();
  const activity = cachedData.activity.data as ActivityEntry[];
  const loading = cachedData.activity.status === 'loading' || cachedData.activity.status === 'idle';

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

        {/* User Search */}
        <Card style={styles.section}>
          <CardHeader>
            <CardTitle>Find Users</CardTitle>
            <CardDescription>Search by username or name</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSearch />
          </CardContent>
        </Card>

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
                        {timeAgo(entry.timestamp)}
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
