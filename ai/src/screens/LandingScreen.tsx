/**
 * ruwt.ai landing page — frictionless download-first marketing.
 */
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button } from '@/components/ui';
import { PublicLayout } from '@/layout/PublicLayout';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { copyInstallCommand } from '@/lib/marketing/tracking';

export function LandingScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  useVisitorTracking('/');

  const handleDownload = () => {
    void copyInstallCommand('landing').finally(() => {
      navigation.navigate('Download');
    });
  };

  return (
    <PublicLayout active="home">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.kicker, { color: c.accent }]}>AGENT OBSERVATION PLATFORM</Text>
          <Text style={[styles.title, { color: c.text }]}>See what your agents actually do.</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Install the collector in one command. No account required to get started — capture locally,
            sync when you are ready.
          </Text>
          <View style={styles.heroActions}>
            <Button onPress={handleDownload} size="lg">
              Download
            </Button>
            <Button onPress={() => navigation.navigate('Blog')} variant="outline" size="lg">
              Read the blog
            </Button>
          </View>
        </View>

        <View style={styles.features}>
          {[
            {
              title: 'Normalized telemetry',
              desc: 'Cursor, Claude Code, Codex, and custom adapters emit a versioned event schema with redaction built in.',
            },
            {
              title: 'Deterministic insights',
              desc: 'Eight rule-based signals highlight cost spikes, missing tests, sensitive access, and attribution gaps.',
            },
            {
              title: 'Detect-only policies',
              desc: 'Define guardrails for models, agents, and commands. Ruwt records violations — it does not block agents.',
            },
            {
              title: 'Organization workspaces',
              desc: 'When you want shared dashboards, isolate data and ingestion keys per team. Optional, not required to download.',
            },
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

        <View style={[styles.helpCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.helpTitle, { color: c.text }]}>Need help getting started?</Text>
          <Text style={[styles.helpDesc, { color: c.textMuted }]}>
            Run the install script, then use <Text style={{ fontFamily: fontFamily.mono }}>npm run cli -- doctor</Text>{' '}
            to verify your setup. Add an ingestion key later when you want to sync to a workspace.
          </Text>
          <Pressable onPress={() => navigation.navigate('Download')}>
            <Text style={[styles.helpLink, { color: c.accent }]}>View install steps →</Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: c.textSubtle }]}>
          No account required to download ·{' '}
          <Text style={{ color: c.accent }} onPress={() => navigation.navigate('Login')}>
            Sign in
          </Text>{' '}
          only if you have a workspace
        </Text>
      </ScrollView>
    </PublicLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    gap: spacing.xl,
  },
  hero: { gap: spacing.md, alignItems: 'flex-start' },
  kicker: { fontFamily: fontFamily.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontFamily: fontFamily.display, fontSize: 46, lineHeight: 50, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, lineHeight: 24, maxWidth: 620 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
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
  helpCard: { padding: spacing.lg, borderWidth: 1, borderRadius: radii.md, gap: spacing.sm },
  helpTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  helpDesc: { fontSize: fontSizes.sm, lineHeight: 21 },
  helpLink: { fontSize: fontSizes.sm, fontWeight: '700', marginTop: spacing.xs },
  footer: { fontSize: fontSizes.sm, textAlign: 'center' },
});
