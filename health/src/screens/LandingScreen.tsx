/**
 * Landing page — AI-first messaging with sign-in CTA.
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
          AI-powered nutrition tracking.{'\n'}Just describe your meal. AI handles the rest.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          { icon: '\u2728', title: 'AI Food Logger', desc: 'Say "chicken sandwich with fries" and AI logs it with full nutrition data' },
          { icon: '\uD83D\uDCAC', title: 'AI Nutrition Coach', desc: 'Get personalized advice based on your actual intake, goals, and trends' },
          { icon: '\uD83D\uDCAA', title: 'Smart Workouts', desc: '120+ exercises with AI workout generation. Just tell it what you want' },
          { icon: '\uD83D\uDCC8', title: 'AI Insights', desc: 'Weekly analysis of your nutrition patterns with actionable suggestions' },
        ].map((f, i) => (
          <View key={i} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={[styles.featureTitle, { color: c.text }]}>{f.title}</Text>
            <Text style={[styles.featureDesc, { color: c.textMuted }]}>{f.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.accent }]}>500+</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Foods</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.accent }]}>120+</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Exercises</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statValue, { color: c.accent }]}>AI</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Powered</Text>
        </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
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
