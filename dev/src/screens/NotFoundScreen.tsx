import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { BrandPanel } from '@/components/BrandPanel';
import { useColors } from '@/theme';
import { useIsDesktop } from '@/hooks/useWindowWidth';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function NotFoundScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const isDesktop = useIsDesktop();

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {isDesktop && <BrandPanel />}
      <ScrollView
        contentContainerStyle={[styles.formPanel, !isDesktop && styles.formPanelMobile]}
        style={{ flex: 1 }}
      >
        {!isDesktop && (
          <Pressable onPress={() => navigation.navigate('Landing' as never)} style={styles.mobileHeader}>
            <Text style={[styles.mobileLogo, { color: c.text }]}>Ruwt</Text>
          </Pressable>
        )}
        <View style={styles.formWrap}>
          <Text style={[styles.code, { color: c.accent }]}>404</Text>
          <Text style={[styles.title, { color: c.text }]}>Page not found</Text>
          <Text style={[styles.description, { color: c.textMuted }]}>
            The page you're looking for doesn't exist or has been moved.
          </Text>
          <View style={styles.links}>
            <Button
              onPress={() => navigation.navigate('Landing' as never)}
              fullWidth
              size="lg"
            >
              Go Home
            </Button>
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Challenges' as never)}
              fullWidth
            >
              Browse Challenges
            </Button>
            <Button
              variant="ghost"
              onPress={() => navigation.navigate('Login' as never)}
              fullWidth
            >
              Sign In
            </Button>
          </View>
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  code: {
    fontSize: 80,
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  description: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 320,
    lineHeight: 24,
  },
  links: {
    width: '100%',
    gap: spacing.sm,
  },
});
