/**
 * ruwt.ai landing page — agent observation platform.
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
        <Text style={[styles.kicker, { color: c.accent }]}>AGENT OBSERVATION PLATFORM</Text>
        <Text style={[styles.title, { color: c.text }]}>See what your agents actually do.</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          ruwt.ai connects agent activity to tests, delivery, cost, and policy signals.
          Evidence before opinion — without storing raw prompts or source code.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          { title: 'Normalized telemetry', desc: 'Cursor, Claude Code, Codex, and custom adapters emit a versioned event schema with redaction built in.' },
          { title: 'Deterministic insights', desc: 'Eight rule-based signals highlight cost spikes, missing tests, sensitive access, and attribution gaps.' },
          { title: 'Detect-only policies', desc: 'Define guardrails for models, agents, and commands. Ruwt records violations — it does not block agents.' },
          { title: 'Organization workspaces', desc: 'Isolate data, ingestion keys, and policy records per team. Share dashboards with viewers and admins.' },
        ].map((feature) => (
          <View key={feature.title} style={[styles.featureCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.featureTitle, { color: c.text }]}>{feature.title}</Text>
            <Text style={[styles.featureDesc, { color: c.textMuted }]}>{feature.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsRow}>
        {[
          { value: '18', label: 'Event types' },
          { value: '8', label: 'Insight rules' },
          { value: '0', label: 'Raw prompts stored' },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.statValue, { color: c.accent }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
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
        Shared accounts with ruwt.dev · Desktop collector coming soon
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.lg,
    paddingTop: spacing['2xl'],
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm, alignItems: 'flex-start' },
  kicker: { fontFamily: fontFamily.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: fontFamily.display, fontSize: 46, lineHeight: 50, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, lineHeight: 24, maxWidth: 620 },
  features: { gap: spacing.md },
  featureCard: { padding: spacing.lg, borderWidth: 1, borderRadius: radii.md, gap: spacing.sm },
  featureTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  featureDesc: { fontSize: fontSizes.sm, lineHeight: 21 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    flex: 1,
    minWidth: 120,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: fontFamily.display, fontSize: fontSizes['3xl'], fontWeight: '700' },
  statLabel: { fontSize: fontSizes.xs, fontWeight: '600' },
  cta: { gap: spacing.md },
  footer: { fontSize: fontSizes.sm, textAlign: 'center' },
});
