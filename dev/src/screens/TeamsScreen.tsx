/**
 * TeamsScreen: Hiring-focused landing page with pricing, social proof,
 * comparison table, FAQ, and demo capture.
 * Route: /teams
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ASSESSMENT_PACKS } from '@/lib/stripe';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

// ─── FAQ Data ────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'How is this different from a take-home?',
    a: 'Take-homes measure whether a candidate can solve a problem — but not how they got there. Ruwt tracks every AI interaction: which models they chose, how they prompted, what they spent, and how they debugged. You get a complete picture of their AI fluency, not just a correct answer.',
  },
  {
    q: 'What if a candidate has never used AI for coding?',
    a: "That's valuable data too. The assessment reveals who can leverage AI effectively and who can't — which is exactly the signal you're hiring for. Candidates get access to real AI models and a clean editor, so the experience is straightforward even for first-timers.",
  },
  {
    q: 'Can candidates cheat?',
    a: 'Every AI call is logged server-side with tamper-proof cost and token accounting. Candidates use real models through our platform — they can\'t swap in their own API keys or use external tools without it being visible. The replay shows every keystroke and every prompt.',
  },
  {
    q: 'How long does an assessment take?',
    a: 'You set the time limit when creating the assessment. Most teams use 60-90 minutes for 5 challenges. Candidates see a countdown timer and can manage their time across challenges.',
  },
  {
    q: 'What models do candidates have access to?',
    a: 'Eight open-source models across five price tiers — from micro ($0.01/1M tokens) to reasoning ($0.50+/1M tokens). Part of the assessment is choosing the right model for each problem. Choosing a $0.50 model for a simple string formatter is a signal.',
  },
  {
    q: 'Can I customize the challenges?',
    a: 'Yes. Choose from 60+ challenges across categories like Model Selection, Prompt Efficiency, Debugging, and more. Or start from a template (Frontend Developer, Backend Developer, Full Stack, AI Power User) and customize from there.',
  },
  {
    q: 'What data do I get back?',
    a: 'Per-candidate: AI Profile radar chart (5 dimensions), green/red behavioral flags, cost breakdown per challenge, model usage patterns, comparative percentiles vs. other candidates, and full session replays. Export everything to CSV for your ATS.',
  },
  {
    q: 'Is candidate data private?',
    a: 'Candidates only see their own results. Assessment data is only visible to the assessment creator. Shareable results links are opt-in and use unique tokens — candidates control whether to share their results publicly.',
  },
];

// ─── Comparison Data ─────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { label: 'Measures AI usage', ruwt: true, hackerrank: false, codility: false, takehome: false },
  { label: 'Real cost tracking', ruwt: true, hackerrank: false, codility: false, takehome: false },
  { label: 'Model selection strategy', ruwt: true, hackerrank: false, codility: false, takehome: false },
  { label: 'Full session replay', ruwt: true, hackerrank: 'Partial', codility: false, takehome: false },
  { label: 'Behavioral insights', ruwt: true, hackerrank: false, codility: false, takehome: false },
  { label: 'Setup time', ruwt: '5 min', hackerrank: '30 min', codility: '30 min', takehome: '2+ hrs' },
  { label: 'Pricing', ruwt: 'Per assessment', hackerrank: 'Per month', codility: 'Per month', takehome: 'Free' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function TeamsScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) setIsLoggedIn(true);
    });
  }, []);

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
        <Button size="lg" variant="outline" onPress={() => setShowDemoForm(true)}>Book a Demo</Button>
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
            <Input label="Name" placeholder="Jane Smith" value={demoForm.name} onChangeText={(v) => setDemoForm((f) => ({ ...f, name: v }))} />
            <Input label="Work Email" placeholder="jane@company.com" value={demoForm.email} onChangeText={(v) => setDemoForm((f) => ({ ...f, email: v }))} keyboardType="email-address" />
            <Input label="Company" placeholder="Acme Corp" value={demoForm.company} onChangeText={(v) => setDemoForm((f) => ({ ...f, company: v }))} />
            <Input label="Team Size (optional)" placeholder="e.g. 5-10 engineers" value={demoForm.teamSize} onChangeText={(v) => setDemoForm((f) => ({ ...f, teamSize: v }))} />
            <Input label="Message (optional)" placeholder="Tell us about your hiring needs..." value={demoForm.message} onChangeText={(v) => setDemoForm((f) => ({ ...f, message: v }))} />
          </View>
          {demoError && (
            <Text style={[styles.demoError, { color: c.destructive }]}>{demoError}</Text>
          )}
          <Button onPress={handleDemoSubmit} disabled={demoSubmitting || !canSubmitDemo} fullWidth>
            {demoSubmitting ? 'Sending...' : 'Request Demo'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderCheckOrX = (val: boolean | string) => {
    if (val === true) return <Text style={{ color: c.success, fontSize: fontSizes.md, fontWeight: '700' }}>{'\u2713'}</Text>;
    if (val === false) return <Text style={{ color: c.textMuted, fontSize: fontSizes.md }}>{'\u2014'}</Text>;
    return <Text style={{ color: c.text, fontSize: fontSizes.xs }}>{val}</Text>;
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => navigation.navigate('Landing' as never)}>
          <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        </Pressable>
        <View style={styles.headerActions}>
          {isLoggedIn ? (
            <Button onPress={() => navigation.navigate('Dashboard' as never)}>Dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" onPress={() => navigation.navigate('Login' as never)}>Sign in</Button>
              <Button onPress={() => navigation.navigate('Register' as never)}>Get Started</Button>
            </>
          )}
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

      {/* Social Proof */}
      <View style={[styles.section, { backgroundColor: c.muted + '15' }]}>
        <View style={styles.socialProofGrid}>
          {[
            {
              quote: 'We replaced our take-home assignment with Ruwt assessments. The data we get back is on another level — we can see exactly how candidates think about AI cost vs. quality tradeoffs.',
              attribution: 'Engineering Director, Series B Startup',
            },
            {
              quote: "The session replay alone is worth it. Instead of a 45-minute live coding interview, we watch a 5-minute highlight reel of how the candidate actually works with AI.",
              attribution: 'VP of Engineering',
            },
            {
              quote: "Finally, a way to objectively compare how engineers use AI. No more guessing who's actually good at prompting vs. who just talks a good game.",
              attribution: 'Staff Engineer & Hiring Manager',
            },
          ].map((t, i) => (
            <Card key={i} style={styles.testimonialCard}>
              <CardContent>
                <Text style={[styles.quoteText, { color: c.text }]}>"{t.quote}"</Text>
                <Text style={[styles.attribution, { color: c.textMuted }]}>{'\u2014'} {t.attribution}</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>

      {/* ROI Banner */}
      <View style={[styles.roiBanner, { borderColor: c.accent + '40' }]}>
        <Text style={[styles.roiText, { color: c.text }]}>
          Replace your take-home with <Text style={{ color: c.accent, fontWeight: '700' }}>1 Ruwt assessment</Text>.
        </Text>
        <View style={styles.roiStats}>
          <View style={styles.roiStat}>
            <Text style={[styles.roiStatValue, { color: c.accent }]}>5 min</Text>
            <Text style={[styles.roiStatLabel, { color: c.textMuted }]}>Setup time</Text>
          </View>
          <View style={styles.roiStat}>
            <Text style={[styles.roiStatValue, { color: c.accent }]}>60 min</Text>
            <Text style={[styles.roiStatLabel, { color: c.textMuted }]}>Candidate time</Text>
          </View>
          <View style={styles.roiStat}>
            <Text style={[styles.roiStatValue, { color: c.accent }]}>5 axes</Text>
            <Text style={[styles.roiStatLabel, { color: c.textMuted }]}>AI profile data</Text>
          </View>
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

      {/* 3-step flow */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Steps to Better Hiring</Text>
        <View style={styles.cards}>
          {[
            { step: '1', title: 'Create an Assessment', desc: 'Choose from 4 pre-built templates or pick from 60+ challenges. Set time limits and add your company branding. Test the AI skills you care about.' },
            { step: '2', title: 'Invite Candidates', desc: 'Send a unique assessment link. Candidates work through challenges with real AI models — no simulations, no toy environments. Your brand, our platform.' },
            { step: '3', title: 'Review Results', desc: 'Get behavioral insights, AI profile radar charts, green/red flags, and candidate comparisons. Watch full session replays. Export to CSV for your ATS.' },
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

      {/* Results Preview Mockup */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>What You'll See</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Every candidate gets an AI Profile — a radar chart showing their strengths and weaknesses across five dimensions, plus behavioral flags that surface what metrics alone can't.
        </Text>
        <Card style={[styles.previewCard, { borderColor: c.accent + '40' }]}>
          <CardContent>
            <View style={styles.previewRow}>
              <View style={styles.previewLeft}>
                <Text style={[styles.previewTitle, { color: c.text }]}>Jane Smith</Text>
                <Text style={[styles.previewSub, { color: c.textMuted }]}>Passed 5/5 challenges</Text>
                <View style={styles.previewFlags}>
                  <Badge variant="outline" style={{ borderColor: '#5a8a5a', backgroundColor: 'rgba(90,138,90,0.1)' }}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a' }}>Strategic model switching</Text>
                  </Badge>
                  <Badge variant="outline" style={{ borderColor: '#5a8a5a', backgroundColor: 'rgba(90,138,90,0.1)' }}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a' }}>Targeted prompting</Text>
                  </Badge>
                  <Badge variant="outline" style={{ borderColor: '#5a8a5a', backgroundColor: 'rgba(90,138,90,0.1)' }}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a' }}>Error recovery</Text>
                  </Badge>
                </View>
                <View style={styles.previewMetrics}>
                  <View style={styles.previewMetric}>
                    <Text style={[styles.previewMetricValue, { color: c.accent }]}>$0.28</Text>
                    <Text style={[styles.previewMetricLabel, { color: c.textMuted }]}>Total cost</Text>
                  </View>
                  <View style={styles.previewMetric}>
                    <Text style={[styles.previewMetricValue, { color: c.text }]}>3,200</Text>
                    <Text style={[styles.previewMetricLabel, { color: c.textMuted }]}>Tokens</Text>
                  </View>
                  <View style={styles.previewMetric}>
                    <Text style={[styles.previewMetricValue, { color: c.text }]}>42m</Text>
                    <Text style={[styles.previewMetricLabel, { color: c.textMuted }]}>Duration</Text>
                  </View>
                </View>
              </View>
              <View style={styles.previewRight}>
                <Text style={[styles.previewInsight, { color: c.textMuted }]}>
                  "Started with Llama 8B for easy challenges, escalated to DeepSeek R1 for the hard debugging task. Caught an incorrect AI suggestion and corrected it manually. Averaged 2.3 prompts per challenge."
                </Text>
                <View style={[styles.previewBar, { backgroundColor: c.muted + '30' }]}>
                  <View style={[styles.previewBarFill, { backgroundColor: c.success, width: '72%' }]} />
                  <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, marginTop: 4 }}>Cost: P72 — 40% cheaper than median</Text>
                </View>
              </View>
            </View>
          </CardContent>
        </Card>
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

      {/* Comparison Table */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How Ruwt Compares</Text>
        <Card style={[styles.comparisonTable, { borderColor: c.border }]}>
          <CardContent>
            {/* Table header */}
            <View style={[styles.compRow, styles.compHeaderRow, { borderBottomColor: c.border }]}>
              <View style={styles.compLabel} />
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.accent }]}>Ruwt</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>HackerRank</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>Codility</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>Take-Home</Text></View>
            </View>
            {COMPARISON_ROWS.map((row, i) => (
              <View key={i} style={[styles.compRow, i < COMPARISON_ROWS.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                <View style={styles.compLabel}>
                  <Text style={[styles.compLabelText, { color: c.text }]}>{row.label}</Text>
                </View>
                <View style={styles.compCell}>{renderCheckOrX(row.ruwt)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.hackerrank)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.codility)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.takehome)}</View>
              </View>
            ))}
          </CardContent>
        </Card>
      </View>

      {/* FAQ */}
      <View style={[styles.section, { backgroundColor: c.muted + '15' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Frequently Asked Questions</Text>
        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item, i) => (
            <Pressable key={i} onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}>
              <Card style={[styles.faqCard, expandedFaq === i && { borderColor: c.accent }]}>
                <CardContent>
                  <View style={styles.faqHeader}>
                    <Text style={[styles.faqQuestion, { color: c.text }]}>{item.q}</Text>
                    <Text style={{ color: c.textMuted, fontSize: fontSizes.lg }}>
                      {expandedFaq === i ? '\u2212' : '+'}
                    </Text>
                  </View>
                  {expandedFaq === i && (
                    <Text style={[styles.faqAnswer, { color: c.textMuted }]}>{item.a}</Text>
                  )}
                </CardContent>
              </Card>
            </Pressable>
          ))}
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
            <Button size="lg" variant="outline" onPress={() => setShowDemoForm(true)}>Book a Demo</Button>
          )}
          {demoSubmitted && (
            <Badge variant="default">
              <Text style={{ color: '#fff', fontSize: fontSizes.sm }}>Demo requested!</Text>
            </Badge>
          )}
        </View>
      </View>

      {/* Bottom demo form */}
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
    maxWidth: 600,
    alignSelf: 'center',
    fontFamily: fontFamily.body,
    fontSize: fontSizes.md,
  },
  // Social proof
  socialProofGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  testimonialCard: { flex: 1, minWidth: 280 },
  quoteText: { fontSize: fontSizes.sm, fontStyle: 'italic', lineHeight: 22, fontFamily: fontFamily.body, marginBottom: spacing.sm },
  attribution: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  // ROI banner
  roiBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  roiText: {
    fontSize: fontSizes.xl,
    textAlign: 'center',
    fontFamily: fontFamily.body,
    marginBottom: spacing.lg,
  },
  roiStats: {
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  roiStat: { alignItems: 'center' },
  roiStatValue: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body },
  roiStatLabel: { fontSize: fontSizes.xs, marginTop: 2 },
  // Pricing
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', maxWidth: 1100, alignSelf: 'center' },
  tierCard: { flex: 1, minWidth: 220 },
  featureItem: { fontSize: fontSizes.sm, marginBottom: spacing.xs },
  // Steps
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  card: { flex: 1, minWidth: 260 },
  stepNum: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepText: { fontSize: fontSizes.xl, fontWeight: '700' },
  // Trust
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
  },
  trustCard: { flex: 1, minWidth: 200 },
  // Results preview mockup
  previewCard: { maxWidth: 800, alignSelf: 'center', width: '100%', borderWidth: 1 },
  previewRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  previewLeft: { flex: 1, minWidth: 200 },
  previewRight: { flex: 1, minWidth: 260 },
  previewTitle: { fontSize: fontSizes.lg, fontWeight: '700', fontFamily: fontFamily.body },
  previewSub: { fontSize: fontSizes.sm, marginBottom: spacing.sm },
  previewFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  previewMetrics: { flexDirection: 'row', gap: spacing.lg },
  previewMetric: { alignItems: 'center' },
  previewMetricValue: { fontSize: fontSizes.lg, fontWeight: '700' },
  previewMetricLabel: { fontSize: fontSizes.xs, marginTop: 2 },
  previewInsight: { fontSize: fontSizes.sm, fontStyle: 'italic', lineHeight: 20, fontFamily: fontFamily.body, marginBottom: spacing.md },
  previewBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  previewBarFill: { height: '100%', borderRadius: 4 },
  // Comparison table
  comparisonTable: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  compHeaderRow: { borderBottomWidth: 2 },
  compLabel: { flex: 2 },
  compLabelText: { fontSize: fontSizes.sm, fontWeight: '500' },
  compCell: { flex: 1, alignItems: 'center' },
  compHeader: { fontSize: fontSizes.xs, fontWeight: '700', textTransform: 'uppercase' },
  // FAQ
  faqList: { maxWidth: 700, alignSelf: 'center', width: '100%', gap: spacing.sm },
  faqCard: { borderWidth: 1 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: fontSizes.md, fontWeight: '600', fontFamily: fontFamily.body, flex: 1, marginRight: spacing.md },
  faqAnswer: { fontSize: fontSizes.sm, marginTop: spacing.sm, lineHeight: 22, fontFamily: fontFamily.body },
  // CTA
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
