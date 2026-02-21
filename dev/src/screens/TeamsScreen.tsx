/**
 * TeamsScreen: Hiring-focused landing page with pricing + demo capture.
 * Route: /teams
 */
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ASSESSMENT_PACKS } from '@/lib/stripe';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function TeamsScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', email: '', company: '', teamSize: '', message: '' });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const handleBuyPack = async (packId: string) => {
    setCheckoutLoading(packId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: packId, type: 'assessment' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'Unauthorized') {
        navigation.navigate('Register' as never);
      }
    } catch {}
    setCheckoutLoading(null);
  };

  const handleDemoSubmit = async () => {
    setDemoSubmitting(true);
    setDemoError(null);
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoForm),
      });
      if (res.ok) {
        setDemoSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setDemoError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setDemoError('Something went wrong. Please try again.');
    }
    setDemoSubmitting(false);
  };

  const scrollToDemo = () => {
    setShowDemoForm(true);
  };

  const canSubmitDemo = demoForm.name && demoForm.email && demoForm.company;

  const DemoFormSection = () => {
    if (demoSubmitted) {
      return (
        <Card style={[styles.demoCard, { borderColor: c.accent }]}>
          <CardContent style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Text style={[styles.demoSuccessTitle, { color: c.text }]}>We'll be in touch!</Text>
            <Text style={[styles.demoSuccessSub, { color: c.textMuted }]}>
              Check your email for a confirmation. We'll reach out within 24 hours.
            </Text>
          </CardContent>
        </Card>
      );
    }

    if (!showDemoForm) {
      return (
        <Button size="lg" variant="outline" onPress={scrollToDemo}>Book a Demo</Button>
      );
    }

    return (
      <Card style={[styles.demoCard, { borderColor: c.border }]}>
        <CardHeader>
          <CardTitle>Book a Demo</CardTitle>
          <CardDescription>We'll walk you through the platform and help you set up your first assessment.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.demoFormFields}>
            <Input
              label="Name"
              placeholder="Jane Smith"
              value={demoForm.name}
              onChangeText={(v) => setDemoForm((f) => ({ ...f, name: v }))}
            />
            <Input
              label="Work Email"
              placeholder="jane@company.com"
              value={demoForm.email}
              onChangeText={(v) => setDemoForm((f) => ({ ...f, email: v }))}
              keyboardType="email-address"
            />
            <Input
              label="Company"
              placeholder="Acme Corp"
              value={demoForm.company}
              onChangeText={(v) => setDemoForm((f) => ({ ...f, company: v }))}
            />
            <Input
              label="Team Size (optional)"
              placeholder="e.g. 5-10 engineers"
              value={demoForm.teamSize}
              onChangeText={(v) => setDemoForm((f) => ({ ...f, teamSize: v }))}
            />
            <Input
              label="Message (optional)"
              placeholder="Tell us about your hiring needs..."
              value={demoForm.message}
              onChangeText={(v) => setDemoForm((f) => ({ ...f, message: v }))}
            />
          </View>
          {demoError && (
            <Text style={[styles.demoError, { color: c.destructive }]}>{demoError}</Text>
          )}
          <Button
            onPress={handleDemoSubmit}
            disabled={demoSubmitting || !canSubmitDemo}
            fullWidth
          >
            {demoSubmitting ? 'Sending...' : 'Request Demo'}
          </Button>
        </CardContent>
      </Card>
    );
  };

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
          <DemoFormSection />
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
            { title: 'Server-Tracked', desc: 'All AI calls are logged server-side with tamper-proof cost and token accounting.' },
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
            const isEnterprise = pack.priceInCents === 0;
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
                  <Button
                    variant={isPopular ? 'default' : 'outline'}
                    onPress={() => {
                      if (isEnterprise) {
                        setShowDemoForm(true);
                      } else {
                        handleBuyPack(pack.id);
                      }
                    }}
                    disabled={checkoutLoading === pack.id}
                    style={{ marginTop: spacing.md }}
                    fullWidth
                  >
                    {checkoutLoading === pack.id
                      ? 'Loading...'
                      : isEnterprise
                        ? 'Contact Us'
                        : `Buy ${pack.label}`}
                  </Button>
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
        <View style={styles.ctaButtons}>
          <Button size="lg" onPress={() => navigation.navigate('Register' as never)}>Start Free Assessment</Button>
          {!demoSubmitted && !showDemoForm && (
            <Button size="lg" variant="outline" onPress={scrollToDemo}>Book a Demo</Button>
          )}
          {demoSubmitted && (
            <Badge variant="default">
              <Text style={{ color: '#fff', fontSize: fontSizes.sm }}>Demo requested!</Text>
            </Badge>
          )}
        </View>
      </View>

      {/* Bottom demo form (shown when scrollToDemo is triggered from bottom CTA) */}
      {showDemoForm && !demoSubmitted && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, maxWidth: 500, alignSelf: 'center', width: '100%' }}>
          <DemoFormSection />
        </View>
      )}

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
  heroButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', alignItems: 'flex-start' },
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
  ctaButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', alignItems: 'center' },
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
  demoCard: { maxWidth: 480, width: '100%', borderWidth: 1 },
  demoFormFields: { gap: spacing.sm, marginBottom: spacing.md },
  demoError: { fontSize: fontSizes.sm, marginBottom: spacing.sm },
  demoSuccessTitle: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.xs },
  demoSuccessSub: { fontSize: fontSizes.sm, textAlign: 'center' },
});
