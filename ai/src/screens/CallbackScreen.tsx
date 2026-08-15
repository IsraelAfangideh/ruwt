import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { fontSizes, fontFamily } from '@/theme/tokens';
import { createClient } from '@/lib/supabase/client';

export function CallbackScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        localStorage.removeItem('ruwt-ai-redirect');
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    });
    return () => { subscription.unsubscribe(); };
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.accent} />
      <Text style={[styles.text, { color: c.textMuted }]}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
});
