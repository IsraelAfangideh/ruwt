import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { useColors } from '@/theme';
import { spacing } from '@/theme/tokens';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { redirectTo?: string };
  const redirectTo = params.redirectTo ?? 'Dashboard';
  const supabase = createClient();
  const c = useColors();

  const handleEmailLogin = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: redirectTo as never }] });
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    setLoading(true);
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof window !== 'undefined') {
      localStorage.setItem('oauth_redirect', redirectTo);
    }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/callback`,
      },
    });
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Welcome to Ruwt</CardTitle>
          <CardDescription>Sign in to compete in AI-powered coding challenges</CardDescription>
        </CardHeader>
        <CardContent style={styles.content}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: c.errorBg }]}>
              <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.oauthRow}>
            <Button variant="outline" onPress={() => handleOAuth('github')} disabled={loading} fullWidth>GitHub</Button>
          </View>
          <View style={styles.sepWrap}>
            <Separator />
            <Text style={[styles.sepText, { color: c.textMuted }]}>Or continue with email</Text>
          </View>
          <View style={styles.inputWrap}>
            <Label>Email</Label>
            <Input
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>
          <View style={styles.inputWrap}>
            <Label>Password</Label>
            <Input
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>
          <Button onPress={handleEmailLogin} disabled={loading} fullWidth>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </CardContent>
        <CardFooter>
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            Don't have an account?{' '}
            <Text style={{ color: c.accent }} onPress={() => navigation.navigate('Register' as never)}>Sign up</Text>
          </Text>
        </CardFooter>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, minHeight: '100%' },
  card: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  content: { gap: spacing.md },
  errorBox: { padding: spacing.sm, borderRadius: 8 },
  errorText: { fontSize: 14 },
  oauthRow: { flexDirection: 'row', gap: spacing.sm },
  sepWrap: { marginVertical: spacing.xs },
  sepText: { fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  inputWrap: { gap: spacing.xs },
  footerText: { fontSize: 14 },
});
