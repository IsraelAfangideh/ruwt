import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export function RegisterScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      });
      if (authError) setError(authError.message);
      else setMessage('Check your email to confirm your account.');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.navigate('Landing')} style={styles.backBtn}>
        <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
      </Pressable>
      <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
      {error ? <View style={[styles.notice, { backgroundColor: c.errorBg }]}><Text style={{ color: c.error }}>{error}</Text></View> : null}
      {message ? <View style={[styles.notice, { backgroundColor: c.successBg }]}><Text style={{ color: c.success }}>{message}</Text></View> : null}
      <View style={styles.form}>
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
        <Button onPress={handleRegister} disabled={loading} fullWidth size="lg">{loading ? 'Creating...' : 'Create Account'}</Button>
      </View>
      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={[styles.link, { color: c.accent }]}>Already have an account? Sign in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { maxWidth: 400, alignSelf: 'center', width: '100%', padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.display },
  notice: { padding: spacing.md, borderRadius: radii.md },
  form: { gap: spacing.md },
  link: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, textAlign: 'center' },
});
