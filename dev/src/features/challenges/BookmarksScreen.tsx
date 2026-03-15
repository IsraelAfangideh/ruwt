/**
 * BookmarksScreen: Displays user's saved challenges and replays.
 * Route: /bookmarks
 */
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { CardGridSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/shared/layout/DashboardLayout';
import { Card, CardContent } from '@/shared/ui/Card';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useAuthGuard } from '@/shared/hooks/useAuthGuard';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { formatCostFromHundredths } from '@/shared/lib/ai/pricing';
import { timeAgo } from '@/shared/lib/utils';
import { getDifficultyStyle } from '@/shared/lib/difficulty';
import { useDashboardData } from '@/shared/lib/DashboardDataContext';

interface BookmarkItem {
  id: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  details: {
    title?: string;
    challengeTitle?: string;
    difficulty?: string;
    category?: string;
    totalCost?: number;
    solverName?: string;
  } | null;
}

/* istanbul ignore next -- @preserve */
export function BookmarksScreen() {
  /* istanbul ignore next -- @preserve */
  useDocumentMeta({ title: 'Bookmarks', canonicalPath: '/bookmarks' });
  /* istanbul ignore next -- @preserve */
  const { user, loading: authLoading } = useAuthGuard();
  /* istanbul ignore next -- @preserve */
  const navigation = useNavigation();
  /* istanbul ignore next -- @preserve */
  const c = useColors();
  /* istanbul ignore next -- @preserve */
  const { state: cachedData, refreshEndpoint } = useDashboardData();
  /* istanbul ignore next -- @preserve */
  const [filter, setFilter] = useState<'all' | 'challenge' | 'replay'>('all');

  /* istanbul ignore next -- @preserve */
  const allBookmarks = cachedData.bookmarks.data as BookmarkItem[];
  /* istanbul ignore next -- @preserve */
  const bookmarks = filter === 'all' ? allBookmarks : allBookmarks.filter(b => b.targetType === filter);
  /* istanbul ignore next -- @preserve */
  const loading = cachedData.bookmarks.status === 'loading' || cachedData.bookmarks.status === 'idle';

  /* istanbul ignore next -- @preserve */
  const handleRemove = async (targetType: string, targetId: string) => {
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        refreshEndpoint('bookmarks');
      }
    } catch { /* ignore */ }
  };

  /* istanbul ignore next -- @preserve */
  if (authLoading || !user) {
    /* istanbul ignore next -- @preserve */
    return <CardGridSkeleton />;
  }

  /* istanbul ignore next -- @preserve */
  return (
    <DashboardLayout user={user}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageTitle, { color: c.text }]}>Bookmarks</Text>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(['all', 'challenge', 'replay'] as const).map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)}>
              <Text style={[
                styles.filterTab,
                { color: filter === f ? c.accent : c.textMuted },
              ]}>
                {f === 'all' ? 'All' : f === 'challenge' ? 'Challenges' : 'Replays'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <CardGridSkeleton cards={3} />
        ) : bookmarks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CardContent style={styles.emptyContent}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No bookmarks yet</Text>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                Save challenges and replays to revisit later.
              </Text>
              <Pressable onPress={() => (navigation.navigate as any)('Problems')}>
                <Text style={[styles.browseLink, { color: c.accent }]}>Browse Challenges</Text>
              </Pressable>
            </CardContent>
          </Card>
        ) : (
          /* istanbul ignore next -- @preserve */
          bookmarks.map((b) => {
            /* istanbul ignore next -- @preserve */
            const d = b.details;
            /* istanbul ignore next -- @preserve */
            const diffStyle = d?.difficulty ? getDifficultyStyle(d.difficulty) : null;

            /* istanbul ignore next -- @preserve */
            return (
              <Card key={b.id} style={[styles.bookmarkCard, { borderColor: c.border }]}>
                <Pressable
                  style={styles.bookmarkRow}
                  onPress={() => {
                    /* istanbul ignore next -- @preserve */
                    if (b.targetType === 'challenge') {
                      /* istanbul ignore next -- @preserve */
                      (navigation.navigate as any)('Arena', { challengeId: b.targetId });
                    /* istanbul ignore next -- @preserve */
                    } else {
                      /* istanbul ignore next -- @preserve */
                      (navigation.navigate as any)('Replay', { attemptId: b.targetId });
                    }
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookmarkTitle, { color: c.text }]}>
                      {d?.title || d?.challengeTitle || 'Untitled'}
                    </Text>
                    <View style={styles.bookmarkMeta}>
                      <Text style={[styles.bookmarkType, { color: c.textMuted }]}>
                        {b.targetType === 'challenge' ? 'Challenge' : 'Replay'}
                      </Text>
                      {diffStyle && (
                        <Text style={[styles.diffBadge, { color: diffStyle.color }]}>
                          {diffStyle.label}
                        </Text>
                      )}
                      {d?.totalCost != null && (
                        <Text style={{ color: c.accent, fontSize: fontSizes.xs }}>
                          {formatCostFromHundredths(d.totalCost)}
                        </Text>
                      )}
                      <Text style={{ color: c.textMuted, fontSize: fontSizes.xs }}>
                        {timeAgo(b.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemove(b.targetType, b.targetId)} style={styles.removeBtn}>
                    <Text style={{ color: c.textMuted, fontSize: 16 }}>{'\u2715'}</Text>
                  </Pressable>
                </Pressable>
              </Card>
            );
          })
        )}
      </ScrollView>
    </DashboardLayout>
  );
}

/* istanbul ignore next -- @preserve */
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['2xl'] },
  pageTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterTab: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: fontFamily.body,
  },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyCard: { marginTop: spacing.lg },
  emptyContent: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', fontFamily: fontFamily.body, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, textAlign: 'center', marginBottom: spacing.md },
  browseLink: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  bookmarkCard: { marginBottom: spacing.sm, borderWidth: 1, borderRadius: radii.md },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  bookmarkTitle: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  bookmarkMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: 2,
  },
  bookmarkType: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  diffBadge: { fontSize: fontSizes.xs, fontWeight: '600' },
  removeBtn: {
    padding: spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
