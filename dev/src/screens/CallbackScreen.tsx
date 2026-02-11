import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { useColors } from '@/theme';

export function CallbackScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const c = useColors();

  const supabase = createClient();

  useEffect(() => {
    const run = async () => {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectTo = urlParams?.get('redirectTo') ?? 'Challenges';
      const code = urlParams?.get('code');

      if (!code) {
        setStatus('error');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setStatus('error');
        return;
      }
      setStatus('ok');
      navigation.reset({ index: 0, routes: [{ name: redirectTo as never }] });
    };
    run();
  }, [navigation]);

  if (status === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.text, { color: c.text }]}>Authentication failed. Please try again.</Text>
        <Text style={[styles.link, { color: c.accent }]} onPress={() => navigation.navigate('Login' as never)}>Back to Login</Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={[styles.text, { color: c.textMuted }]}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { marginTop: 16 },
  link: { marginTop: 8 },
});
