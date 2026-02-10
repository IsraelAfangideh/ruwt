import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function LandingScreen() {
  const navigation = useNavigation();
  const c = useColors();

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        <View style={styles.headerActions}>
          <Button variant="ghost" onPress={() => navigation.navigate('Login' as never)}>Sign in</Button>
          <Button onPress={() => navigation.navigate('Register' as never)}>Get Started</Button>
        </View>
      </View>

      <View style={styles.hero}>
        <Badge variant="secondary">Beta</Badge>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          AI Coding Competitions{'\n'}
          <Text style={{ color: c.primary }}>Where Cost is King</Text>
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          Solve coding challenges by prompting AI models. The twist? Every token costs real money. Win by producing working code at the lowest financial cost.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Competing</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Leaderboard' as never)}>View Leaderboard</Button>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse coding challenges of varying difficulty. Each has constraints like token limits or time caps.' },
            { step: '2', title: 'Prompt AI Models', desc: 'Choose from budget to premium models. Each token costs real money. Be strategic with your prompts.' },
            { step: '3', title: 'Submit & Compete', desc: 'Your code is tested automatically. If it passes, your cost is recorded on the leaderboard.' },
          ].map((item) => (
            <Card key={item.step} style={styles.card}>
              <CardHeader>
                <View style={[styles.stepNum, { backgroundColor: c.primary + '20' }]}>
                  <Text style={[styles.stepText, { color: c.primary }]}>{item.step}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Choose Your Strategy</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Multiple AI models at different price points. Cheap models are risky but cost-effective. Premium models are reliable but expensive.
        </Text>
        <View style={styles.tiers}>
          {[
            { badge: 'Budget', title: 'Llama 3.1 / Mistral', desc: '$0.01-0.02 per 1M tokens', body: 'Open-source models via Cloudflare. Cheap but may struggle with complex tasks.' },
            { badge: 'Mid Tier', title: 'GPT-4o-mini / Haiku', desc: '$0.15-0.80 per 1M tokens', body: 'Balanced cost and quality. Good for most challenges.', highlight: true },
            { badge: 'Premium', title: 'GPT-4o / Claude Sonnet', desc: '$2.50-15.00 per 1M tokens', body: 'Top-tier reasoning. Expensive but reliable for hard problems.' },
          ].map((t) => (
            <Card key={t.badge} style={[styles.tierCard, t.highlight && { borderColor: c.accent, borderWidth: 2 }]}>
              <CardHeader>
                <Badge variant={t.highlight ? 'default' : 'outline'}>{t.badge}</Badge>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Text style={[styles.tierBody, { color: c.textMuted }]}>{t.body}</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: c.text }]}>Ready to Compete?</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>Join the competition and prove you can code efficiently with AI.</Text>
        <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Create Free Account</Button>
      </View>

      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Text style={[styles.footerText, { color: c.textMuted }]}>© {new Date().getFullYear()} Ruwt. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body },
  headerActions: { flexDirection: 'row', gap: spacing.md },
  hero: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    maxWidth: 800,
    alignSelf: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fontFamily.body,
  },
  heroSub: {
    fontSize: fontSizes.lg,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
  },
  heroButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  section: { padding: spacing.lg, paddingVertical: spacing.xl },
  sectionAlt: { marginHorizontal: 0 },
  sectionTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
  },
  sectionSub: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 560,
    alignSelf: 'center',
    fontFamily: fontFamily.body,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  card: { flex: 1, minWidth: 240 },
  stepNum: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepText: { fontSize: fontSizes.xl, fontWeight: '700' },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', maxWidth: 900, alignSelf: 'center' },
  tierCard: { flex: 1, minWidth: 240 },
  tierBody: { fontSize: fontSizes.sm },
  cta: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  ctaTitle: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.sm, fontFamily: fontFamily.body },
  ctaSub: { marginBottom: spacing.lg, fontFamily: fontFamily.body },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: fontSizes.sm },
});
