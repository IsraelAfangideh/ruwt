import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardNav } from './DashboardNav';
import { UserNav } from './UserNav';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { TrialBanner } from './TrialBanner';
import { ModeSwitcher } from './ModeSwitcher';
import { Button } from './ui/Button';
import { useAppMode } from '@/lib/AppModeContext';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import type { User } from '@supabase/supabase-js';

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
  requireOrg?: boolean;
}

export function DashboardLayout({ user, children, requireOrg }: DashboardLayoutProps) {
  const navigation = useNavigation();
  const c = useColors();
  const { profile, profileLoading, isOrgMember, canAccessHiringMode } = useAppMode();

  const accountType = profile?.accountType ?? 'individual';
  const trial = profile?.trial ?? null;
  const subscriptionStatus = profile?.subscriptionStatus ?? 'none';

  const renderContent = () => {
    if (requireOrg && profileLoading) {
      return (
        <View style={styles.gateCenter}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      );
    }
    if (requireOrg && !isOrgMember) {
      return (
        <View style={styles.gateCenter}>
          <Text style={[styles.gateTitle, { color: c.text }]}>Team Account Required</Text>
          <Text style={[styles.gateSub, { color: c.textMuted }]}>
            Create assessments, manage your team, and evaluate candidates with a team account.
          </Text>
          <Button onPress={() => navigation.navigate('Hiring' as never)}>
            Upgrade to Teams
          </Button>
        </View>
      );
    }
    return children;
  };

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Skip to main content link */}
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <View style={[styles.header, { backgroundColor: c.bg, borderBottomColor: c.border }]} accessibilityRole="banner">
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.navigate('Problems' as never)} style={styles.logo} accessibilityRole="link" accessibilityLabel="Ruwt – go to problems">
            <View style={[styles.logoBox, { backgroundColor: c.primary + '20', borderColor: c.accent }]}>
              <Text style={[styles.logoLetter, { color: c.primary }]}>R</Text>
            </View>
            <Text style={[styles.logoText, { color: c.text }]}>
              Ruwt<Text style={[styles.logoDot, { color: c.primary }]}>.dev</Text>
            </Text>
          </Pressable>
          <ModeSwitcher />
          <DashboardNav />
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
          <ThemeToggle />
          <UserNav user={user} />
        </View>
      </View>
      <View style={styles.main} accessibilityRole="main" nativeID="main-content" tabIndex={-1}>
        {!profileLoading && trial && accountType === 'team' && <TrialBanner trial={trial} subscriptionStatus={subscriptionStatus} />}
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 30,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontSize: 10, fontWeight: '700', fontFamily: fontFamily.body },
  logoText: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  logoDot: { fontSize: fontSizes.xs },
  main: { flex: 1, padding: spacing.lg, maxWidth: 1280, alignSelf: 'center', width: '100%' },
  gateCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: spacing.md },
  gateTitle: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.display },
  gateSub: { fontSize: fontSizes.md, textAlign: 'center', maxWidth: 400 },
});
