import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/stripe';

export function SettingsScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
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

      // Fetch profile for credits
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const r = await fetch(`${base}/api/profile`);
        if (r.ok) {
          const data = await r.json() as { credits: number };
          setCredits(data.credits);
        }
      } catch {}

      // Check for purchase success
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('purchased') === 'true') {
          setShowSuccess(true);
          window.history.replaceState({}, '', '/settings');
          setTimeout(() => setShowSuccess(false), 5000);
        }
      }

      setLoading(false);
    };
    init();
  }, [navigation]);

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
      }
    } catch {}
    setPurchasing(null);
  };

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }
  if (!user) return null;

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
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
            <CardDescription>
              {credits !== null
                ? `You have ${credits.toLocaleString()} credits remaining.`
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
