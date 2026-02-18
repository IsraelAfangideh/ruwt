import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { useColors } from '@/theme';

export function CallbackScreen() {
  const navigation = useNavigation();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const c = useColors();
  const handled = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    // Read redirect target from localStorage (set by LoginScreen) or URL param as fallback
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const redirectTo =
      (typeof window !== 'undefined' && localStorage.getItem('oauth_redirect')) ||
      urlParams?.get('redirectTo') ||
      'Dashboard';

    if (typeof window !== 'undefined') {
      localStorage.removeItem('oauth_redirect');
    }

    const navigate = async () => {
      if (handled.current) return;
      handled.current = true;
      setStatus('ok');

      // Check for pending guest challenge
      const pendingChallenge = typeof window !== 'undefined' ? localStorage.getItem('ruwt_pending_challenge') : null;
      if (pendingChallenge) {
        localStorage.removeItem('ruwt_pending_challenge');
        navigation.reset({ index: 0, routes: [{ name: 'Arena' as never, params: { challengeId: pendingChallenge } }] });
        return;
      }

      // Check onboarding status — route new users to Onboarding
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

    // createBrowserClient auto-detects ?code= or #access_token= in the URL
    // and exchanges them for a session. We just listen for the result.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        navigate();
      }
    });

    // Also check if session already exists (auto-exchange may have completed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate();
      }
    });

    // Timeout: if no session after 8s, show error
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
