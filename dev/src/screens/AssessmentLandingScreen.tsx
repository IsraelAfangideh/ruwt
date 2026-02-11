import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function AssessmentLandingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { token: string };
  const token = params.token ?? '';
  const c = useColors();
  const supabase = createClient();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);

    // Check auth first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Redirect to login with return path
      navigation.navigate('Login' as never);
      return;
    }

    try {
      const res = await fetch('/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start assessment');
        setStarting(false);
        return;
      }

      navigation.navigate('AssessmentFlow', { sessionId: data.session.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStarting(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>Invalid assessment link</Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>

        <Card style={styles.card}>
          <CardHeader>
            <Badge variant="secondary">AI-Efficiency Assessment</Badge>
            <CardTitle style={{ marginTop: spacing.sm }}>You've been invited to take an assessment</CardTitle>
            <CardDescription>
              This assessment measures how efficiently you use AI to solve coding challenges.
              You'll be evaluated on model selection, prompt efficiency, and debugging strategy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textMuted }]}>What to expect:</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>
                  Multiple coding challenges with AI assistance
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textMuted }]}>How it works:</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>
                  You'll use AI models to help solve each challenge. Your cost efficiency matters.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textMuted }]}>Scoring:</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>
                  Solve problems correctly at the lowest AI cost. Choose models strategically.
                </Text>
              </View>
            </View>

            {error && (
              <Text style={[styles.errorText, { color: c.destructive, marginBottom: spacing.md }]}>
                {error}
              </Text>
            )}

            <Button size="lg" onPress={handleStart} disabled={starting} fullWidth>
              {starting ? 'Starting...' : 'Start Assessment'}
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.xl },
  card: { width: '100%' },
  infoRows: { gap: spacing.md, marginBottom: spacing.lg },
  infoRow: { gap: spacing.xs },
  infoLabel: { fontSize: fontSizes.sm, fontWeight: '600' },
  infoValue: { fontSize: fontSizes.sm },
  errorText: { fontSize: fontSizes.sm },
});
