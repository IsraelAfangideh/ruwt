import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import type { User } from '@supabase/supabase-js';

interface UserNavProps {
  user: User;
}

export function UserNav({ user }: UserNavProps) {
  const navigation = useNavigation();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const c = useColors();

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Landing' as never }] });
  };

  const initials = user.user_metadata?.name
    ? (user.user_metadata.name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.trigger} accessibilityRole="button" accessibilityLabel="Account menu" accessibilityState={{ expanded: open }} testID="user-menu">
        <Avatar
          src={user.user_metadata?.avatar_url}
          fallback={initials}
          size={32}
        />
      </Pressable>
      {open && (
        <>
          <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityLabel="Close account menu">{null}</Pressable>
          <View style={[styles.menu, { backgroundColor: c.card, borderColor: c.border }]} accessibilityRole="menu">
            <Text style={[styles.menuName, { color: c.text }]}>{user.user_metadata?.name || 'User'}</Text>
            <Text style={[styles.menuEmail, { color: c.mutedForeground }]} numberOfLines={1}>{user.email}</Text>
            <Pressable
              style={[styles.menuItem, { borderTopColor: c.border }]}
              onPress={() => { setOpen(false); navigation.navigate('Profile' as never); }}
              accessibilityRole="menuitem"
            >
              <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Profile</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderTopColor: c.border }]}
              onPress={() => { setOpen(false); navigation.navigate('Settings' as never); }}
              accessibilityRole="menuitem"
            >
              <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Settings</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderTopColor: c.border }]} onPress={handleSignOut} accessibilityRole="menuitem">
              <Text style={{ color: c.destructive, fontSize: fontSizes.sm }}>Sign out</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  wrap: { position: 'relative' },
  trigger: { padding: spacing.xs },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: spacing.xs,
    minWidth: 200,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
    zIndex: 10,
  },
  menuName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  menuEmail: { fontSize: fontSizes.xs, marginTop: 2 },
  menuItem: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
});
