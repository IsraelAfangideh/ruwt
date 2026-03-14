import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { resetNavigation } from '@/navigation/resetNavigation';
import { Avatar } from '@/components/ui/Avatar';
import { useAppMode } from '@/lib/AppModeContext';
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
  const { mode, isOrgMember, orgInfo } = useAppMode();

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  const handleSignOut = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    resetNavigation(navigation, [{ name: 'Landing' }]);
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
            {mode === 'hiring' && isOrgMember && orgInfo && (
              <Text style={[styles.menuMode, { color: c.textMuted }]} testID="user-nav-mode">
                {orgInfo.name}
              </Text>
            )}
            <Pressable
              style={[styles.menuItem, { borderTopColor: c.border }]}
              onPress={() => { setOpen(false); navigation.navigate('Profile'); }}
              accessibilityRole="menuitem"
            >
              <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Profile</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderTopColor: c.border }]}
              onPress={() => { setOpen(false); navigation.navigate('Bookmarks'); }}
              accessibilityRole="menuitem"
            >
              <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Bookmarks</Text>
            </Pressable>
            {mode === 'hiring' && isOrgMember && (
              <Pressable
                style={[styles.menuItem, { borderTopColor: c.border }]}
                onPress={() => { setOpen(false); navigation.navigate('OrgManagement', {}); }}
                accessibilityRole="menuitem"
                testID="user-nav-org-settings"
              >
                <Text style={{ color: c.text, fontSize: fontSizes.sm }}>Org Settings</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.menuItem, { borderTopColor: c.border }]}
              onPress={() => { setOpen(false); navigation.navigate('Settings'); }}
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
  menuMode: { fontSize: fontSizes.xs, marginTop: 4, fontFamily: fontFamily.body },
  menuItem: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
});
