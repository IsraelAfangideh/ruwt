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
          <Button onPress={() => navigation.navigate('Register' as never)}>For Teams</Button>
        </View>
      </View>

      <View style={styles.hero}>
        <Badge variant="secondary">Now in Beta</Badge>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          AI-Efficiency Assessment{'\n'}
          <Text style={{ color: c.accent }}>for Engineering Teams</Text>
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          Measure how efficiently your candidates use AI to solve real problems. Not just correctness — cost, model selection, and prompt strategy matter.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Practice</Button>
          <Button size="lg" variant="outline" onPress={() => navigation.navigate('Register' as never)}>For Hiring Managers</Button>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>What We Measure</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Three dimensions of AI proficiency that predict real-world engineering efficiency.
        </Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Model Selection', desc: 'Does the candidate know when to use a cheap model vs. a premium one? Using GPT-4o for FizzBuzz is a red flag.' },
            { step: '2', title: 'Prompt Efficiency', desc: 'Can they get working code in fewer tokens? Concise, structured prompts beat verbose ones every time.' },
            { step: '3', title: 'Iterative Debugging', desc: 'When AI output has bugs, can they diagnose and fix cheaply — or do they burn tokens on full rewrites?' },
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
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works for Teams</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Create an Assessment', desc: 'Pick from our curated challenge library. Set a time limit. Choose which AI skills to test.' },
            { step: '2', title: 'Invite Candidates', desc: 'Send a unique assessment link. Candidates log in and work through challenges with real AI models.' },
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How It Works for Developers</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Practice Free', desc: 'Get 100 free AI credits on signup. Solve challenges and learn to use AI models efficiently.' },
            { step: '2', title: 'Take Assessments', desc: 'When a company invites you, complete their assessment. Your AI efficiency is your competitive edge.' },
            { step: '3', title: 'Build Your Score', desc: 'Climb the leaderboard. The best AI-efficient engineers stand out to hiring teams.' },
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
                100 free AI credits on signup. Practice challenges across all categories. Build your efficiency score.
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
        <Text style={[styles.ctaTitle, { color: c.text }]}>Ready to find AI-efficient engineers?</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>Your team spent $40K on API calls last month. Do you know which developers are efficient?</Text>
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
