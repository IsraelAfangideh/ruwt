import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const c = useColors();

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      setLoading(false);
    };
    init();
  }, [navigation]);

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }
  if (!user) return null;

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
