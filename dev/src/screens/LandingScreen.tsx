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

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Pick a Challenge', desc: 'Browse 30 challenges across model selection, prompt efficiency, and debugging. Choose timed or untimed.' },
            { step: '2', title: 'Solve with AI', desc: 'Use the Arena IDE with real AI models. Switch between Budget ($), Mid ($$), and Premium ($$$) tiers strategically.' },
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
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Create an Assessment', desc: 'Pick from our curated challenge library. Set a time limit. Choose which AI skills to test.' },
            { step: '2', title: 'Invite Candidates', desc: 'Send a unique assessment link. Candidates work through challenges with real AI models.' },
            { step: '3', title: 'Review Results', desc: 'See exactly how each candidate used AI — which models, how many tokens, total cost, and pass rate.' },
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

      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Pricing</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Free for developers. Simple per-assessment pricing for teams.
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
                50,000 free AI credits on signup. Practice challenges across all categories. Build your efficiency score.
              </Text>
            </CardContent>
          </Card>
          <Card style={[styles.tierCard, { borderColor: c.accent, borderWidth: 2 }]}>
            <CardHeader>
              <Badge variant="default">Team</Badge>
              <CardTitle>Assessment Packs</CardTitle>
              <CardDescription>From $99 / 10 assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <Text style={[styles.tierBody, { color: c.textMuted }]}>
                Create custom assessments. Invite unlimited candidates. Full results dashboard with candidate comparison.
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
                Custom challenge libraries. SSO integration. Dedicated support. Volume pricing.
              </Text>
            </CardContent>
          </Card>
        </View>
      </View>

      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, { color: c.text }]}>Ready to prove your AI skills?</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>50,000 free credits. 30 challenges. No credit card required.</Text>
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
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', maxWidth: 900, alignSelf: 'center' },
  tierCard: { flex: 1, minWidth: 240 },
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
