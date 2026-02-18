import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/stripe';
import { useToast } from '@/components/ui/Toast';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export function SettingsScreen() {
  const { user, loading: authLoading } = useAuthGuard();
  const [credits, setCredits] = useState<number | null>(null);
  const [accountType, setAccountType] = useState<'individual' | 'team'>('individual');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const c = useColors();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Fetch profile for credits and account type
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const r = await fetch(`${base}/api/profile`);
        if (r.ok) {
          const data = await r.json() as { credits: number; accountType?: 'individual' | 'team' };
          setCredits(data.credits);
          if (data.accountType) setAccountType(data.accountType);
        }
      } catch {
        showToast('Failed to load profile', 'error');
      }

      // Check for purchase success
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('purchased') === 'true') {
          setShowSuccess(true);
          window.history.replaceState({}, '', '/settings');
          setTimeout(() => setShowSuccess(false), 5000);
        }
      }

    };
    init();
  }, [user]);

  const handleBuy = async (pkg: CreditPackage) => {
    setPurchasing(pkg.id);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const r = await fetch(`${base}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (r.ok) {
        const data = await r.json() as { url: string };
        if (data.url) window.location.href = data.url;
      } else {
        showToast('Failed to start checkout. Please try again.', 'error');
      }
    } catch {
      showToast('Failed to start checkout. Please try again.', 'error');
    }
    setPurchasing(null);
  };

  if (authLoading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg, padding: spacing.xl }]}>
        <View style={{ width: '100%', maxWidth: 600 }}>
          <Skeleton width={120} height={28} borderRadius={radii.sm} style={{ marginBottom: spacing.lg }} />
          <Card style={styles.card}>
            <CardContent>
              <Skeleton width={160} height={18} borderRadius={radii.sm} />
              <SkeletonLines lines={2} />
            </CardContent>
          </Card>
          <Card style={styles.card}>
            <CardContent>
              <Skeleton width={100} height={18} borderRadius={radii.sm} />
              <Skeleton width={220} height={14} borderRadius={radii.sm} />
            </CardContent>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>

      {showSuccess && (
        <View style={[styles.successBanner, { backgroundColor: c.successBg, borderColor: c.success }]}>
          <Text style={[styles.successText, { color: c.success }]}>
            Purchase successful! Credits have been added to your account.
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll}>
        {accountType === 'team' ? (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Assessment Credits</CardTitle>
              <CardDescription>
                {credits !== null
                  ? `You have ${credits.toLocaleString()} assessment credits remaining.`
                  : 'Loading balance...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.packages}>
                {CREDIT_PACKAGES.map((pkg) => (
                  <View key={pkg.id} style={[styles.pkgCard, { borderColor: c.border, backgroundColor: c.card }]}>
                    {pkg.badge && (
                      <Badge variant="default" style={styles.pkgBadge}>{pkg.badge}</Badge>
                    )}
                    <Text style={[styles.pkgCredits, { color: c.text }]}>{pkg.label}</Text>
                    <Text style={[styles.pkgPrice, { color: c.accent }]}>
                      ${(pkg.priceInCents / 100).toFixed(2)}
                    </Text>
                    <Text style={[styles.pkgUnit, { color: c.textMuted }]}>
                      ${(pkg.priceInCents / pkg.credits).toFixed(2)}/credit
                    </Text>
                    <Button
                      onPress={() => handleBuy(pkg)}
                      disabled={purchasing !== null}
                      style={styles.pkgBtn}
                    >
                      {purchasing === pkg.id ? 'Redirecting...' : 'Buy'}
                    </Button>
                  </View>
                ))}
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Practice</CardTitle>
              <CardDescription>
                Free unlimited practice on all challenges. AI costs are tracked for leaderboard scoring but never charged.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {user.email}</CardDescription>
          </CardHeader>
        </Card>
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.lg, fontFamily: fontFamily.body },
  scroll: { flex: 1 },
  card: { marginBottom: spacing.lg },
  successBanner: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  successText: { fontWeight: '600', textAlign: 'center', fontFamily: fontFamily.body },
  packages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pkgCard: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
  },
  pkgBadge: { marginBottom: spacing.sm },
  pkgCredits: { fontSize: fontSizes.lg, fontWeight: '700', marginBottom: spacing.xs, fontFamily: fontFamily.body },
  pkgPrice: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body },
  pkgUnit: { fontSize: fontSizes.xs, marginBottom: spacing.md, fontFamily: fontFamily.body },
  pkgBtn: { width: '100%' },
});
