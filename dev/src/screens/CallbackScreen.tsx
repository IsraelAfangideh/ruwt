import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AuthShell } from '@/components/AuthShell';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { DEFAULT_AUTH_REDIRECT, ALLOWED_AUTH_REDIRECTS } from '@/navigation/types';
import { resetNavigation, validScreen } from '@/navigation/resetNavigation';

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

  useEffect(() => {
    const supabase = createClient();

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const rawRedirect =
      (typeof window !== 'undefined' && localStorage.getItem('oauth_redirect')) ||
      urlParams?.get('redirectTo') ||
      '';

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
        resetNavigation(navigation, [{ name: 'Arena', params: { challengeId: pendingChallenge } }]);
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
        resetNavigation(navigation, [{ name: 'AssessmentBuilder' }]);
        return;
      }

      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.onboardingCompleted === 0) {
            resetNavigation(navigation, [{ name: 'Onboarding' }]);
            return;
          }
        }
      } catch {
        // If profile check fails, continue with default redirect
      }

      resetNavigation(navigation, [validScreen(rawRedirect, ALLOWED_AUTH_REDIRECTS, DEFAULT_AUTH_REDIRECT)]);
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
    // Redirect after a brief pause
    setTimeout(() => {
      resetNavigation(navigation, [{ name: DEFAULT_AUTH_REDIRECT }]);
    }, 2000);
  };

  // --- Password recovery form ---
  if (status === 'password_recovery') {
    return (
      <AuthShell>
        {resetSuccess ? (
          <>
            <View style={[styles.successIcon, { backgroundColor: c.successBg }]}>
              <Text style={{ fontSize: 28 }}>{'\u2713'}</Text>
            </View>
            <Text style={[styles.formTitle, { color: c.text }]}>Password updated</Text>
            <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
              Redirecting you to assessments...
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
      </AuthShell>
    );
  }

  // --- Error state ---
  if (status === 'error') {
    return (
      <AuthShell>
        <View style={[styles.errorIcon, { backgroundColor: c.errorBg }]}>
          <Text style={{ fontSize: 28 }}>!</Text>
        </View>
        <Text style={[styles.formTitle, { color: c.text }]}>Authentication failed</Text>
        <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
          Something went wrong during sign in. Please try again.
        </Text>
        <Button
          onPress={() => navigation.navigate('Login')}
          fullWidth
          style={{ marginTop: spacing.sm }}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  // --- Loading state ---
  return (
    <AuthShell variant="center">
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={[styles.loadingText, { color: c.textMuted }]}>Completing sign in...</Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
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
  loadingText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
});
