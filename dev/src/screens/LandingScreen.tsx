import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
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
        </View>
        <Button variant="outline" size="lg" onPress={() => {
          // Navigate to guest arena with a curated starter challenge
          // Uses first available challenge as fallback; real onboarding challenge can be set later
          (navigation.navigate as any)('GuestArena', { challengeId: 'onboarding-fizzbuzz' });
        }}>Try a Challenge — No Sign Up</Button>
        <Pressable onPress={() => navigation.navigate('Teams' as never)} style={styles.hiringLink}>
          <Text style={[styles.hiringLinkText, { color: c.textMuted }]}>
            Hiring manager? See how we assess AI skills {'\u2192'}
          </Text>
        </Pressable>
      </View>

      {/* Daily Challenge CTA */}
      <View style={[styles.section, { paddingBottom: 0 }]}>
        <Card style={[styles.tryChallengeCard, { backgroundColor: c.muted + '30' }]}>
          <CardHeader>
            <Badge variant="default">Daily Challenge</Badge>
            <CardTitle>Today's Challenge</CardTitle>
            <CardDescription>
              A new challenge every day. Compete against other developers for the lowest AI cost. Share your results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Register' as never)}
            >
              See Today's Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* Live platform stats */}
      <View style={styles.section}>
        <PlatformStats />
      </View>

      {/* Try a Challenge CTA */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <Card style={[styles.tryChallengeCard, { borderColor: '#f59e0b', borderWidth: 1, borderLeftWidth: 4 }]}>
          <CardHeader>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <Badge variant="default">Real-World</Badge>
              <Badge variant="outline">TICKET-2847</Badge>
            </View>
            <CardTitle>Fix the Connection Pool Race Condition</CardTitle>
            <CardDescription>
              A Jira-style engineering ticket. Debug a real race condition — but can you do it cheaply with the right AI model?
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
            { step: '\u{1F41B}', title: 'Iterative Debugging', desc: 'Real engineering tickets. Diagnose and fix bugs cheaply — don\'t burn tokens asking for full rewrites.' },
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
          Watch how top solvers complete challenges for under $0.01. Every replay is public and shareable.
        </Text>
        <FeaturedReplay />
      </View>

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse 60+ challenges across model selection, prompt efficiency, debugging, and multi-model strategy. Choose timed or untimed.' },
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


      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: c.text }]}>Ready to prove your AI skills?</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>Free unlimited practice. 60+ challenges. 8 AI models. No credit card required.</Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Get Started Free</Button>
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
  hiringLink: { marginTop: spacing.md },
  hiringLinkText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
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
