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
import { SUBSCRIPTION_PLANS, ENTERPRISE_TIER } from '@/lib/stripe';
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
    a: "That's useful signal too. The assessment shows where a candidate is in their AI journey — and where they have room to grow. Candidates get access to real AI models and a clean editor, so the experience is straightforward even for first-timers.",
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
  { label: 'Pricing', ruwt: '$200/mo flat', hackerrank: '$100+/seat/mo', codility: '$100+/seat/mo', takehome: 'Free' },
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

  const handleStartAssessment = async () => {
    if (isLoggedIn) {
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountType: 'team' }),
        });
      } catch {}
      navigation.navigate('AssessmentBuilder' as never);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ruwt_team_intent', '1');
      }
      navigation.navigate('Register' as never);
    }
  };

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', email: '', company: '', teamSize: '', message: '' });
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: planId, type: 'subscription' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'Unauthorized') {
        navigation.navigate('Register' as never);
      } else if (data.error) {
        // e.g. "Create an organization first"
        alert(data.error);
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
          Find Developers Who Are{'\n'}
          <Text style={{ color: c.accent }}>Great With AI</Text>
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          Thousands of developers practice AI-assisted coding on Ruwt every day. See how they solve real problems — which models they pick, how they prompt, what they spend. Hire from a community of proven skill.
        </Text>
        <View style={styles.heroButtons}>
          <Button size="lg" onPress={handleStartAssessment}>Start Free Assessment</Button>
          <DemoFormSection />
        </View>
      </View>

      {/* Platform Stats */}
      <View style={[styles.section, { backgroundColor: c.muted + '15' }]}>
        <View style={styles.platformStats}>
          {[
            { value: '106', label: 'Challenges', sub: 'Across 11 categories' },
            { value: '9', label: 'AI Models', sub: '5 price tiers' },
            { value: '710K+', label: 'Tokens Processed', sub: 'Real AI usage data' },
          ].map((s) => (
            <View key={s.label} style={styles.platformStat}>
              <Text style={[styles.platformStatValue, { color: c.accent }]}>{s.value}</Text>
              <Text style={[styles.platformStatLabel, { color: c.text }]}>{s.label}</Text>
              <Text style={[styles.platformStatSub, { color: c.textMuted }]}>{s.sub}</Text>
            </View>
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
        <Text style={[styles.sectionTitle, { color: c.text }]}>Simple, Flat-Rate Pricing</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Unlimited assessments. Cancel anytime. 30-day money-back guarantee.
        </Text>
        <View style={styles.tiers}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPopular = plan.badge === 'Most Popular';
            return (
              <Card key={plan.id} style={[styles.tierCard, isPopular && { borderColor: c.accent, borderWidth: 2 }]}>
                <CardHeader>
                  {plan.badge && (
                    <Badge variant={isPopular ? 'default' : 'outline'}>{plan.badge}</Badge>
                  )}
                  <CardTitle>{plan.label}</CardTitle>
                  <CardDescription>
                    {plan.interval === 'year'
                      ? `${plan.monthlyEquivalent}/mo equivalent`
                      : 'Billed monthly'}
                    {plan.savings ? ` \u2014 ${plan.savings}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {plan.features.map((f) => (
                    <Text key={f} style={[styles.featureItem, { color: c.textMuted }]}>{'\u2713'} {f}</Text>
                  ))}
                  <Button
                    variant={isPopular ? 'default' : 'outline'}
                    onPress={() => handleSubscribe(plan.id)}
                    disabled={checkoutLoading === plan.id}
                    style={{ marginTop: spacing.md }}
                    fullWidth
                  >
                    {checkoutLoading === plan.id ? 'Loading...' : 'Subscribe'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {/* Enterprise */}
          <Card style={styles.tierCard}>
            <CardHeader>
              <Badge variant="outline">Enterprise</Badge>
              <CardTitle>{ENTERPRISE_TIER.label}</CardTitle>
              <CardDescription>Custom pricing for large teams</CardDescription>
            </CardHeader>
            <CardContent>
              {ENTERPRISE_TIER.features.map((f) => (
                <Text key={f} style={[styles.featureItem, { color: c.textMuted }]}>{'\u2713'} {f}</Text>
              ))}
              <Button
                variant="outline"
                onPress={() => setShowDemoForm(true)}
                style={{ marginTop: spacing.md }}
                fullWidth
              >
                Contact Us
              </Button>
            </CardContent>
          </Card>
        </View>
        <Text style={[styles.guaranteeText, { color: c.textMuted }]}>
          30-day money-back guarantee. No questions asked.
        </Text>
      </View>

      {/* 3-step flow */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '40' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Steps to Finding AI Talent</Text>
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
        <Text style={[styles.ctaTitle, { color: c.text }]}>Find Your Next AI-Native Developer</Text>
        <Text style={[styles.ctaSub, { color: c.textMuted }]}>
          $200/month. Unlimited assessments. Cancel anytime.
        </Text>
        <View style={styles.ctaButtons}>
          <Button size="lg" onPress={() => handleSubscribe('plan-monthly')}>
            {checkoutLoading === 'plan-monthly' ? 'Loading...' : 'Subscribe Now'}
          </Button>
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
            Developer? Practice and get discovered {'\u2192'}
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
  // Platform stats
  platformStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    justifyContent: 'center',
    maxWidth: 800,
    alignSelf: 'center',
  },
  platformStat: { alignItems: 'center', minWidth: 150 },
  platformStatValue: { fontSize: 40, fontWeight: '700', fontFamily: fontFamily.body },
  platformStatLabel: { fontSize: fontSizes.md, fontWeight: '600', marginTop: spacing.xs },
  platformStatSub: { fontSize: fontSizes.xs, marginTop: 2 },
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
  guaranteeText: { textAlign: 'center', fontSize: fontSizes.sm, marginTop: spacing.lg, fontStyle: 'italic' },
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
