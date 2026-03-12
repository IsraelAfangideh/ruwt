/**
 * Login screen — email/password + GitHub OAuth.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export function LoginScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHub = async () => {
    setError('');
    try {
      const supabase = createClient();
      // Store redirect destination
      localStorage.setItem('ruwt-health-redirect', '/');
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/callback` },
      });
      if (authError) setError(authError.message);
    } catch (e: any) {
      setError(e.message || 'GitHub login failed');
    }
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.navigate('Landing')} style={styles.backBtn}>
        <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: c.text }]}>Sign In</Text>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: c.errorBg }]}>
          <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          onSubmitEditing={handleLogin}
        />
        <Button onPress={handleLogin} disabled={loading} fullWidth size="lg">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </View>

      <View style={[styles.divider, { borderColor: c.border }]}>
        <Text style={[styles.dividerText, { color: c.textSubtle, backgroundColor: c.bg }]}>or</Text>
      </View>

      <Button onPress={handleGitHub} variant="outline" fullWidth size="lg">
        Continue with GitHub
      </Button>

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={[styles.link, { color: c.accent }]}>Don't have an account? Sign up</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  form: {
    gap: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  dividerText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingHorizontal: spacing.md,
    marginTop: -10,
  },
  link: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
});
