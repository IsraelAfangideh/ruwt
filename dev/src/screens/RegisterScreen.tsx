import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { useColors } from '@/theme';
import { spacing } from '@/theme/tokens';

export function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigation = useNavigation();
  const supabase = createClient();
  const c = useColors();

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
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>We've sent you a confirmation link to {email}</CardDescription>
          </CardHeader>
          <CardContent>
            <Text style={[styles.muted, { color: c.textMuted }]}>
              Click the link in your email to complete your registration and start competing.
            </Text>
            <Button variant="outline" onPress={() => navigation.navigate('Login' as never)} style={{ marginTop: spacing.md }}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Join Ruwt and compete in AI-powered coding challenges</CardDescription>
        </CardHeader>
        <CardContent style={styles.content}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: c.errorBg }]}>
              <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.oauthRow}>
            <Button variant="outline" onPress={() => handleOAuth('github')} disabled={loading}>GitHub</Button>
            <Button variant="outline" onPress={() => handleOAuth('google')} disabled={loading}>Google</Button>
          </View>
          <View style={styles.sepWrap}>
            <Separator />
            <Text style={[styles.sepText, { color: c.textMuted }]}>Or continue with email</Text>
          </View>
          <View style={styles.inputWrap}>
            <Label>Name</Label>
            <Input placeholder="Your name" value={name} onChangeText={setName} editable={!loading} />
          </View>
          <View style={styles.inputWrap}>
            <Label>Email</Label>
            <Input placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
          </View>
          <View style={styles.inputWrap}>
            <Label>Password</Label>
            <Input placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
            <Text style={[styles.hint, { color: c.textMuted }]}>Must be at least 6 characters</Text>
          </View>
          <Button onPress={handleRegister} disabled={loading} fullWidth>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </CardContent>
        <CardFooter>
          <Text style={[styles.footerText, { color: c.textMuted }]}>
            Already have an account?{' '}
            <Text style={{ color: c.accent }} onPress={() => navigation.navigate('Login' as never)}>Sign in</Text>
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
  hint: { fontSize: 12 },
  footerText: { fontSize: 14 },
  muted: { marginBottom: spacing.sm },
});
