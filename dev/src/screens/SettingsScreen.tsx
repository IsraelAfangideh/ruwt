import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonLines } from '@/components/ui/Skeleton';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useToast } from '@/components/ui/Toast';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export function SettingsScreen() {
  const { user, loading: authLoading } = useAuthGuard();
  const [accountType, setAccountType] = useState<'individual' | 'team'>('individual');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none');
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [newsletterSubscribed, setNewsletterSubscribed] = useState<boolean>(true);
  const [togglingNewsletter, setTogglingNewsletter] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
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
          const data = await r.json() as { accountType?: 'individual' | 'team'; newsletterSubscribed?: number; subscriptionStatus?: string; subscriptionPlan?: string | null };
          if (data.accountType) setAccountType(data.accountType);
          if (data.subscriptionStatus) setSubscriptionStatus(data.subscriptionStatus);
          if (data.subscriptionPlan !== undefined) setSubscriptionPlan(data.subscriptionPlan);
          setNewsletterSubscribed(data.newsletterSubscribed !== 0);
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

  const toggleNewsletter = async () => {
    const newValue = !newsletterSubscribed;
    setNewsletterSubscribed(newValue);
    setTogglingNewsletter(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const r = await fetch(`${base}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsletterSubscribed: newValue ? 1 : 0 }),
      });
      if (!r.ok) {
        setNewsletterSubscribed(!newValue); // revert
        showToast('Failed to update preference', 'error');
      }
    } catch {
      setNewsletterSubscribed(!newValue); // revert
      showToast('Failed to update preference', 'error');
    }
    setTogglingNewsletter(false);
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
              <CardTitle>Hiring Subscription</CardTitle>
              <CardDescription>
                {subscriptionStatus === 'active'
                  ? `Active ${subscriptionPlan === 'annual' ? 'annual' : 'monthly'} subscription. Unlimited assessments.`
                  : subscriptionStatus === 'canceled'
                    ? 'Your subscription has been canceled.'
                    : subscriptionStatus === 'past_due'
                      ? 'Your payment is past due. Please update your payment method.'
                      : 'Subscribe to create unlimited assessments for your team.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptionStatus === 'active' || subscriptionStatus === 'past_due' ? (
                <Button
                  variant="outline"
                  disabled={billingLoading}
                  onPress={async () => {
                    setBillingLoading(true);
                    try {
                      const res = await fetch('/api/billing/portal', { method: 'POST' });
                      const data = await res.json() as { url?: string; error?: string };
                      if (data.url) {
                        window.location.href = data.url;
                        return;
                      }
                      showToast(data.error ?? 'Failed to open billing portal', 'error');
                    } catch {
                      showToast('Failed to open billing portal', 'error');
                    }
                    setBillingLoading(false);
                  }}
                >
                  {billingLoading ? 'Loading…' : 'Manage Billing'}
                </Button>
              ) : (
                <Button
                  onPress={() => {
                    if (typeof window !== 'undefined') window.location.href = '/teams';
                  }}
                >
                  {subscriptionStatus === 'canceled' ? 'Resubscribe' : 'Subscribe — $200/mo'}
                </Button>
              )}
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
            <CardTitle>Email Preferences</CardTitle>
            <CardDescription>Control what emails you receive from ruwt.dev</CardDescription>
          </CardHeader>
          <CardContent>
            <Pressable
              onPress={toggleNewsletter}
              disabled={togglingNewsletter}
              style={styles.toggleRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: c.text }]}>Daily newsletter</Text>
                <Text style={[styles.toggleDesc, { color: c.textMuted }]}>
                  Platform updates and dev links, once a day
                </Text>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  { backgroundColor: newsletterSubscribed ? c.accent : c.border },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    {
                      backgroundColor: '#fff',
                      transform: [{ translateX: newsletterSubscribed ? 20 : 2 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  toggleDesc: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
