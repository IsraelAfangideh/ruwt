import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { BrandPanel } from '@/components/BrandPanel';
import { useIsDesktop } from '@/hooks/useWindowWidth';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

export function CallbackScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'password_recovery'>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const c = useColors();
  const handled = useRef(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const supabase = createClient();

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const ALLOWED_ROUTES = new Set([
      'Problems', 'Leaderboard', 'Profile', 'Settings',
      'Arena', 'DailyChallenge', 'Assessments', 'AssessmentBuilder',
      'Hiring', 'OrgManagement', 'Replay', 'Share', 'Certificate',
    ]);
    const rawRedirect =
      (typeof window !== 'undefined' && localStorage.getItem('oauth_redirect')) ||
      urlParams?.get('redirectTo') ||
      'Problems';
    const redirectTo = ALLOWED_ROUTES.has(rawRedirect) ? rawRedirect : 'Problems';

    if (typeof window !== 'undefined') {
      localStorage.removeItem('oauth_redirect');
    }

    const navigate = async () => {
      if (handled.current) return;
      handled.current = true;
      setStatus('ok');

      const pendingChallenge = typeof window !== 'undefined' ? localStorage.getItem('ruwt_pending_challenge') : null;
      if (pendingChallenge) {
        localStorage.removeItem('ruwt_pending_challenge');
        navigation.reset({ index: 0, routes: [{ name: 'Arena' as never, params: { challengeId: pendingChallenge } }] });
        return;
      }

      // Hiring manager intent: skip dev onboarding, go straight to assessment builder
      const teamIntent = typeof window !== 'undefined' ? localStorage.getItem('ruwt_team_intent') : null;
      const trialIntent = typeof window !== 'undefined' ? localStorage.getItem('ruwt_trial_intent') : null;
      if (teamIntent) {
        localStorage.removeItem('ruwt_team_intent');
        localStorage.removeItem('ruwt_trial_intent');

        // Auto-start trial if they came from the trial CTA
        if (trialIntent) {
          try {
            const trialRes = await fetch('/api/trial/start', { method: 'POST' });
            if (!trialRes.ok) {
              console.warn('Trial start failed:', await trialRes.text().catch(() => ''));
            }
          } catch (e) {
            console.warn('Trial start error:', e);
          }
        } else {
          try {
            await fetch('/api/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountType: 'team', onboardingCompleted: 1 }),
            });
          } catch {}
        }
        navigation.reset({ index: 0, routes: [{ name: 'AssessmentBuilder' as never }] });
        return;
      }

      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.onboardingCompleted === 0) {
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' as never }] });
            return;
          }
        }
      } catch {
        // If profile check fails, continue with default redirect
      }

      navigation.reset({ index: 0, routes: [{ name: redirectTo as never }] });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        // User clicked the password reset link in their email
        handled.current = true;
        setStatus('password_recovery');
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        navigate();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate();
      }
    });

    const timeout = setTimeout(() => {
      if (!handled.current) {
        subscription.unsubscribe();
        setStatus('error');
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigation]);

  const handlePasswordReset = async () => {
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setResetError(error.message);
      setResetLoading(false);
      return;
    }
    setResetSuccess(true);
    setResetLoading(false);
    // Redirect to problems after a brief pause
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'Problems' as never }] });
    }, 2000);
  };

  // --- Password recovery form ---
  if (status === 'password_recovery') {
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
            {resetSuccess ? (
              <>
                <View style={[styles.successIcon, { backgroundColor: c.successBg }]}>
                  <Text style={{ fontSize: 28 }}>{'\u2713'}</Text>
                </View>
                <Text style={[styles.formTitle, { color: c.text }]}>Password updated</Text>
                <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
                  Redirecting you to the dashboard...
                </Text>
              </>
            ) : (
              <>
                <View style={styles.formHeader}>
                  <Text style={[styles.formTitle, { color: c.text }]}>Set new password</Text>
                  <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
                    Choose a new password for your account
                  </Text>
                </View>

                {resetError && (
                  <View style={[styles.errorBox, { backgroundColor: c.errorBg }]}>
                    <Text style={[styles.errorText, { color: c.error }]}>{resetError}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Label htmlFor="reset-new-password">New password</Label>
                  <Input
                    id="reset-new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    editable={!resetLoading}
                    label="New password"
                    aria-describedby="reset-password-hint"
                  />
                  <Text nativeID="reset-password-hint" style={[styles.hint, { color: c.textMuted }]}>Must be at least 8 characters</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Label htmlFor="reset-confirm-password">Confirm password</Label>
                  <Input
                    id="reset-confirm-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    editable={!resetLoading}
                    onSubmitEditing={handlePasswordReset}
                    label="Confirm password"
                  />
                </View>

                <Button onPress={handlePasswordReset} disabled={resetLoading} fullWidth size="lg">
                  {resetLoading ? 'Updating...' : 'Update password'}
                </Button>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Error state ---
  if (status === 'error') {
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
            <View style={[styles.errorIcon, { backgroundColor: c.errorBg }]}>
              <Text style={{ fontSize: 28 }}>!</Text>
            </View>
            <Text style={[styles.formTitle, { color: c.text }]}>Authentication failed</Text>
            <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
              Something went wrong during sign in. Please try again.
            </Text>
            <Button
              onPress={() => navigation.navigate('Login' as never)}
              fullWidth
              style={{ marginTop: spacing.sm }}
            >
              Back to sign in
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- Loading state ---
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {isDesktop && <BrandPanel />}
      <View style={[styles.loadingPanel, !isDesktop && styles.loadingPanelMobile]}>
        {!isDesktop && (
          <Text style={[styles.mobileLogo, { color: c.text, marginBottom: spacing.xl }]}>Ruwt</Text>
        )}
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Completing sign in...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    minHeight: '100%' as any,
  },
  // Form panel
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
  formHeader: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  formTitle: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  formSubtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  hint: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  // Loading state
  loadingPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingPanelMobile: {
    padding: spacing.lg,
  },
  loadingText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
});
