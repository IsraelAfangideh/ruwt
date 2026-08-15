import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button } from '@/components/ui';
import { PublicLayout } from '@/layout/PublicLayout';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { copyInstallCommand, detectPlatform, trackDownload } from '@/lib/marketing/tracking';

const INSTALL_COMMAND = 'curl -fsSL https://ruwt.ai/install.sh | bash';
const REPO_URL = 'https://github.com/IsraelAfangideh/ruwt/tree/main/desktop';

export function DownloadScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [copied, setCopied] = useState(false);
  const platform = detectPlatform();
  useVisitorTracking('/download');

  const handleCopy = async () => {
    const command = await copyInstallCommand('download-page');
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(command);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenRepo = async () => {
    await trackDownload('download-page', platform);
    await Linking.openURL(REPO_URL);
  };

  return (
    <PublicLayout active="download">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Download the collector</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          One command installs the CLI locally. No sign-in, no API key required for local capture.
        </Text>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardLabel, { color: c.textMuted }]}>Recommended install</Text>
          <Text style={[styles.command, { color: c.text, backgroundColor: c.bgWarm }]} selectable>
            {INSTALL_COMMAND}
          </Text>
          <View style={styles.actions}>
            <Button onPress={() => void handleCopy()} size="lg">
              {copied ? 'Copied!' : 'Copy install command'}
            </Button>
            <Button onPress={() => void handleOpenRepo()} variant="outline" size="lg">
              View source on GitHub
            </Button>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>After install</Text>
          {[
            'npm run cli -- doctor',
            'npm run cli -- import ./events.json',
            'RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync',
          ].map((step) => (
            <Text key={step} style={[styles.step, { color: c.textMuted, fontFamily: fontFamily.mono }]}>
              {step}
            </Text>
          ))}
          <Text style={[styles.note, { color: c.textSubtle }]}>
            Detected platform: {platform}. Signed desktop app builds are coming soon — the CLI is the supported path today.
          </Text>
        </View>

        <Pressable onPress={() => navigation.navigate('BlogPost', { slug: 'what-is-agentic-observability' })}>
          <Text style={[styles.blogLink, { color: c.accent }]}>
            New to agent observability? Start with our primer →
          </Text>
        </Pressable>
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
    gap: spacing.lg,
  },
  title: { fontFamily: fontFamily.display, fontSize: fontSizes['3xl'], fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, lineHeight: 24 },
  card: { padding: spacing.lg, borderWidth: 1, borderRadius: radii.md, gap: spacing.md },
  cardLabel: { fontSize: fontSizes.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  command: {
    fontFamily: fontFamily.mono,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  step: { fontSize: fontSizes.sm, lineHeight: 22 },
  note: { fontSize: fontSizes.sm, lineHeight: 20 },
  blogLink: { fontSize: fontSizes.sm, fontWeight: '700' },
});
