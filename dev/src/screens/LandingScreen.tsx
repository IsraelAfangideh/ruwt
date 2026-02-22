import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PlatformStats } from '@/components/PlatformStats';
import { FeaturedReplay } from '@/components/FeaturedReplay';
import { ActivityFeed } from '@/components/ActivityFeed';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

export function LandingScreen() {
  useDocumentMeta({ canonicalPath: '/' });
  const navigation = useNavigation();
  const c = useColors();
  const width = useWindowWidth();
  const isMobile = width < 768;

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* ─── Nav ─── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        <View style={styles.headerActions}>
          <Button variant="ghost" onPress={() => navigation.navigate('Login' as never)}>Sign in</Button>
          <Button onPress={() => navigation.navigate('Register' as never)}>Get Started</Button>
        </View>
      </View>

      {/* ─── Hero ─── */}
      <View style={[styles.hero, { backgroundColor: '#1a1816' }]}>
        <View style={styles.heroInner}>
          <Badge variant="secondary" style={{ alignSelf: 'center' }}>Now in Beta</Badge>
          <Text style={styles.heroTitle}>
            Get Better at AI.{'\n'}
            <Text style={{ color: '#c9a962' }}>Get Discovered.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Practice real coding challenges with AI models. Learn from the community.{'\n'}Let your skills speak for themselves.
          </Text>

          {/* Stats row */}
          <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
            {[
              { value: '60+', label: 'Challenges' },
              { value: '8', label: 'AI Models' },
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
              onPress={() => navigation.navigate('Register' as never)}
              style={{ backgroundColor: '#c9a962' }}
              textStyle={{ color: '#1a1816' }}
            >
              Start Free Practice
            </Button>
            <Button
              variant="outline"
              size="lg"
              onPress={() => {
                (navigation.navigate as any)('GuestArena', { challengeId: 'onboarding-fizzbuzz' });
              }}
              style={{ borderColor: 'rgba(232,228,223,0.25)' }}
              textStyle={{ color: '#f5f3f0' }}
            >
              Try a Challenge — No Sign Up
            </Button>
          </View>

          <Pressable onPress={() => navigation.navigate('Teams' as never)} style={styles.hiringLink}>
            <Text style={styles.hiringLinkText}>
              Hiring? Find developers who are great with AI {'\u2192'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Daily Challenge CTA ─── */}
      <View style={[styles.section, { paddingBottom: 0 }]}>
        <Card style={[styles.tryChallengeCard, { backgroundColor: c.muted + '30' }]}>
          <CardHeader>
            <Badge variant="default">Daily Challenge</Badge>
            <CardTitle>Today's Challenge</CardTitle>
            <CardDescription>
              A new challenge every day. Practice alongside other developers. Share your approach and learn from theirs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onPress={() => navigation.navigate('Register' as never)}>
              See Today's Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* ─── Live platform stats ─── */}
      <View style={styles.section}>
        <PlatformStats />
      </View>

      {/* ─── Recent activity ─── */}
      <View style={[styles.section, { paddingTop: 0 }]}>
        <View style={styles.activityWrap}>
          <Text style={[styles.sectionTitle, { color: c.text, fontSize: fontSizes.xl, marginBottom: spacing.md }]}>
            Developers are practicing right now
          </Text>
          <ActivityFeed limit={5} />
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
            <Button variant="outline" onPress={() => navigation.navigate('Register' as never)}>
              Try This Challenge
            </Button>
          </CardContent>
        </Card>
      </View>

      {/* ─── Three Skills ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Skills That Matter</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Practice the AI skills that matter in real-world engineering.
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
        <Text style={[styles.sectionTitle, { color: c.text }]}>Learn From the Community</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Watch how other developers approach challenges. Every replay is public and shareable — learn their strategies.
        </Text>
        <FeaturedReplay />
      </View>

      {/* ─── How It Works ─── */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse 60+ challenges across model selection, prompt efficiency, debugging, and multi-model strategy. Choose timed or untimed.' },
            { step: '2', title: 'Solve with AI', desc: 'Use the Arena IDE with 8 real AI models across 5 tiers. Switch between Micro, Budget, Mid, Premium, and Reasoning strategically.' },
            { step: '3', title: 'See Where You Stand', desc: "Submit your solution. See how your approach compares, learn from others, and let your skills get noticed." },
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
        <Text style={[styles.sectionTitle, { color: c.text }]}>Built on Trust</Text>
        <View style={styles.trustGrid}>
          {[
            { icon: '\u26A1', title: 'Powered by Cloudflare', desc: 'Enterprise-grade infrastructure. Edge-deployed globally for low latency.' },
            { icon: '\u{1F513}', title: 'Open Source Models', desc: 'No vendor lock-in. All models are open-weight and community-audited.' },
            { icon: '\u{1F6E1}', title: 'Your Data Stays Private', desc: 'Code runs in sandboxed execution. We never store your solutions beyond the session.' },
            { icon: '\u{1F3C6}', title: 'Real Leaderboard', desc: 'Rankings based on actual AI costs. See where you stand, learn what works, get noticed.' },
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

      {/* ─── Final CTA ─── */}
      <View style={[styles.ctaSection, { backgroundColor: '#1a1816' }]}>
        <Text style={styles.ctaTitle}>Ready to get better at AI?</Text>
        <Text style={styles.ctaSub}>
          Free practice. 60+ challenges. 8 AI models. Hints when you're stuck. No credit card required.
        </Text>
        <View style={styles.heroCtas}>
          <Button
            size="lg"
            onPress={() => navigation.navigate('Register' as never)}
            style={{ backgroundColor: '#c9a962' }}
            textStyle={{ color: '#1a1816' }}
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onPress={() => navigation.navigate('Teams' as never)}
            style={{ borderColor: 'rgba(232,228,223,0.25)' }}
            textStyle={{ color: '#f5f3f0' }}
          >
            Book a Demo
          </Button>
        </View>
      </View>

      {/* ─── Footer ─── */}
      <View style={[styles.footer, { borderTopColor: c.border }]}>
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
  hiringLink: { marginTop: spacing.xs },
  hiringLinkText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    color: '#9a938a',
  },

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
