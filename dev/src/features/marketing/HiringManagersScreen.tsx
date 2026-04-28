/**
 * HiringManagersScreen: outbound-DM wedge page.
 * Frames Ruwt as the answer to candidates passing screens with invisible
 * AI overlays (Cluely et al). Hero + problem + ROI calc + pilot capture.
 * Route: /for-hiring-managers
 */
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Input } from '@/shared/ui/Input';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';
import { useWindowWidth } from '@/shared/hooks/useWindowWidth';

const HOURLY_RATE_DEFAULT = 150;
const HOURS_PER_HIRE_DEFAULT = 12;
const HIRES_PER_YEAR_DEFAULT = 20;

interface PilotForm {
  email: string;
  name: string;
  company: string;
  role: string;
  hiresPerYear: string;
  currentTool: string;
  notes: string;
}

const EMPTY_FORM: PilotForm = {
  email: '', name: '', company: '', role: '',
  hiresPerYear: '', currentTool: '', notes: '',
};

export function HiringManagersScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const width = useWindowWidth();
  const isMobile = width < 768;

  const [hourlyRate, setHourlyRate] = useState(HOURLY_RATE_DEFAULT);
  const [hoursPerHire, setHoursPerHire] = useState(HOURS_PER_HIRE_DEFAULT);
  const [hiresPerYear, setHiresPerYear] = useState(HIRES_PER_YEAR_DEFAULT);

  const wastedAnnualCost = hourlyRate * hoursPerHire * hiresPerYear;

  const [form, setForm] = useState<PilotForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = form.email.trim().length > 0 && form.email.includes('@');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/leads/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name || undefined,
          company: form.company || undefined,
          role: form.role || undefined,
          hiresPerYear: form.hiresPerYear ? Number(form.hiresPerYear) : undefined,
          currentTool: form.currentTool || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <ScrollView style={[styles.page, { backgroundColor: c.bg }]} testID="hiring-managers-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.navigate('Landing')}>
          <Text style={[styles.logo, { color: '#f5f3f0' }]}>Ruwt</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Button variant="ghost" onPress={() => navigation.navigate('Hiring')} textStyle={{ color: '#f5f3f0' }}>
            Pricing
          </Button>
          <Button onPress={() => navigation.navigate('Register')}
            style={{ backgroundColor: '#c9a962' }} textStyle={{ color: '#1a1816' }}>
            Get Started
          </Button>
        </View>
      </View>

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: '#1a1816' }]}>
        <View style={styles.heroInner}>
          <Badge variant="secondary" style={{ alignSelf: 'center' }}>For Hiring Managers</Badge>
          <Text style={styles.heroTitle}>
            Your candidates are{'\n'}
            <Text style={{ color: '#c9a962' }}>passing your screen with AI</Text>.{'\n'}
            You can't see it.
          </Text>
          <Text style={styles.heroSub}>
            Invisible desktop overlays like Cluely solve LeetCode-style problems silently during your interview.
            Screen-share doesn't catch them. Camera proctoring doesn't catch them.
            Ruwt stops pretending AI isn't in the room — and grades how well candidates use it.
          </Text>
          <View style={styles.heroCtas}>
            <Button size="lg" onPress={() => navigation.navigate('Register')}
              style={{ backgroundColor: '#c9a962' }} textStyle={{ color: '#1a1816' }}>
              Run a Free Pilot
            </Button>
            <Button size="lg" variant="outline" onPress={() => navigation.navigate('Hiring')}
              style={{ borderColor: 'rgba(232,228,223,0.3)' }} textStyle={{ color: '#f5f3f0' }}>
              See Pricing
            </Button>
          </View>
        </View>
      </View>

      {/* Problem section */}
      <View style={[styles.section, { paddingHorizontal: isMobile ? spacing.md : spacing.xl }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          Three things your current screen can't see
        </Text>
        <View style={[styles.problemGrid, isMobile && { flexDirection: 'column' }]}>
          {[
            {
              title: 'Invisible AI overlays',
              body: 'Cluely, Interview Coder, and a dozen clones run as transparent desktop windows. They\'re invisible to screen-share and most proctoring software. Your candidate looks like they\'re thinking. They\'re reading.',
            },
            {
              title: 'Prompt jockeys, not engineers',
              body: 'A passing LeetCode submission tells you nothing about whether the candidate can prompt, debug, or pick the right model when AI is wrong. You hire someone who can copy ChatGPT — not someone who can ship.',
            },
            {
              title: 'Wasted interview hours',
              body: 'Senior engineers re-interview the same false positives. Hiring managers re-watch CoderPad replays trying to spot tab-switches. The cost compounds with every bad pass-through.',
            },
          ].map((p) => (
            <Card key={p.title} style={[styles.problemCard, { borderColor: c.border, backgroundColor: c.cardBg }]}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Text style={{ color: c.textMuted, lineHeight: 22, fontSize: fontSizes.sm }}>{p.body}</Text>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>

      {/* Solution / how it works */}
      <View style={[styles.section, { backgroundColor: c.cardBg, paddingHorizontal: isMobile ? spacing.md : spacing.xl }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          What Ruwt actually measures
        </Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Candidates code through Ruwt's IDE with real AI access. Every prompt, every model choice,
          every debugging step is recorded server-side — tamper-proof, no overlay can fake it.
          You get an AI Fluency Index from 0–850 that's defensible to compliance and easy to compare.
        </Text>
        <View style={[styles.metricGrid, isMobile && { flexDirection: 'column' }]}>
          {[
            { label: 'Model selection', body: 'Did they pick the right model for the task? Reasoning model on a string-format problem is a flag.' },
            { label: 'Prompt efficiency', body: 'Tokens spent per passing test. Bloated prompts cost real money in production.' },
            { label: 'Debugging behavior', body: 'When AI is wrong, do they course-correct or paste the same prompt three times?' },
            { label: 'Cost per solve', body: 'Real dollar cost per passing solution. The single best leading indicator of production efficiency.' },
          ].map((m) => (
            <View key={m.label} style={[styles.metric, { borderColor: c.border }]}>
              <Text style={[styles.metricLabel, { color: c.accent }]}>{m.label}</Text>
              <Text style={[styles.metricBody, { color: c.textMuted }]}>{m.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ROI calculator */}
      <View style={[styles.section, { paddingHorizontal: isMobile ? spacing.md : spacing.xl }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          What false-positive interviews are costing you
        </Text>
        <Card style={[styles.roiCard, { borderColor: c.border, backgroundColor: c.cardBg }]}>
          <CardContent>
            <View style={styles.roiInputs}>
              <RoiInput
                label="Senior engineer hourly rate"
                value={hourlyRate}
                onChange={setHourlyRate}
                prefix="$"
                min={50}
                max={1000}
                step={10}
              />
              <RoiInput
                label="Hours wasted per false-positive hire"
                value={hoursPerHire}
                onChange={setHoursPerHire}
                min={1}
                max={100}
                step={1}
              />
              <RoiInput
                label="Engineers hired per year"
                value={hiresPerYear}
                onChange={setHiresPerYear}
                min={1}
                max={500}
                step={1}
              />
            </View>
            <View style={[styles.roiResult, { borderTopColor: c.border }]}>
              <Text style={[styles.roiResultLabel, { color: c.textMuted }]}>
                Annual cost of bad-screen pass-throughs
              </Text>
              <Text style={[styles.roiResultValue, { color: c.accent }]} testID="roi-annual-cost">
                {fmtMoney(wastedAnnualCost)}
              </Text>
              <Text style={[styles.roiResultNote, { color: c.textMuted }]}>
                Ruwt's enterprise tier is a fraction of this. Most teams break even in week one.
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* Pilot CTA form */}
      <View style={[styles.section, { paddingHorizontal: isMobile ? spacing.md : spacing.xl, paddingBottom: spacing.xxl }]}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          Run 5 candidates side-by-side. No commitment.
        </Text>
        <Text style={[styles.sectionSub, { color: c.textMuted }]}>
          Send us the next 5 candidates already in your pipeline. We'll run them through Ruwt
          alongside your current screen. You compare the results yourself.
        </Text>
        <Card style={[styles.pilotCard, { borderColor: c.border, backgroundColor: c.cardBg }]}>
          <CardContent>
            {submitted ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={[styles.successTitle, { color: c.text }]}>Got it. We'll email you within 24 hours.</Text>
                <Text style={[styles.successSub, { color: c.textMuted }]}>
                  Reply with your 5 candidates and we'll set up the pilot the same day.
                </Text>
              </View>
            ) : (
              <View style={styles.formFields}>
                <Input label="Work email *" placeholder="you@company.com"
                  value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  keyboardType="email-address" testID="pilot-email" />
                <Input label="Name" placeholder="Jane Smith"
                  value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  testID="pilot-name" />
                <Input label="Company" placeholder="Acme"
                  value={form.company} onChangeText={(v) => setForm((f) => ({ ...f, company: v }))}
                  testID="pilot-company" />
                <Input label="Role" placeholder="VP of Engineering"
                  value={form.role} onChangeText={(v) => setForm((f) => ({ ...f, role: v }))}
                  testID="pilot-role" />
                <Input label="Engineers hired per year" placeholder="20"
                  value={form.hiresPerYear} onChangeText={(v) => setForm((f) => ({ ...f, hiresPerYear: v }))}
                  keyboardType="numeric" testID="pilot-hires" />
                <Input label="Current screening tool (if any)" placeholder="Codility, HackerRank, take-homes…"
                  value={form.currentTool} onChangeText={(v) => setForm((f) => ({ ...f, currentTool: v }))}
                  testID="pilot-current-tool" />
                <Input label="Anything else we should know?" placeholder="Optional"
                  value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                  testID="pilot-notes" />
                {error && <Text style={[styles.errorText, { color: c.destructive }]} testID="pilot-error">{error}</Text>}
                <Button onPress={handleSubmit} disabled={submitting || !canSubmit} fullWidth
                  testID="pilot-submit">
                  {submitting ? 'Sending…' : 'Request Pilot'}
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}

interface RoiInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
}

function RoiInput({ label, value, onChange, min, max, step, prefix }: RoiInputProps) {
  const c = useColors();
  return (
    <View style={styles.roiInputRow}>
      <Text style={[styles.roiInputLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.roiInputControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          style={[styles.roiStepBtn, { borderColor: c.border }]}
          testID={`roi-dec-${label}`}
        >
          <Text style={{ color: c.text, fontSize: fontSizes.lg }}>−</Text>
        </Pressable>
        <Text style={[styles.roiInputValue, { color: c.text }]}>
          {prefix ?? ''}{value.toLocaleString()}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          style={[styles.roiStepBtn, { borderColor: c.border }]}
          testID={`roi-inc-${label}`}
        >
          <Text style={{ color: c.text, fontSize: fontSizes.lg }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#1a1816',
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },

  hero: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  heroInner: { maxWidth: 800, marginHorizontal: 'auto', alignItems: 'center', gap: spacing.lg },
  heroTitle: {
    fontSize: 44, fontWeight: '800', color: '#f5f3f0',
    textAlign: 'center', lineHeight: 52,
  },
  heroSub: {
    fontSize: fontSizes.md, color: 'rgba(232,228,223,0.8)',
    textAlign: 'center', lineHeight: 26, maxWidth: 720,
  },
  heroCtas: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },

  section: { paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  sectionTitle: {
    fontSize: 32, fontWeight: '700', textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionSub: {
    fontSize: fontSizes.md, textAlign: 'center', lineHeight: 24,
    maxWidth: 720, marginHorizontal: 'auto', marginBottom: spacing.xl,
  },

  problemGrid: {
    flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap',
    maxWidth: 1100, marginHorizontal: 'auto',
  },
  problemCard: { flex: 1, minWidth: 280, borderWidth: 1 },

  metricGrid: {
    flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap',
    maxWidth: 1000, marginHorizontal: 'auto',
  },
  metric: { flex: 1, minWidth: 220, padding: spacing.md, borderRadius: 8, borderWidth: 1 },
  metricLabel: { fontSize: fontSizes.sm, fontWeight: '700', marginBottom: spacing.xs },
  metricBody: { fontSize: fontSizes.sm, lineHeight: 20 },

  roiCard: { maxWidth: 720, marginHorizontal: 'auto', borderWidth: 1 },
  roiInputs: { gap: spacing.md, marginBottom: spacing.lg },
  roiInputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: spacing.sm,
  },
  roiInputLabel: { fontSize: fontSizes.sm, flex: 1, minWidth: 220 },
  roiInputControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  roiStepBtn: {
    width: 36, height: 36, borderWidth: 1, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  roiInputValue: { minWidth: 90, textAlign: 'center', fontSize: fontSizes.md, fontWeight: '600' },
  roiResult: {
    borderTopWidth: 1, paddingTop: spacing.lg, alignItems: 'center', gap: spacing.xs,
  },
  roiResultLabel: { fontSize: fontSizes.sm },
  roiResultValue: { fontSize: 48, fontWeight: '800' },
  roiResultNote: { fontSize: fontSizes.xs, textAlign: 'center', marginTop: spacing.xs },

  pilotCard: { maxWidth: 600, marginHorizontal: 'auto', borderWidth: 1 },
  formFields: { gap: spacing.md },
  errorText: { fontSize: fontSizes.sm, textAlign: 'center' },
  successTitle: { fontSize: fontSizes.lg, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'center' },
  successSub: { fontSize: fontSizes.sm, textAlign: 'center', lineHeight: 22 },
});
