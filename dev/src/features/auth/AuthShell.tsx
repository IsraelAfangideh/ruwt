import type { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BrandPanel } from '@/features/auth/BrandPanel';
import { useIsDesktop } from '@/shared/hooks/useWindowWidth';
import { useColors } from '@/shared/theme';
import { spacing, fontFamily } from '@/shared/theme/tokens';

interface AuthShellProps {
  children: ReactNode;
  variant?: 'form' | 'center';
}

export function AuthShell({ children, variant = 'form' }: AuthShellProps) {
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();
  const c = useColors();

  if (variant === 'center') {
    return (
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        {isDesktop && <BrandPanel />}
        <View style={[styles.centerPanel, !isDesktop && styles.centerPanelMobile]}>
          {!isDesktop && (
            <Text style={[styles.mobileLogo, { color: c.text, marginBottom: spacing.xl }]}>Ruwt</Text>
          )}
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {isDesktop && <BrandPanel />}
      <ScrollView
        contentContainerStyle={[styles.formPanel, !isDesktop && styles.formPanelMobile]}
        style={{ flex: 1 }}
      >
        {!isDesktop && (
          <Pressable onPress={() => navigation.navigate('Landing')} style={styles.mobileHeader}>
            <Text style={[styles.mobileLogo, { color: c.text }]}>Ruwt</Text>
          </Pressable>
        )}
        <View style={styles.formWrap}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%' as any,
  },
  formPanel: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  formPanelMobile: {
    padding: spacing.lg,
  },
  mobileHeader: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  mobileLogo: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  formWrap: {
    maxWidth: 380,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  centerPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  centerPanelMobile: {
    padding: spacing.lg,
  },
});
