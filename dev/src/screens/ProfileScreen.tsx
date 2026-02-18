import { View, Text, StyleSheet } from 'react-native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useAuthGuard } from '@/hooks/useAuthGuard';

function ProfileSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.bg, padding: spacing.xl }]}>
      <Card style={styles.card}>
        <CardContent style={styles.profile}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <Skeleton width={140} height={20} borderRadius={radii.sm} />
          <Skeleton width={200} height={14} borderRadius={radii.sm} />
        </CardContent>
      </Card>
    </View>
  );
}

export function ProfileScreen() {
  const { user, loading } = useAuthGuard();
  const c = useColors();

  if (loading || !user) {
    return <ProfileSkeleton />;
  }

  const initials = user.user_metadata?.name
    ? (user.user_metadata.name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>Profile</Text>
      <Card style={styles.card}>
        <CardContent style={styles.profile}>
          <Avatar src={user.user_metadata?.avatar_url} fallback={initials} size={64} />
          <Text style={[styles.name, { color: c.text }]}>{user.user_metadata?.name || 'User'}</Text>
          <Text style={[styles.email, { color: c.textMuted }]}>{user.email}</Text>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.lg, fontFamily: fontFamily.body },
  card: {},
  profile: { alignItems: 'center', gap: spacing.sm },
  name: { fontSize: fontSizes.xl, fontWeight: '600' },
  email: { fontSize: fontSizes.sm },
});
