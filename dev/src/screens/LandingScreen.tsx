import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PlatformStats } from '@/components/PlatformStats';
import { FeaturedReplay } from '@/components/FeaturedReplay';
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
        <Badge variant="secondary">Now in Beta</Badge>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          Prove You Can Use AI{'\n'}
          <Text style={{ color: c.accent }}>Better Than Anyone</Text>
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          Solve coding challenges using real AI models. The twist: you're ranked by how efficiently you use them. Pick the right model, craft concise prompts, debug cheaply.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Practice</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>For Hiring Managers</Button>
        </View>
      </View>

      {/* Live platform stats */}
      <View style={styles.section}>
        <PlatformStats />
      </View>

      {/* Try a Challenge CTA */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <Card style={[styles.tryChallengeCard, { borderColor: c.accent, borderWidth: 1 }]}>
          <CardHeader>
            <Badge variant="default">Beginner Friendly</Badge>
            <CardTitle>String Formatter</CardTitle>
            <CardDescription>
              Convert strings to title case. A simple task — but can you solve it using the cheapest AI model?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Register' as never)}
            >
              Try This Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Skills That Matter</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          We measure the AI skills that predict real-world engineering efficiency.
        </Text>
        <View style={styles.cards}>
          {[
            { step: '$', title: 'Model Selection', desc: 'Know when a $0.01 model works and when you need a $0.50 one. Using premium for FizzBuzz is a red flag.' },
            { step: '\u270F', title: 'Prompt Efficiency', desc: 'Get working code in fewer tokens. Concise, structured prompts beat verbose walls of text every time.' },
            { step: '\u{1F41B}', title: 'Iterative Debugging', desc: 'When AI code has bugs, diagnose and fix cheaply. Don\'t burn tokens asking for full rewrites.' },
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

      {/* Featured replay */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>See It In Action</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          How a top solver completed a challenge for under $0.01.
        </Text>
        <FeaturedReplay />
      </View>

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse 50 challenges across model selection, prompt efficiency, debugging, and multi-model strategy. Choose timed or untimed.' },
            { step: '2', title: 'Solve with AI', desc: 'Use the Arena IDE with 8 real AI models across 5 tiers. Switch between Micro, Budget, Mid, Premium, and Reasoning strategically.' },
            { step: '3', title: 'Climb the Leaderboard', desc: 'Submit your solution. You\'re ranked by cost efficiency — solve it correctly with the least spend.' },
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>For Hiring Managers</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          The only assessment that measures how efficiently candidates use AI tools. See real data — not self-reported skills.
        </Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Create an Assessment', desc: 'Choose from 4 pre-built templates or pick from 50 challenges. Set time limits. Test the AI skills you care about.' },
            { step: '2', title: 'Invite Candidates', desc: 'Send a unique assessment link. Candidates work through challenges with real AI models — no simulations.' },
            { step: '3', title: 'Review Results', desc: 'Sort by cost, tokens, or time. Expand rows to see per-challenge model usage. Export to CSV for your ATS.' },
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
        <Text style={[styles.sectionTitle, { color: c.text }]}>Built on Trust</Text>
        <View style={styles.trustGrid}>
          {[
            { title: 'Powered by Cloudflare', desc: 'Enterprise-grade infrastructure. Edge-deployed globally for low latency.' },
            { title: 'Open Source Models', desc: 'No vendor lock-in. All models are open-weight and community-audited.' },
            { title: 'Your Data Stays Private', desc: 'Code runs in sandboxed execution. We never store your solutions beyond the session.' },
            { title: 'Real Leaderboard', desc: 'Rankings are based on actual AI costs — no gamification tricks or vanity metrics.' },
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

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Pricing</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Free for developers. Simple pricing for hiring teams.
        </Text>
        <View style={styles.tiers}>
          <Card style={styles.tierCard}>
            <CardHeader>
              <Badge variant="outline">Free</Badge>
              <CardTitle>Developer Practice</CardTitle>
              <CardDescription>$0 / forever</CardDescription>
            </CardHeader>
            <CardContent>
              <Text style={[styles.tierBody, { color: c.textMuted }]}>
                5,000 free AI credits on signup. All 50 challenges across every category. Public leaderboard ranking.
              </Text>
            </CardContent>
          </Card>
          <Card style={styles.tierCard}>
            <CardHeader>
              <Badge variant="outline">Free Trial</Badge>
              <CardTitle>Hiring — Free Trial</CardTitle>
              <CardDescription>$0 / month</CardDescription>
            </CardHeader>
            <CardContent>
              <Text style={[styles.tierBody, { color: c.textMuted }]}>
                1 assessment, 3 challenges, 5 candidates. Full results dashboard with model usage analytics.
              </Text>
            </CardContent>
          </Card>
          <Card style={[styles.tierCard, { borderColor: c.accent, borderWidth: 2 }]}>
            <CardHeader>
              <Badge variant="default">Pro</Badge>
              <CardTitle>Hiring — Pro</CardTitle>
              <CardDescription>$49 / month</CardDescription>
            </CardHeader>
            <CardContent>
              <Text style={[styles.tierBody, { color: c.textMuted }]}>
                Unlimited assessments. All 50 challenges. Up to 50 candidates. Per-candidate AI analytics, comparison, and CSV export.
              </Text>
            </CardContent>
          </Card>
          <Card style={styles.tierCard}>
            <CardHeader>
              <Badge variant="outline">Enterprise</Badge>
              <CardTitle>Custom</CardTitle>
              <CardDescription>Contact us</CardDescription>
            </CardHeader>
            <CardContent>
              <Text style={[styles.tierBody, { color: c.textMuted }]}>
                Custom challenge libraries. API access. SSO integration. Dedicated support. Volume pricing.
              </Text>
            </CardContent>
          </Card>
        </View>
      </View>

      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: c.text }]}>Ready to prove your AI skills?</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>5,000 free credits. 50 challenges. 8 AI models. No credit card required.</Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Get Started Free</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>Book a Demo</Button>
        </View>
      </View>

      {/* Hiring CTA */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.accent + '08' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Stop Guessing. Start Measuring.</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Traditional coding tests don't measure AI fluency. Ruwt shows you exactly how candidates use AI — which models they pick, how they prompt, and what they spend. Real data for real hiring decisions.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Assessment</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>Book a Demo</Button>
        </View>
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
  tryChallengeCard: { maxWidth: 500, alignSelf: 'center', width: '100%' },
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
  tierBody: { fontSize: fontSizes.sm },
  cta: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  ctaTitle: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.sm, fontFamily: fontFamily.body, textAlign: 'center' },
  ctaSub: { marginBottom: spacing.lg, fontFamily: fontFamily.body, textAlign: 'center', maxWidth: 500 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: fontSizes.sm },
});
