import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing } from '@/theme/tokens';
import { Button } from '@/components/ui';
import { copyInstallCommand } from '@/lib/marketing/tracking';

type PublicLayoutProps = {
  children: ReactNode;
  active?: 'home' | 'blog' | 'download';
};

export function PublicLayout({ children, active }: PublicLayoutProps) {
  const c = useColors();
  const navigation = useNavigation<any>();

  const handleHeaderDownload = () => {
    void copyInstallCommand('header').finally(() => {
      navigation.navigate('Download');
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.borderStrong, backgroundColor: c.bgElevated }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => navigation.navigate('Landing')}>
            <Text style={[styles.logo, { color: c.text }]}>ruwt.ai</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('Blog')}>
              <Text
                style={[
                  styles.navLink,
                  { color: active === 'blog' ? c.text : c.textMuted },
                  active === 'blog' && styles.navLinkActive,
                ]}
              >
                Blog
              </Text>
            </Pressable>
            <Button size="sm" onPress={handleHeaderDownload} accessibilityLabel="Download Ruwt collector">
              Download
            </Button>
          </View>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
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
  navLinkActive: { fontWeight: '700' },
  body: { flex: 1, width: '100%' },
});
