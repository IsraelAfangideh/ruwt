import { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/shared/lib/supabase/client';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { FeaturedReplay } from '@/shared/social/FeaturedReplay';
import { ActivityFeed } from '@/shared/social/ActivityFeed';
import { PlatformStats } from '@/shared/social/PlatformStats';
/* Discord link removed — social features are built in-site */
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { useWindowWidth } from '@/shared/hooks/useWindowWidth';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';
import { DEFAULT_AUTH_REDIRECT } from '@/shared/navigation/types';
import { resetNavigation } from '@/shared/navigation/resetNavigation';

export function LandingScreen() {
  useDocumentMeta({ canonicalPath: '/' });
  const navigation = useNavigation();
  const c = useColors();

  // Redirect logged-in users to Assessments
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) resetNavigation(navigation, [{ name: DEFAULT_AUTH_REDIRECT }]);
    });
  }, [navigation]);
  const width = useWindowWidth();
  const isMobile = width < 768;

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      <a className="skip-link" href="#landing-main">Skip to main content</a>
      {/* ─── Nav ─── */}
      <View style={[styles.header, { borderBottomColor: c.border }]} accessibilityRole="banner">
        <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        <View style={styles.headerActions} accessibilityRole="navigation" accessibilityLabel="Main navigation">
          <Button variant="ghost" onPress={() => navigation.navigate('Hiring')} textStyle={{ color: c.accent }}>For Teams</Button>
          <Button variant="ghost" onPress={() => navigation.navigate('Login')}>Sign in</Button>
          <Button onPress={() => navigation.navigate('Register')}>Get Started</Button>
        </View>
      </View>

      {/* ─── Hero ─── */}
      <View nativeID="landing-main" style={[styles.hero, { backgroundColor: '#1a1816' }]} tabIndex={-1}>
        <View style={styles.heroInner}>
          <Badge variant="secondary" style={{ alignSelf: 'center' }}>Now in Beta</Badge>
          <Text style={styles.heroTitle} accessibilityRole="heading">
            Prove You Can Use AI{'\n'}
            <Text style={{ color: '#c9a962' }}>Better Than Anyone</Text>
          </Text>
          <Text style={styles.heroSub}>
            Solve coding challenges using real AI models. The twist:{'\n'}you're ranked by how efficiently you use them.
          </Text>

          {/* Stats row */}
          <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
            {[
              { value: '100+', label: 'Challenges' },
              { value: '15', label: 'AI Models' },
              { value: '5', label: 'Cost Tiers' },
              { value: 'Free', label: 'To Start' },
            ].map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.heroCtas}>
            <Button
              size="lg"
              onPress={() => navigation.navigate('Register')}
              style={{ backgroundColor: '#c9a962' }}
              textStyle={{ color: '#1a1816' }}
            >
              Start Free Practice
            </Button>
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                (navigation.navigate as any)('GuestArena', { challengeId: 'fizzbuzz-budget' });
              }}
              style={{ borderColor: 'rgba(232,228,223,0.25)' }}
              textStyle={{ color: '#f5f3f0' }}
            >
              Try a Challenge — No Sign Up
            </Button>
          </View>

        </View>
      </View>

      {/* ─── Hiring strip — immediately visible ─── */}
      <View style={[styles.hiringStrip, { borderBottomColor: c.border }]}>
        <View style={styles.hiringStripInner}>
          <Text style={[styles.hiringStripText, { color: c.text }]}>
            Hiring engineers?{' '}
            <Text style={{ color: c.accent, fontWeight: '700' }}>
              Assess their AI fluency with real coding challenges.
            </Text>
          </Text>
          <Button
            size="sm"
            variant="outline"
            onPress={() => navigation.navigate('Hiring')}
            style={{ borderColor: c.accent }}
            textStyle={{ color: c.accent }}
          >
            Learn More
          </Button>
        </View>
      </View>

      {/* ─── Arena Preview ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">The Arena IDE</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Monaco editor, AI chat with 15 models, and a built-in terminal — all in your browser.
        </Text>
        <Card style={styles.previewCard}>
          <Image
            source={{ uri: '/arena-preview.png' }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel="Arena IDE showing code editor, AI chat, and terminal"
          />
        </Card>
      </View>

      {/* ─── Daily Challenge CTA ─── */}
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
            <Button variant="outline" onPress={() => navigation.navigate('Register')}>
              See Today's Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* ─── Recent activity (auto-hides when < 3 unique users) ─── */}
      <View style={styles.section}>
        <View style={styles.activityWrap}>
          <ActivityFeed limit={5} heading="Developers are solving challenges right now" />
        </View>
      </View>

      {/* ─── Featured challenge CTA ─── */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <Card style={[styles.tryChallengeCard, { borderColor: c.accent, borderWidth: 1, borderLeftWidth: 4 }]}>
          <CardHeader>
            <Badge variant="default">Real-World</Badge>
            <CardTitle>Fix the Connection Pool Race Condition</CardTitle>
            <CardDescription>
              A Jira-style engineering ticket. Debug a real race condition — but can you do it cheaply with the right AI model?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onPress={() => navigation.navigate('Register')}>
              Try This Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* ─── Three Skills ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">Three Skills That Matter</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          We measure the AI skills that predict real-world engineering efficiency.
        </Text>
        <View style={styles.cards}>
          {[
            {
              icon: '$',
              title: 'Model Selection',
              desc: 'Know when a $0.01 model works and when you need a $0.50 one. Using premium for FizzBuzz is a red flag.',
            },
            {
              icon: '\u270F',
              title: 'Prompt Efficiency',
              desc: 'Get working code in fewer tokens. Concise, structured prompts beat verbose walls of text every time.',
            },
            {
              icon: '\u{1F41B}',
              title: 'Iterative Debugging',
              desc: "Real engineering tickets. Diagnose and fix bugs cheaply — don't burn tokens asking for full rewrites.",
            },
          ].map((item) => (
            <Card key={item.icon} style={styles.card}>
              <CardHeader>
                <View style={[styles.iconCircle, { backgroundColor: c.accentBg }]}>
                  <Text style={[styles.iconText, { color: c.accent }]}>{item.icon}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── Featured replay ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">Watch How Top Solvers Think</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Watch how top solvers complete challenges for under $0.01. Every replay is public and shareable.
        </Text>
        <FeaturedReplay />
      </View>

      {/* ─── How It Works ─── */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse 100+ challenges across model selection, prompt efficiency, debugging, and multi-model strategy. Choose timed or untimed.' },
            { step: '2', title: 'Solve with AI', desc: 'Use the Arena IDE with 15 real AI models across 5 tiers. Switch between Micro, Budget, Mid, Premium, and Reasoning strategically.' },
            { step: '3', title: 'Climb the Leaderboard', desc: "Submit your solution. You're ranked by cost efficiency — solve it correctly with the least spend." },
          ].map((item) => (
            <Card key={item.step} style={styles.card}>
              <CardHeader>
                <View style={[styles.iconCircle, { backgroundColor: c.accentBg }]}>
                  <Text style={[styles.iconText, { color: c.accent }]}>{item.step}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── Trust Signals ─── */}
      <View style={[styles.section, { backgroundColor: c.bg }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">Built on Trust</Text>
        <View style={styles.trustGrid}>
          {[
            { icon: '\u26A1', title: 'Powered by Cloudflare', desc: 'Enterprise-grade infrastructure. Edge-deployed globally for low latency.' },
            { icon: '\u{1F513}', title: 'Open Source Models', desc: 'No vendor lock-in. All models are open-weight and community-audited.' },
            { icon: '\u{1F6E1}', title: 'Your Data Stays Private', desc: 'Code runs in sandboxed execution. We never store your solutions beyond the session.' },
            { icon: '\u{1F3C6}', title: 'Real Leaderboard', desc: 'Rankings are based on actual AI costs — no gamification tricks or vanity metrics.' },
          ].map((item) => (
            <Card key={item.title} style={styles.trustCard}>
              <CardHeader>
                <View style={[styles.trustIconCircle, { backgroundColor: c.accentBg }]}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── Live platform stats ─── */}
      <View style={[styles.section, { backgroundColor: c.bg }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="heading">
          Built by Engineers, for Engineers
        </Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Real challenges. Real AI models. Real costs. Every solve is tracked and ranked.
        </Text>
        <PlatformStats />
      </View>

      {/* ─── Community ─── */}
      <View style={[styles.section, { backgroundColor: c.bg, paddingTop: 0 }]}>
        <Card style={[styles.card, { borderColor: c.accent, borderWidth: 1 }]}>
          <CardHeader>
            <CardTitle>Join the Discussion</CardTitle>
            <CardDescription>Every challenge has its own discussion. Share strategies, compare approaches, and learn from other solvers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onPress={() => navigation.navigate('Problems')}
              style={{ borderColor: c.accent }}
              textStyle={{ color: c.accent }}
            >
              Browse Challenges
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* ─── For Hiring Teams ─── */}
      <View style={[styles.section, { backgroundColor: '#1a1816', paddingVertical: spacing['2xl'] }]}>
        <View style={styles.hiringSection}>
          <Badge variant="secondary" style={{ alignSelf: 'center' }}>For Hiring Teams</Badge>
          <Text style={[styles.hiringSectionTitle, { color: '#f5f3f0' }]}>
            Your Candidates Claim They're AI-Fluent.{'\n'}
            <Text style={{ color: '#c9a962' }}>Now You Can Verify It.</Text>
          </Text>
          <Text style={[styles.hiringSectionSub, { color: '#9a938a' }]}>
            Send candidates the same challenges your developers solve here. Get objective data on their AI efficiency — which models they pick, how they prompt, what they spend.
          </Text>
          <View style={styles.hiringStats}>
            {[
              { value: '5 min', label: 'Setup' },
              { value: '100+', label: 'Challenges' },
              { value: '5-axis', label: 'AI Profile' },
            ].map((s) => (
              <View key={s.label} style={styles.hiringStat}>
                <Text style={{ fontSize: fontSizes.xl, fontWeight: '700', color: '#c9a962', fontFamily: fontFamily.body }}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: '#6b6560', letterSpacing: 1, textTransform: 'uppercase' as any }}>{s.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heroCtas}>
            <Button
              size="lg"
              onPress={() => navigation.navigate('Hiring')}
              style={{ backgroundColor: '#c9a962' }}
              textStyle={{ color: '#1a1816', fontWeight: '700' }}
            >
              Explore Assessments
            </Button>
            <Button
              variant="outline"
              size="lg"
              onPress={() => navigation.navigate('Hiring')}
              style={{ borderColor: 'rgba(232,228,223,0.25)' }}
              textStyle={{ color: '#f5f3f0' }}
            >
              Book a Demo
            </Button>
          </View>
        </View>
      </View>

      {/* ─── Final CTA ─── */}
      <View style={[styles.ctaSection, { backgroundColor: '#1a1816' }]}>
        <Text style={styles.ctaTitle}>Ready to prove your AI skills?</Text>
        <Text style={styles.ctaSub}>
          Free unlimited practice. 100+ challenges. 15 AI models. No credit card required.
        </Text>
        <View style={styles.heroCtas}>
          <Button
            size="lg"
            onPress={() => navigation.navigate('Register')}
            style={{ backgroundColor: '#c9a962' }}
            textStyle={{ color: '#1a1816' }}
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onPress={() => navigation.navigate('Hiring')}
            style={{ borderColor: 'rgba(232,228,223,0.25)' }}
            textStyle={{ color: '#f5f3f0' }}
          >
            Book a Demo
          </Button>
        </View>
      </View>

      {/* ─── Footer ─── */}
      <View style={[styles.footer, { borderTopColor: c.border }]} accessibilityRole="contentinfo">
        <Text style={[styles.footerText, { color: c.textMuted }]}>
          {'\u00A9'} {new Date().getFullYear()} Ruwt. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  /* Nav */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  logo: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  headerActions: { flexDirection: 'row', gap: spacing.md },

  /* Hero */
  hero: {
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.lg,
  },
  heroInner: {
    maxWidth: 800,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    color: '#f5f3f0',
    fontFamily: fontFamily.body,
    lineHeight: 50,
  },
  heroSub: {
    fontSize: fontSizes.lg,
    textAlign: 'center',
    color: '#9a938a',
    fontFamily: fontFamily.body,
    lineHeight: 28,
    maxWidth: 560,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginVertical: spacing.lg,
  },
  statsRowMobile: {
    gap: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    color: '#c9a962',
    fontFamily: fontFamily.body,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: '#9a938a',
    fontFamily: fontFamily.body,
    textTransform: 'uppercase' as any,
    letterSpacing: 1,
  },
  heroCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  hiringStrip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    backgroundColor: 'rgba(201,169,98,0.04)',
  },
  hiringStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    maxWidth: 800,
    alignSelf: 'center',
    flexWrap: 'wrap',
  },
  hiringStripText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  hiringCard: { maxWidth: 600, alignSelf: 'center' as const, width: '100%' as unknown as number },
  hiringSection: {
    maxWidth: 700,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  hiringSectionTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: fontFamily.body,
    lineHeight: 38,
  },
  hiringSectionSub: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    fontFamily: fontFamily.body,
    lineHeight: 24,
    maxWidth: 560,
  },
  hiringStats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginVertical: spacing.sm,
  },
  hiringStat: { alignItems: 'center', gap: 2 },

  /* Sections */
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

  /* Cards */
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  card: { flex: 1, minWidth: 240 },
  previewCard: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    overflow: 'hidden',
    padding: 0,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 8,
  },
  tryChallengeCard: { maxWidth: 500, alignSelf: 'center', width: '100%' },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconText: { fontSize: fontSizes.xl, fontWeight: '700' },

  /* Trust */
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
  },
  trustCard: { flex: 1, minWidth: 200 },
  trustIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  /* Activity */
  activityWrap: { maxWidth: 600, alignSelf: 'center', width: '100%' },

  /* Final CTA */
  ctaSection: {
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    color: '#f5f3f0',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
  ctaSub: {
    color: '#9a938a',
    fontFamily: fontFamily.body,
    textAlign: 'center',
    maxWidth: 500,
    marginBottom: spacing.sm,
  },

  /* Footer */
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: fontSizes.sm },
});
