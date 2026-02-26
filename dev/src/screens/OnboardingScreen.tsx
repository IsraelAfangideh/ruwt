/**
 * OnboardingScreen: 3-step guided tutorial for new users.
 * Route: /onboarding
 * Shown when profile.onboardingCompleted === 0.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

const TOTAL_STEPS = 3;

export function OnboardingScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wantsNewsletter, setWantsNewsletter] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      // Check if onboarding already completed
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const profile = await res.json();
          if (profile.onboardingCompleted === 1) {
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] });
            return;
          }
        }
      } catch {
        // Continue with onboarding if check fails
      }
      setLoading(false);
    };
    init();
  }, [navigation]);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const navigateToArena = (challengeId: string) => {
    (navigation.navigate as any)('Arena', { challengeId });
  };

  const completeOnboarding = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingCompleted: 1,
          newsletterSubscribed: wantsNewsletter ? 1 : 0,
        }),
      });
    } catch {
      // Non-blocking — mark completed even if API fails
    }
    setSubmitting(false);
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepContainer}>
          {step === 0 && <StepWelcome colors={c} onNext={goNext} />}
          {step === 1 && (
            <StepFirstChallenge
              colors={c}
              onNext={goNext}
              onBack={goBack}
              onStartChallenge={() => navigateToArena('fizzbuzz-budget')}
            />
          )}
          {step === 2 && (
            <StepComplete
              colors={c}
              onBack={goBack}
              onFinish={completeOnboarding}
              submitting={submitting}
              wantsNewsletter={wantsNewsletter}
              onToggleNewsletter={() => setWantsNewsletter(!wantsNewsletter)}
            />
          )}
        </View>
      </ScrollView>

      {/* Progress dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === step ? c.accent : c.border,
                width: i === step ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/* ============================================================
 * Step 1: Welcome
 * ============================================================ */
function StepWelcome({
  colors: c,
  onNext,
}: {
  colors: any;
  onNext: () => void;
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headerSection}>
        <Badge variant="default">New to ruwt.dev?</Badge>
        <Text style={[styles.heroTitle, { color: c.text }]}>Welcome to ruwt.dev</Text>
        <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
          Here, you don't just code — you compete on how efficiently you use AI.
        </Text>
      </View>

      {/* 3 icon cards showing the flow */}
      <View style={styles.flowCards}>
        <FlowCard
          colors={c}
          number="1"
          title="Pick a Challenge"
          description="Browse real engineering problems across categories — from debugging to system design."
        />
        <FlowCard
          colors={c}
          number="2"
          title="Solve with AI"
          description="Use the AI chat to write and debug code. Each message costs credits based on the model you choose."
        />
        <FlowCard
          colors={c}
          number="3"
          title="Rank by Efficiency"
          description="The cheapest correct solution wins. Your rank reflects how wisely you spend, not just speed."
        />
      </View>

      <Card style={{ borderColor: c.accent, borderWidth: 1 }}>
        <CardContent>
          <Text style={[styles.tipText, { color: c.text }]}>
            Your AI budget matters. Choose your models wisely.
          </Text>
          <Text style={[styles.tipDetail, { color: c.textMuted }]}>
            Budget models ($) are cheap but may need more attempts. Premium models ($$$) are
            powerful but expensive. The best engineers find the sweet spot. Look for the star
            indicator next to the recommended tier for each challenge.
          </Text>
        </CardContent>
      </Card>

      <View style={styles.buttonRow}>
        <Button size="lg" onPress={onNext} fullWidth>
          Next
        </Button>
      </View>
    </View>
  );
}

/* ============================================================
 * Step 2: First Challenge CTA
 * ============================================================ */
