import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/shared/lib/supabase/client';
import { useAuth } from '@/shared/lib/AuthContext';
import { resetNavigation } from '@/shared/navigation/resetNavigation';
import { DEFAULT_AUTH_REDIRECT } from '@/shared/navigation/types';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import { AuthShell } from '@/features/auth/AuthShell';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';

const githubIconUri = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`)}`;

export function RegisterScreen() {
  useDocumentMeta({ title: 'Get Started', description: 'Create your free account on ruwt.dev. Practice with unlimited AI across 15 models and 60+ real-world challenges.', canonicalPath: '/register' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigation = useNavigation();
  const supabase = createClient();
  const c = useColors();
  const errorRef = useRef<any>(null);
  const { user: authUser, loading: authLoading } = useAuth();

  // Redirect already-authenticated users away from register
  useEffect(() => {
    if (!authLoading && authUser) {
      resetNavigation(navigation, [{ name: DEFAULT_AUTH_REDIRECT }]);
    }
  }, [authLoading, authUser, navigation]);

  useEffect(() => {
    if (error && errorRef.current) {
      (errorRef.current as any).focus?.();
    }
  }, [error]);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${origin}/callback`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    setLoading(true);
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/callback` },
    });
    if (err) setError(err.message);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell>
        <View style={[styles.successIcon, { backgroundColor: c.successBg }]}>
          <Text style={{ fontSize: 28 }}>{'\u2709'}</Text>
        </View>
        <Text style={[styles.formTitle, { color: c.text }]}>Check your email</Text>
        <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
          We sent a confirmation link to{' '}
          <Text style={{ fontWeight: '600', color: c.text }}>{email}</Text>
        </Text>
        <Text style={[styles.confirmHint, { color: c.textMuted }]}>
          Click the link in your email to activate your account and start competing.
        </Text>
        <Button
          variant="outline"
          onPress={() => navigation.navigate('Login')}
          fullWidth
          style={{ marginTop: spacing.sm }}
        >
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: c.text }]}>Create your account</Text>
        <Text style={[styles.formSubtitle, { color: c.textMuted }]}>
          Start competing in under a minute
        </Text>
      </View>

      <View style={[styles.creditsBadge, { backgroundColor: c.accentBg }]}>
        <Text style={[styles.creditsBadgeText, { color: c.accent }]}>
          {'\u2728'} Free to practice. Unlimited AI.
        </Text>
      </View>

      {error && (
        <View ref={errorRef} style={[styles.errorBox, { backgroundColor: c.errorBg }]} accessibilityRole="alert" accessibilityLiveRegion="polite" tabIndex={-1}>
          <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() => handleOAuth('github')}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Continue with GitHub"
        testID="github-oauth-button"
        style={({ pressed }: { pressed: boolean }) => [
          styles.oauthBtn,
          { borderColor: c.borderStrong },
          pressed && { opacity: 0.9 },
          loading && { opacity: 0.5 },
        ]}
      >
        <Image source={{ uri: githubIconUri(c.text) }} style={styles.oauthIcon} resizeMode="contain" accessibilityLabel="" />
        <Text style={[styles.oauthBtnText, { color: c.text }]}>Continue with GitHub</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: c.borderStrong }]} />
        <Text style={[styles.dividerText, { color: c.textMuted }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: c.borderStrong }]} />
      </View>

      <View style={styles.inputGroup}>
        <Label htmlFor="register-name">Name</Label>
        <Input
          id="register-name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          editable={!loading}
          testID="name-input"
        />
      </View>

      <View style={styles.inputGroup}>
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />
      </View>

      <View style={styles.inputGroup}>
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          onSubmitEditing={handleRegister}
          aria-describedby="register-password-hint"
        />
        <Text nativeID="register-password-hint" style={[styles.hint, { color: c.textMuted }]}>Must be at least 8 characters</Text>
      </View>

      <Button onPress={handleRegister} disabled={loading} fullWidth size="lg" testID="register-button">
        {loading ? 'Creating account...' : 'Create account'}
      </Button>

      <Text style={[styles.switchText, { color: c.textMuted }]}>
        Already have an account?{' '}
        <Text
          style={{ color: c.accent, fontWeight: '600' }}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="link"
        >
          Sign in
        </Text>
      </Text>
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
  creditsBadge: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  creditsBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
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
  confirmHint: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 20,
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  oauthIcon: {
    width: 20,
    height: 20,
  },
  oauthBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.5,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  hint: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  switchText: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    fontFamily: fontFamily.body,
    marginTop: spacing.sm,
  },
});
