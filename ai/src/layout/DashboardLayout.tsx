import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing } from '@/theme/tokens';
import { createClient } from '@/lib/supabase/client';

export function DashboardLayout({ user, children }: { user: User; children: ReactNode }) {
  const c = useColors();
  const navigation = useNavigation<any>();

  const signOut = async () => {
    await createClient().auth.signOut();
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.borderStrong, backgroundColor: c.bgElevated }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigation.navigate('Dashboard')}>
            <Text style={[styles.logo, { color: c.text }]}>ruwt.ai</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('OrgSettings')}>
              <Text style={[styles.navLink, { color: c.textMuted }]}>Workspace</Text>
            </Pressable>
            <Text style={[styles.userLabel, { color: c.textSubtle }]}>{user.email}</Text>
            <Pressable onPress={() => void signOut()}>
              <Text style={[styles.navLink, { color: c.accent }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100vh' as any },
  header: { borderBottomWidth: 1, width: '100%' },
  headerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  logo: { fontFamily: fontFamily.display, fontSize: fontSizes['2xl'], fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  navLink: { fontSize: fontSizes.sm, fontWeight: '600' },
  userLabel: { fontSize: fontSizes.xs, maxWidth: 180 },
  content: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
});
