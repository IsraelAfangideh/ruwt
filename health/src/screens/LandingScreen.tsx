/**
 * Landing page — unauthenticated users see hero + sign-in CTA.
 */
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button } from '@/components/ui';

export function LandingScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: c.text }]}>Ruwt Fit</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Track meals, workouts, and nutrition.{'\n'}Hit your goals, see your progress.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          { icon: '🍽️', title: 'Log Meals', desc: 'Track breakfast, lunch, dinner, and snacks with a 500+ food database' },
          { icon: '💪', title: 'Track Workouts', desc: 'Log strength, cardio, and flexibility exercises with sets and reps' },
          { icon: '📊', title: 'See Progress', desc: 'Calorie rings, macro bars, weight charts, and nutrition trends' },
          { icon: '🎯', title: 'Set Goals', desc: 'Customize calorie and macro targets, track water intake and weight' },
        ].map((f, i) => (
          <View key={i} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={[styles.featureTitle, { color: c.text }]}>{f.title}</Text>
            <Text style={[styles.featureDesc, { color: c.textMuted }]}>{f.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cta}>
        <Button onPress={() => navigation.navigate('Login')} size="lg" fullWidth>
          Sign In
        </Button>
        <Button onPress={() => navigation.navigate('Register')} variant="outline" size="lg" fullWidth>
          Create Account
        </Button>
      </View>

      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Shared accounts with ruwt.dev
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.lg,
    paddingTop: spacing['2xl'],
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    lineHeight: 28,
  },
  features: {
    gap: spacing.md,
  },
  featureCard: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  featureIcon: { fontSize: 28 },
  featureTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  featureDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 22,
  },
  cta: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  footer: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    paddingBottom: spacing['2xl'],
  },
});