function StepFirstChallenge({
  colors: c,
  onNext,
  onBack,
  onStartChallenge,
}: {
  colors: any;
  onNext: () => void;
  onBack: () => void;
  onStartChallenge: () => void;
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headerSection}>
        <Text style={[styles.heroTitle, { color: c.text }]}>Your First Challenge</Text>
        <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
          Let's try a quick challenge to see how it works.
        </Text>
      </View>

      {/* Preview card */}
      <Card style={{ borderColor: c.accent, borderWidth: 1 }}>
        <CardHeader>
          <View style={styles.badgeRow}>
            <Badge variant="default">Easy</Badge>
            <Badge variant="secondary">Onboarding</Badge>
          </View>
          <CardTitle>FizzBuzz Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={[styles.challengeDesc, { color: c.textMuted }]}>
            The classic FizzBuzz problem — but with a cost constraint. Can you solve it using
            the cheapest AI model possible? This challenge teaches you the core loop: prompt,
            review, submit.
          </Text>
          <View style={styles.challengeMeta}>
            <View style={[styles.metaPill, { backgroundColor: c.accentBg }]}>
              <Text style={[styles.metaText, { color: c.accent }]}>JavaScript</Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: c.successBg }]}>
              <Text style={[styles.metaText, { color: c.success }]}>~2 min</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Tips card */}
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: fontSizes.md }}>Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <TipRow colors={c} label="$" text="Use budget models for simple tasks" />
          <TipRow colors={c} label="$$$" text="Save expensive models for hard problems" />
          <TipRow colors={c} label="<>" text="The fewer tokens you use, the less you spend" />
          <TipRow colors={c} label="?" text="Hidden tests check edge cases on submit — public tests help you develop" />
        </CardContent>
      </Card>

      <View style={styles.buttonRow}>
        <Button size="lg" onPress={onStartChallenge} fullWidth>
          Start Challenge
        </Button>
      </View>

      <View style={styles.navRow}>
        <Button variant="ghost" onPress={onBack}>
          Back
        </Button>
        <Pressable onPress={onNext}>
          <Text style={[styles.skipText, { color: c.textMuted }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ============================================================
 * Step 3: Completion
 * ============================================================ */
function StepComplete({
  colors: c,
  onBack,
  onFinish,
  submitting,
  wantsNewsletter,
  onToggleNewsletter,
}: {
  colors: any;
  onBack: () => void;
  onFinish: () => void;
  submitting: boolean;
  wantsNewsletter: boolean;
  onToggleNewsletter: () => void;
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headerSection}>
        {/* Checkmark circle */}
        <View style={[styles.checkCircle, { backgroundColor: c.accentBg }]}>
          <Text style={[styles.checkIcon, { color: c.accent }]}>&#10003;</Text>
        </View>
        <Text style={[styles.heroTitle, { color: c.text }]}>You're All Set!</Text>
        <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
          You're ready to compete. Here's what's waiting for you.
        </Text>
      </View>

      {/* Credits card */}
      <Card style={{ borderColor: c.accent, borderWidth: 1 }}>
        <CardContent style={styles.creditsContent}>
          <Text style={[styles.creditsAmount, { color: c.accent }]}>Free Practice</Text>
          <Text style={[styles.creditsLabel, { color: c.textMuted }]}>
            All practice challenges are 100% free — AI chat included.
          </Text>
          <Text style={[styles.creditsDetail, { color: c.textSubtle }]}>
            Your 50,000 credits ($5.00) are reserved for team assessments and premium features.
          </Text>
        </CardContent>
      </Card>

      {/* Daily challenge card */}
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: fontSizes.md }}>Daily Challenges</CardTitle>
        </CardHeader>
        <CardContent>
          <Text style={[styles.dailyDesc, { color: c.textMuted }]}>
            Come back every day for a new challenge. Build your streak and climb the leaderboard.
          </Text>
          <View style={styles.streakRow}>
            <View style={[styles.streakBadge, { backgroundColor: c.accentBg }]}>
              <Text style={[styles.streakFlame, { color: c.accent }]}>1</Text>
            </View>
            <Text style={[styles.streakText, { color: c.textMuted }]}>
              Day 1 — your journey begins today
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* Newsletter opt-in */}
      <Pressable onPress={onToggleNewsletter} style={styles.newsletterRow}>
        <View
          style={[
            styles.newsletterToggle,
            { backgroundColor: wantsNewsletter ? c.accent : c.border },
          ]}
        >
          <View
            style={[
              styles.newsletterThumb,
              {
                backgroundColor: '#fff',
                transform: [{ translateX: wantsNewsletter ? 20 : 2 }],
              },
            ]}
          />
        </View>
        <Text style={[styles.newsletterLabel, { color: c.textMuted }]}>
          Get daily updates — platform news and dev links, straight to your inbox.
        </Text>
      </Pressable>

      <View style={styles.buttonRow}>
        <Button size="lg" onPress={onFinish} disabled={submitting} fullWidth>
          {submitting ? 'Loading...' : 'Go to Dashboard'}
        </Button>
      </View>

      <View style={styles.navRow}>
        <Button variant="ghost" onPress={onBack}>
          Back
        </Button>
      </View>
    </View>
  );
}

/* ============================================================
 * Small reusable components
 * ============================================================ */
function FlowCard({
  colors: c,
  number,
  title,
  description,
}: {
  colors: any;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <View style={[styles.flowCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.flowNumber, { backgroundColor: c.accentBg }]}>
        <Text style={[styles.flowNumberText, { color: c.accent }]}>{number}</Text>
      </View>
      <Text style={[styles.flowTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.flowDesc, { color: c.textMuted }]}>{description}</Text>
    </View>
  );
}

function TipRow({
  colors: c,
  label,
  text,
}: {
  colors: any;
  label: string;
  text: string;
}) {
  return (
    <View style={styles.tipRow}>
      <View style={[styles.tipLabel, { backgroundColor: c.accentBg }]}>
        <Text style={[styles.tipLabelText, { color: c.accent }]}>{label}</Text>
      </View>
      <Text style={[styles.tipRowText, { color: c.textMuted }]}>{text}</Text>
    </View>
  );
}

/* ============================================================
 * Styles
 * ============================================================ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'] + 40, // room for dots
  },
  stepContainer: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  stepInner: {
    gap: spacing.lg,
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: fontSizes['4xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 440,
  },

  /* Flow cards (Step 1) */
  flowCards: {
    gap: spacing.md,
  },
  flowCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  flowNumber: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowNumberText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  flowTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  flowDesc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },

  /* Tips (Step 1) */
  tipText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textAlign: 'center',
  },
  tipDetail: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  /* Challenge preview (Step 2) */
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  challengeDesc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  challengeMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  metaText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },

  /* Tip rows (Step 2) */
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  tipLabel: {
    width: 36,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipLabelText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  tipRowText: {
    fontSize: fontSizes.sm,
    flex: 1,
  },

  /* Completion (Step 3) */
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  checkIcon: {
    fontSize: 36,
    fontWeight: '700',
  },
  creditsContent: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  creditsAmount: {
    fontSize: fontSizes['4xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  creditsLabel: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  creditsDetail: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  dailyDesc: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  streakBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakFlame: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  streakText: {
    fontSize: fontSizes.sm,
    flex: 1,
  },

  /* Newsletter opt-in */
  newsletterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  newsletterToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    flexShrink: 0,
  },
  newsletterThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  newsletterLabel: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    flex: 1,
  },

  /* Buttons / nav */
  buttonRow: {
    marginTop: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    textDecorationLine: 'underline',
  },

  /* Progress dots */
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: radii.full,
  },
});
