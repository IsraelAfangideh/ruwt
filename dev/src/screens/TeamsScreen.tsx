/**
 * TeamsScreen: Hiring-focused landing page.
 * Route: /teams
 */
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ASSESSMENT_PACKS } from '@/lib/stripe';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function TeamsScreen() {
  const navigation = useNavigation();
  const c = useColors();

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => navigation.navigate('Landing' as never)}>
          <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Button variant="ghost" onPress={() => navigation.navigate('Login' as never)}>Sign in</Button>
          <Button onPress={() => navigation.navigate('Register' as never)}>Get Started</Button>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Badge variant="secondary">For Hiring Teams</Badge>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          Measure How Your Candidates{'\n'}
          <Text style={{ color: c.accent }}>Actually Use AI</Text>
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          Traditional coding tests don't measure AI fluency. Ruwt gives you real data — which models they pick, how they prompt, what they spend. Objective, comparable, and impossible to fake.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Assessment</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>Book a Demo</Button>
        </View>
      </View>

      {/* 3-step assessment flow */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Steps to Better Hiring</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Create an Assessment', desc: 'Choose from 4 pre-built templates or pick from 60+ challenges. Set time limits. Test the AI skills you care about.' },
            { step: '2', title: 'Invite Candidates', desc: 'Send a unique assessment link. Candidates work through challenges with real AI models — no simulations, no toy environments.' },
            { step: '3', title: 'Review Results', desc: 'Compare candidates by cost efficiency, model strategy, and prompt quality. Export to CSV for your ATS. Watch full replays.' },
          ].map((item) => (
            <Card key={item.step} style={styles.card}>
              <CardHeader>
                <View style={[styles.stepNum, { backgroundColor: c.accent + '20' }]}>
                  <Text style={[styles.stepText, { color: c.accent }]}>{item.step}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* Trust signals */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '20' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Why Teams Choose Ruwt</Text>
        <View style={styles.trustGrid}>
          {[
            { title: 'Real AI, Real Cost', desc: 'Candidates use actual AI APIs with real pricing. No sandboxes. Every decision has a cost.' },
            { title: 'Objective Metrics', desc: 'Compare candidates by total cost, token usage, model selection, and time. No subjective grading.' },
            { title: 'Full Replay', desc: 'Watch every prompt, every model switch, every debugging step. Understand how candidates think.' },
            { title: 'Impossible to Fake', desc: 'Server-tracked AI calls, tamper-proof scoring. Pre-solved challenges detected automatically.' },
          ].map((item) => (
            <Card key={item.title} style={styles.trustCard}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* Pricing */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Simple, Credit-Based Pricing</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Pay per assessment, not per month. No subscriptions. Credits never expire.
        </Text>
        <View style={styles.tiers}>
          {ASSESSMENT_PACKS.map((pack) => {
            const isPopular = pack.badge === 'Popular';
            return (
              <Card key={pack.id} style={[styles.tierCard, isPopular && { borderColor: c.accent, borderWidth: 2 }]}>
                <CardHeader>
                  {pack.badge ? (
                    <Badge variant={isPopular ? 'default' : 'outline'}>{pack.badge}</Badge>
                  ) : (
                    <Badge variant="outline">{pack.assessments ? 'Starter' : 'Custom'}</Badge>
                  )}
                  <CardTitle>{pack.label}</CardTitle>
                  <CardDescription>
                    {pack.priceInCents > 0
                      ? `$${(pack.priceInCents / 100).toFixed(0)}${pack.assessments ? ` ($${((pack.priceInCents / 100) / pack.assessments).toFixed(0)}/each)` : ''}`
                      : 'Contact us'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pack.features.map((f) => (
                    <Text key={f} style={[styles.featureItem, { color: c.textMuted }]}>{'\u2713'} {f}</Text>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </View>
      </View>

      {/* Final CTA */}
      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: c.text }]}>Start Assessing AI Skills Today</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>
          Your first assessment is free. No credit card required.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Assessment</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>Book a Demo</Button>
        </View>
      </View>

      {/* Cross-link */}
      <View style={styles.crossLink}>
        <Pressable onPress={() => navigation.navigate('Landing' as never)}>
          <Text style={[styles.crossLinkText, { color: c.textMuted }]}>
            Developer? Try free challenges {'\u2192'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Text style={[styles.footerText, { color: c.textMuted }]}>{'\u00A9'} {new Date().getFullYear()} Ruwt. All rights reserved.</Text>
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
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
  },
  trustCard: { flex: 1, minWidth: 200 },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', maxWidth: 1100, alignSelf: 'center' },
  tierCard: { flex: 1, minWidth: 220 },
  featureItem: { fontSize: fontSizes.sm, marginBottom: spacing.xs },
  cta: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  ctaTitle: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.sm, fontFamily: fontFamily.body, textAlign: 'center' },
  ctaSub: { marginBottom: spacing.lg, fontFamily: fontFamily.body, textAlign: 'center', maxWidth: 500 },
  crossLink: { alignItems: 'center', paddingBottom: spacing.lg },
  crossLinkText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: fontSizes.sm },
});
