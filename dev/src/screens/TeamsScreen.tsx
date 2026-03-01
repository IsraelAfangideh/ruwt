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
import { useWindowWidth } from '@/hooks/useWindowWidth';

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
    a: 'Multiple models across five price tiers — from micro ($0.01/1M tokens) to reasoning ($0.50+/1M tokens). Part of the assessment is choosing the right model for each problem. Choosing an expensive model for a trivial task is a signal.',
  },
  {
    q: 'Can I customize the challenges?',
    a: 'Yes. Choose from 100+ challenges across categories like Model Selection, Prompt Efficiency, Debugging, and more. Or start from a template (Frontend Developer, Backend Developer, Full Stack, AI Power User) and customize from there.',
  },
  {
    q: 'What data do I get back?',
    a: 'Per-candidate: AI Profile radar chart (5 dimensions), green/red behavioral flags, cost breakdown per challenge, model usage patterns, comparative percentiles vs. other candidates, and full session replays. Export everything to CSV for your ATS.',
  },
  {
    q: 'Is candidate data private?',
    a: 'Candidates only see their own results. Assessment data is only visible to the assessment creator and your team members. Shareable results links are opt-in and use unique tokens.',
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
  { label: 'Anti-cheat (server-tracked)', ruwt: true, hackerrank: 'Partial', codility: 'Partial', takehome: false },
  { label: 'Pricing', ruwt: '$200/mo flat', hackerrank: '$100+/seat/mo', codility: '$100+/seat/mo', takehome: 'Free' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function TeamsScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const width = useWindowWidth();
  const isMobile = width < 768;
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
        <Button size="lg" variant="outline" onPress={() => setShowDemoForm(true)}
          style={{ borderColor: 'rgba(232,228,223,0.3)' }}
          textStyle={{ color: '#f5f3f0' }}
        >
          Book a Demo
        </Button>
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
    if (val === true) return <Text style={{ color: '#5a8a5a', fontSize: fontSizes.md, fontWeight: '700' }}>{'\u2713'}</Text>;
    if (val === false) return <Text style={{ color: c.textMuted, fontSize: fontSizes.md }}>{'\u2014'}</Text>;
    return <Text style={{ color: c.text, fontSize: fontSizes.xs }}>{val}</Text>;
  };

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]}>
      {/* ─── Header ─── */}
      <View style={[styles.header, { borderBottomColor: 'transparent' }]}>
        <Pressable onPress={() => navigation.navigate('Landing' as never)}>
          <Text style={[styles.logo, { color: '#f5f3f0' }]}>Ruwt</Text>
        </Pressable>
        <View style={styles.headerActions}>
          {isLoggedIn ? (
            <Button onPress={() => navigation.navigate('Dashboard' as never)}
              style={{ backgroundColor: '#c9a962' }}
              textStyle={{ color: '#1a1816' }}
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" onPress={() => navigation.navigate('Login' as never)}
                textStyle={{ color: '#f5f3f0' }}
              >
                Sign in
              </Button>
              <Button onPress={() => navigation.navigate('Register' as never)}
                style={{ backgroundColor: '#c9a962' }}
                textStyle={{ color: '#1a1816' }}
              >
                Get Started
              </Button>
            </>
          )}
        </View>
      </View>

      {/* ─── Dark Hero ─── */}
      <View style={[styles.hero, { backgroundColor: '#1a1816' }]}>
        <View style={styles.heroInner}>
          <Badge variant="secondary" style={{ alignSelf: 'center' }}>For Hiring Teams</Badge>
          <Text style={styles.heroTitle}>
            Your Candidates Claim{'\n'}They're{' '}
            <Text style={{ color: '#c9a962' }}>AI-Fluent</Text>.{'\n'}
            Now You Can Verify It.
          </Text>
          <Text style={styles.heroSub}>
            Ruwt is the only assessment platform that measures how engineers actually use AI —
            which models they pick, how they prompt, what they spend, and how they debug.
            Objective data. Impossible to fake.
          </Text>

          {/* ROI Stats in hero */}
          <View style={[styles.heroStats, isMobile && styles.heroStatsMobile]}>
            {[
              { value: '5 min', label: 'SETUP' },
              { value: '60 min', label: 'CANDIDATE TIME' },
              { value: '5 axes', label: 'AI PROFILE' },
              { value: '100%', label: 'SERVER-TRACKED' },
            ].map((s) => (
              <View key={s.label} style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{s.value}</Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.heroButtons}>
            <Button
              size="lg"
              onPress={handleStartAssessment}
              style={{ backgroundColor: '#c9a962' }}
              textStyle={{ color: '#1a1816', fontWeight: '700' }}
            >
              Create Your First Assessment
            </Button>
            <DemoFormSection />
          </View>
          <Text style={styles.heroNote}>
            Free to try. No credit card required.
          </Text>
        </View>
      </View>

      {/* ─── The Problem ─── */}
      <View style={[styles.section, { backgroundColor: c.bg }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          Every Engineer Says They Use AI.{'\n'}How Do You Tell Who's Actually Good?
        </Text>
        <View style={styles.problemGrid}>
          {[
            {
              icon: '\u2753',
              problem: 'Take-homes show the answer',
              detail: 'but not the process. Did they use AI? Which model? How efficiently? You have no idea.',
            },
            {
              icon: '\u274C',
              problem: 'HackerRank tests algorithms',
              detail: "not AI judgment. Sorting arrays in O(n log n) doesn't tell you if they'll waste $500/month on GPT-4 for tasks a free model handles.",
            },
            {
              icon: '\u23F3',
              problem: 'Interviews are subjective',
              detail: 'Two interviewers, two opinions. No standardized way to compare candidates on the skill that matters most right now.',
            },
          ].map((item) => (
            <Card key={item.problem} style={styles.problemCard}>
              <CardContent style={styles.problemCardContent}>
                <Text style={styles.problemIcon}>{item.icon}</Text>
                <Text style={[styles.problemTitle, { color: c.text }]}>{item.problem}</Text>
                <Text style={[styles.problemDetail, { color: c.textMuted }]}>{item.detail}</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── The Solution (3-step) ─── */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '15' }]}>
        <Badge variant="default" style={{ alignSelf: 'center', marginBottom: spacing.md }}>How It Works</Badge>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Three Steps. Real Data.</Text>
        <View style={styles.cards}>
          {[
            {
              step: '1',
              title: 'Build Your Assessment',
              desc: 'Pick from 100+ challenges across 11 categories, or use a template (Frontend, Backend, Full Stack, AI Power User). Add your company branding. Set the time limit. Takes 5 minutes.',
            },
            {
              step: '2',
              title: 'Send the Link',
              desc: 'Candidates get a branded assessment page with real AI models and a full IDE. They choose which models to use, how to prompt, and how to debug — all tracked server-side.',
            },
            {
              step: '3',
              title: 'Compare Candidates',
              desc: 'Each candidate gets an AI Profile: a 5-axis radar chart, behavioral flags (green/red), cost breakdown, model patterns, and a full session replay. Export to CSV for your ATS.',
            },
          ].map((item) => (
            <Card key={item.step} style={styles.card}>
              <CardHeader>
                <View style={[styles.stepNum, { backgroundColor: '#c9a962' + '20' }]}>
                  <Text style={[styles.stepText, { color: '#c9a962' }]}>{item.step}</Text>
                </View>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── Candidate Comparison Preview ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>See What You Get</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Two candidates. Same assessment. Very different AI profiles.
        </Text>

        <View style={styles.candidateComparison}>
          {/* Candidate A — Strong */}
          <Card style={[styles.candidateCard, { borderColor: '#5a8a5a' + '60', borderWidth: 1 }]}>
            <CardContent>
              <View style={styles.candidateHeader}>
                <View style={[styles.candidateAvatar, { backgroundColor: '#5a8a5a' + '20' }]}>
                  <Text style={{ fontSize: 18, color: '#5a8a5a', fontWeight: '700' }}>A</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.candidateName, { color: c.text }]}>Candidate A</Text>
                  <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a', fontWeight: '600' }}>Passed 5/5</Text>
                </View>
                <Badge variant="outline" style={{ borderColor: '#5a8a5a', backgroundColor: '#5a8a5a' + '15' }}>
                  <Text style={{ fontSize: 11, color: '#5a8a5a', fontWeight: '700' }}>RECOMMENDED</Text>
                </Badge>
              </View>

              <View style={styles.candidateFlags}>
                {['Strategic model switching', 'Concise prompting', 'Manual error correction'].map((f) => (
                  <Badge key={f} variant="outline" style={{ borderColor: '#5a8a5a', backgroundColor: '#5a8a5a' + '10' }}>
                    <Text style={{ fontSize: fontSizes.xs, color: '#5a8a5a' }}>{f}</Text>
                  </Badge>
                ))}
              </View>

              <View style={styles.candidateMetricsRow}>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: '#c9a962' }]}>$0.28</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Total cost</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>3,200</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Tokens</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>42 min</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Time</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>2.3</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Prompts/challenge</Text>
                </View>
              </View>

              <Text style={[styles.candidateInsight, { color: c.textMuted }]}>
                Started with Llama 8B for easy challenges, escalated to DeepSeek R1 for debugging.
                Caught an incorrect AI suggestion and corrected it manually.
              </Text>

              <View style={[styles.costBar, { backgroundColor: c.muted + '30' }]}>
                <View style={[styles.costBarFill, { backgroundColor: '#5a8a5a', width: '28%' }]} />
              </View>
              <Text style={[styles.costBarLabel, { color: c.textMuted }]}>
                P28 — 40% cheaper than median
              </Text>
            </CardContent>
          </Card>

          {/* Candidate B — Weak */}
          <Card style={[styles.candidateCard, { borderColor: c.destructive + '40', borderWidth: 1 }]}>
            <CardContent>
              <View style={styles.candidateHeader}>
                <View style={[styles.candidateAvatar, { backgroundColor: c.destructive + '15' }]}>
                  <Text style={{ fontSize: 18, color: c.destructive, fontWeight: '700' }}>B</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.candidateName, { color: c.text }]}>Candidate B</Text>
                  <Text style={{ fontSize: fontSizes.xs, color: c.destructive, fontWeight: '600' }}>Passed 3/5</Text>
                </View>
                <Badge variant="outline" style={{ borderColor: c.destructive, backgroundColor: c.destructive + '10' }}>
                  <Text style={{ fontSize: 11, color: c.destructive, fontWeight: '700' }}>CONCERNS</Text>
                </Badge>
              </View>

              <View style={styles.candidateFlags}>
                {['Used premium model for trivial tasks', 'Copy-pasted full errors', 'No model switching'].map((f) => (
                  <Badge key={f} variant="outline" style={{ borderColor: c.destructive, backgroundColor: c.destructive + '10' }}>
                    <Text style={{ fontSize: fontSizes.xs, color: c.destructive }}>{f}</Text>
                  </Badge>
                ))}
              </View>

              <View style={styles.candidateMetricsRow}>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.destructive }]}>$4.12</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Total cost</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>18,400</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Tokens</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>78 min</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Time</Text>
                </View>
                <View style={styles.candidateMetric}>
                  <Text style={[styles.candidateMetricVal, { color: c.text }]}>8.1</Text>
                  <Text style={[styles.candidateMetricLbl, { color: c.textMuted }]}>Prompts/challenge</Text>
                </View>
              </View>

              <Text style={[styles.candidateInsight, { color: c.textMuted }]}>
                Used GPT-4 for every challenge including FizzBuzz. Pasted entire error traces
                into prompts. Failed 2 challenges after running out of time.
              </Text>

              <View style={[styles.costBar, { backgroundColor: c.muted + '30' }]}>
                <View style={[styles.costBarFill, { backgroundColor: c.destructive, width: '92%' }]} />
              </View>
              <Text style={[styles.costBarLabel, { color: c.textMuted }]}>
                P92 — 3x more expensive than median
              </Text>
            </CardContent>
          </Card>
        </View>

        <Text style={[styles.comparisonCaption, { color: c.textMuted }]}>
          Both candidates passed the same interview. Only one of them is efficient with AI.
          Without Ruwt, you'd never know the difference.
        </Text>
      </View>

      {/* ─── Why Teams Choose Ruwt ─── */}
      <View style={[styles.section, styles.sectionAlt, { backgroundColor: c.muted + '10' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Why Teams Switch to Ruwt</Text>
        <View style={styles.trustGrid}>
          {[
            { icon: '\u{1F4B0}', title: 'Real AI, Real Cost', desc: 'Candidates use actual AI APIs with real pricing. No sandboxes, no simulations. Every decision has a real cost attached.' },
            { icon: '\u{1F4CA}', title: 'Objective Comparison', desc: 'Compare candidates by cost, tokens, model strategy, and time. Numbers, not opinions. Export to CSV for your ATS.' },
            { icon: '\u{1F3AC}', title: 'Full Session Replay', desc: 'Watch every prompt, every model switch, every debugging step. Understand how candidates actually think under pressure.' },
            { icon: '\u{1F512}', title: 'Tamper-Proof Tracking', desc: 'All AI calls logged server-side. Candidates can\'t use external tools or swap API keys without it showing in the data.' },
          ].map((item) => (
            <Card key={item.title} style={styles.trustCard}>
              <CardHeader>
                <Text style={{ fontSize: 28, marginBottom: spacing.xs }}>{item.icon}</Text>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </View>
      </View>

      {/* ─── Comparison Table ─── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>How Ruwt Compares</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          The only platform built specifically to measure AI-augmented engineering.
        </Text>
        <Card style={[styles.comparisonTable, { borderColor: c.border }]}>
          <CardContent>
            {/* Table header */}
            <View style={[styles.compRow, styles.compHeaderRow, { borderBottomColor: c.accent }]}>
              <View style={styles.compLabel} />
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: '#c9a962' }]}>Ruwt</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>HackerRank</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>Codility</Text></View>
              <View style={styles.compCell}><Text style={[styles.compHeader, { color: c.textMuted }]}>Take-Home</Text></View>
            </View>
            {COMPARISON_ROWS.map((row, i) => (
              <View key={i} style={[styles.compRow, i < COMPARISON_ROWS.length - 1 && { borderBottomColor: c.border, borderBottomWidth: 1 }]}>
                <View style={styles.compLabel}>
                  <Text style={[styles.compLabelText, { color: c.text }]}>{row.label}</Text>
                </View>
                <View style={[styles.compCell, { backgroundColor: '#c9a962' + '08' }]}>{renderCheckOrX(row.ruwt)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.hackerrank)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.codility)}</View>
                <View style={styles.compCell}>{renderCheckOrX(row.takehome)}</View>
              </View>
            ))}
          </CardContent>
        </Card>
      </View>

      {/* ─── Pricing ─── */}
      <View style={[styles.section, { backgroundColor: c.muted + '15' }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Simple, Flat-Rate Pricing</Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Unlimited assessments. Unlimited candidates. Cancel anytime.
        </Text>
        <View style={styles.tiers}>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPopular = plan.badge === 'Most Popular';
            return (
              <Card key={plan.id} style={[styles.tierCard, isPopular && { borderColor: '#c9a962', borderWidth: 2 }]}>
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
                    {checkoutLoading === plan.id ? 'Loading...' : 'Start Free Trial'}
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

      {/* ─── FAQ ─── */}
      <View style={styles.section}>
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

      {/* ─── Final CTA ─── */}
      <View style={[styles.ctaSection, { backgroundColor: '#1a1816' }]}>
        <Text style={styles.ctaTitle}>
          Stop Guessing. Start Measuring.
        </Text>
        <Text style={styles.ctaSub}>
          Your next hire will use AI every day. Find the one who uses it best.
        </Text>
        <View style={styles.ctaButtons}>
          <Button
            size="lg"
            onPress={handleStartAssessment}
            style={{ backgroundColor: '#c9a962' }}
            textStyle={{ color: '#1a1816', fontWeight: '700' }}
          >
            Create Your First Assessment
          </Button>
          {!demoSubmitted && !showDemoForm && (
            <Button size="lg" variant="outline" onPress={() => setShowDemoForm(true)}
              style={{ borderColor: 'rgba(232,228,223,0.25)' }}
              textStyle={{ color: '#f5f3f0' }}
            >
              Book a Demo
            </Button>
          )}
          {demoSubmitted && (
            <Badge variant="default">
              <Text style={{ color: '#fff', fontSize: fontSizes.sm }}>Demo requested!</Text>
            </Badge>
          )}
        </View>
        <Text style={{ color: '#6b6560', fontSize: fontSizes.sm, marginTop: spacing.md, fontFamily: fontFamily.body }}>
          Free to try. $200/month when you're ready. Cancel anytime.
        </Text>
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
            Developer? Practice free challenges {'\u2192'}
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
    backgroundColor: '#1a1816',
    position: 'relative',
    zIndex: 10,
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.display },
  headerActions: { flexDirection: 'row', gap: spacing.md },

  // Hero (dark)
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'] + 16,
    paddingHorizontal: spacing.lg,
  },
  heroInner: {
    maxWidth: 800,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    color: '#f5f3f0',
    fontFamily: fontFamily.body,
    lineHeight: 48,
  },
  heroSub: {
    fontSize: fontSizes.lg,
    textAlign: 'center',
    color: '#9a938a',
    fontFamily: fontFamily.body,
    lineHeight: 28,
    maxWidth: 620,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginVertical: spacing.lg,
  },
  heroStatsMobile: {
    gap: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroStat: { alignItems: 'center', gap: 2 },
  heroStatValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: '#c9a962',
    fontFamily: fontFamily.body,
  },
  heroStatLabel: {
    fontSize: 10,
    color: '#6b6560',
    fontFamily: fontFamily.body,
    textTransform: 'uppercase' as any,
    letterSpacing: 1.5,
  },
  heroButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  heroNote: {
    fontSize: fontSizes.sm,
    color: '#6b6560',
    fontFamily: fontFamily.body,
    marginTop: spacing.xs,
  },

  // Sections
  section: { padding: spacing.lg, paddingVertical: spacing.xl },
  sectionAlt: { marginHorizontal: 0 },
  sectionTitle: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
    lineHeight: 38,
  },
  sectionSub: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 600,
    alignSelf: 'center',
    fontFamily: fontFamily.body,
    fontSize: fontSizes.md,
    lineHeight: 24,
  },

  // Problem section
  problemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  problemCard: { flex: 1, minWidth: 260 },
  problemCardContent: { gap: spacing.sm },
  problemIcon: { fontSize: 28 },
  problemTitle: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  problemDetail: { fontSize: fontSizes.sm, lineHeight: 22, fontFamily: fontFamily.body },

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

  // Candidate comparison
  candidateComparison: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    justifyContent: 'center',
    maxWidth: 900,
    alignSelf: 'center',
  },
  candidateCard: { flex: 1, minWidth: 320 },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  candidateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateName: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  candidateFlags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  candidateMetricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  candidateMetric: { alignItems: 'center' },
  candidateMetricVal: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  candidateMetricLbl: { fontSize: 10, marginTop: 2, fontFamily: fontFamily.body },
  candidateInsight: {
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
    lineHeight: 20,
    fontFamily: fontFamily.body,
    marginBottom: spacing.md,
  },
  costBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  costBarFill: { height: '100%', borderRadius: 3 },
  costBarLabel: { fontSize: 11, marginTop: 4, fontFamily: fontFamily.body },
  comparisonCaption: {
    textAlign: 'center',
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
    fontWeight: '500',
    marginTop: spacing.xl,
    maxWidth: 600,
    alignSelf: 'center',
    lineHeight: 24,
  },

  // Trust
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    maxWidth: 900,
    alignSelf: 'center',
  },
  trustCard: { flex: 1, minWidth: 200 },

  // Comparison table
  comparisonTable: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  compHeaderRow: { borderBottomWidth: 2 },
  compLabel: { flex: 2 },
  compLabelText: { fontSize: fontSizes.sm, fontWeight: '500' },
  compCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  compHeader: { fontSize: fontSizes.xs, fontWeight: '700', textTransform: 'uppercase' },

  // Pricing
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', maxWidth: 1100, alignSelf: 'center' },
  tierCard: { flex: 1, minWidth: 220 },
  featureItem: { fontSize: fontSizes.sm, marginBottom: spacing.xs },
  guaranteeText: { textAlign: 'center', fontSize: fontSizes.sm, marginTop: spacing.lg, fontStyle: 'italic' },

  // FAQ
  faqList: { maxWidth: 700, alignSelf: 'center', width: '100%', gap: spacing.sm },
  faqCard: { borderWidth: 1 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: fontSizes.md, fontWeight: '600', fontFamily: fontFamily.body, flex: 1, marginRight: spacing.md },
  faqAnswer: { fontSize: fontSizes.sm, marginTop: spacing.sm, lineHeight: 22, fontFamily: fontFamily.body },

  // CTA
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
    fontSize: fontSizes.lg,
    lineHeight: 28,
  },
  ctaButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', alignItems: 'center' },

  // Footer
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
