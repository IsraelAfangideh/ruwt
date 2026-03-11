/**
 * Reusable skeleton compositions for page-level loading states.
 * Built on the Skeleton/SkeletonLines primitives.
 */
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii } from '@/theme/tokens';
import { Skeleton, SkeletonLines } from './Skeleton';

/* ------------------------------------------------------------------ */
/*  CardGridSkeleton                                                   */
/*  Title + subtitle + grid of card skeletons                          */
/* ------------------------------------------------------------------ */
export function CardGridSkeleton({ cards = 6 }: { cards?: number } = {}) {
  const c = useColors();
  return (
    <View testID="skeleton-card-grid" style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Skeleton width="40%" height={28} />
        <Skeleton width="60%" height={14} style={{ marginTop: spacing.sm }} />
        <View style={styles.grid}>
          {Array.from({ length: cards }).map((_, i) => (
            <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton width="70%" height={18} />
              <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
              <SkeletonLines lines={2} spacing={8} />
              <View style={styles.row}>
                <Skeleton width={60} height={24} borderRadius={radii.full} />
                <Skeleton width={60} height={24} borderRadius={radii.full} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  TableSkeleton                                                      */
/*  Title + header row + data rows with avatar circles                 */
/* ------------------------------------------------------------------ */
export function TableSkeleton({ rows = 8 }: { rows?: number } = {}) {
  const c = useColors();
  return (
    <View testID="skeleton-table" style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Skeleton width="30%" height={28} />
        {/* header row */}
        <View style={[styles.tableRow, { marginTop: spacing.lg }]}>
          <Skeleton width={40} height={14} />
          <Skeleton width="30%" height={14} />
          <Skeleton width="20%" height={14} />
          <Skeleton width="15%" height={14} />
        </View>
        {/* data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={[styles.tableRow, { borderTopWidth: 1, borderTopColor: c.border }]}>
            <Skeleton width={24} height={24} borderRadius={radii.full} />
            <Skeleton width="35%" height={14} />
            <Skeleton width="20%" height={14} />
            <Skeleton width="10%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  DetailCardSkeleton                                                 */
/*  Centered card with title, subtitle, stats row, button              */
/* ------------------------------------------------------------------ */
export function DetailCardSkeleton() {
  const c = useColors();
  return (
    <View testID="skeleton-detail" style={[styles.fill, styles.centerContent, { backgroundColor: c.bg }]}>
      <View style={[styles.detailCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Skeleton width="50%" height={24} style={{ alignSelf: 'center' }} />
        <Skeleton width="70%" height={14} style={{ alignSelf: 'center', marginTop: spacing.sm }} />
        <View style={[styles.row, { justifyContent: 'center', marginTop: spacing.lg }]}>
          <Skeleton width={60} height={40} borderRadius={radii.md} />
          <Skeleton width={60} height={40} borderRadius={radii.md} />
          <Skeleton width={60} height={40} borderRadius={radii.md} />
        </View>
        <Skeleton width={140} height={40} borderRadius={radii.md} style={{ alignSelf: 'center', marginTop: spacing.lg }} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  ProfileSkeleton                                                    */
/*  Avatar circle + name + stats row + badge grid + replays            */
/* ------------------------------------------------------------------ */
export function ProfileSkeleton() {
  const c = useColors();
  return (
    <View testID="skeleton-profile" style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={[styles.container, { alignItems: 'center' }]}>
        <Skeleton width={80} height={80} borderRadius={radii.full} />
        <Skeleton width="40%" height={22} style={{ marginTop: spacing.md }} />
        <Skeleton width="25%" height={14} style={{ marginTop: spacing.xs }} />
        <View style={[styles.row, { justifyContent: 'center', marginTop: spacing.lg }]}>
          <Skeleton width={70} height={36} borderRadius={radii.md} />
          <Skeleton width={70} height={36} borderRadius={radii.md} />
          <Skeleton width={70} height={36} borderRadius={radii.md} />
        </View>
        <View style={[styles.grid, { marginTop: spacing.lg }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Skeleton width="60%" height={16} />
              <SkeletonLines lines={2} spacing={6} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  SplitPaneSkeleton                                                  */
/*  Header bar + two-column layout (chat messages + code block)        */
/* ------------------------------------------------------------------ */
export function SplitPaneSkeleton() {
  const c = useColors();
  return (
    <View testID="skeleton-split-pane" style={[styles.fill, { backgroundColor: c.bg }]}>
      {/* top bar */}
      <View style={[styles.topBar, { borderBottomColor: c.border }]}>
        <Skeleton width={120} height={18} />
        <View style={styles.row}>
          <Skeleton width={60} height={28} borderRadius={radii.md} />
          <Skeleton width={60} height={28} borderRadius={radii.md} />
        </View>
      </View>
      <View style={styles.splitBody}>
        {/* left pane — messages */}
        <View style={[styles.pane, { borderRightWidth: 1, borderRightColor: c.border }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.chatBubble}>
              <Skeleton width={28} height={28} borderRadius={radii.full} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="30%" height={12} />
                <SkeletonLines lines={2} spacing={6} />
              </View>
            </View>
          ))}
        </View>
        {/* right pane — code */}
        <View style={styles.pane}>
          <Skeleton width="100%" height={20} />
          <SkeletonLines lines={10} spacing={4} />
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  FormSkeleton                                                       */
/*  Title + form fields (label + input rect) + button                  */
/* ------------------------------------------------------------------ */
export function FormSkeleton({ fields = 4 }: { fields?: number } = {}) {
  const c = useColors();
  return (
    <View testID="skeleton-form" style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Skeleton width="35%" height={28} />
        <Skeleton width="55%" height={14} style={{ marginTop: spacing.sm }} />
        {Array.from({ length: fields }).map((_, i) => (
          <View key={i} style={{ marginTop: spacing.lg }}>
            <Skeleton width={80} height={14} />
            <Skeleton width="100%" height={40} borderRadius={radii.md} style={{ marginTop: spacing.xs }} />
          </View>
        ))}
        <Skeleton width={120} height={44} borderRadius={radii.md} style={{ marginTop: spacing['2xl'] }} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  CommentListSkeleton                                                */
/*  Avatar circles + name lines + content lines                        */
/* ------------------------------------------------------------------ */
export function CommentListSkeleton({ count = 3 }: { count?: number } = {}) {
  return (
    <View testID="skeleton-comments">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.chatBubble}>
          <Skeleton width={32} height={32} borderRadius={radii.full} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="25%" height={12} />
            <SkeletonLines lines={2} spacing={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: spacing.lg, maxWidth: 960, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  card: {
    minWidth: 260,
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailCard: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
  },
  splitBody: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, padding: spacing.md, gap: spacing.sm },
  chatBubble: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
