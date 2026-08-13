/**
 * AdminActivationScreen: visual surface for the first-session activation funnel.
 * Route: /admin/activation (data is admin-gated server-side; non-admins get 403).
 * Consumes GET /api/admin/analytics/activation. See ISR-21.
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/shared/ui/Card';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';
import { useDocumentMeta } from '@/shared/hooks/useDocumentMeta';

type ActivationData = {
  windowDays: number;
  firstSessionDefinition: string;
  headline: { metric: string; value: number; target: number; meetsTarget: boolean };
  funnel: {
    signups: number;
    openedChallenge: number;
    usedAiOnFirstAttempt: number;
    passedFirstSession: number;
    returnedAfterFirstSession: number;
  };
  rates: { firstSessionPassRate: number; openRate: number; aiUseRateOfOpeners: number; returnRate: number };
  weekly: { week: string; signups: number; passedFirstSession: number; firstSessionPassRate: number }[];
};

export function AdminActivationScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const [data, setData] = useState<ActivationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({ title: 'Activation Funnel', description: 'First-session activation metrics' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/analytics/activation?days=30');
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 403 ? 'Admin access required.' : `Failed to load (${res.status}).`);
          setLoading(false);
          return;
        }
        setData(await res.json());
      } catch {
        if (!cancelled) setError('Something went wrong.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const s = styles(c);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={s.content}>
      <Pressable onPress={() => (navigation.navigate as any)('Dashboard')} style={s.back}>
        <Text style={{ color: c.textMuted, fontFamily: fontFamily.mono, fontSize: fontSizes.sm }}>&larr; Dashboard</Text>
      </Pressable>
      <Text style={s.h1}>Activation Funnel</Text>
      <Text style={s.sub}>First-session behaviour of new signups · last {data?.windowDays ?? 30} days</Text>

      {loading && <View style={s.center}><ActivityIndicator size="large" color={c.accent} /></View>}
      {!loading && error && (
        <Card><CardContent><Text style={{ color: c.textMuted, padding: spacing.md }}>{error}</Text></CardContent></Card>
      )}

      {!loading && data && (
        <>
          {/* Headline */}
          <Card style={{ borderColor: data.headline.meetsTarget ? c.success : c.accent, borderWidth: 1, borderLeftWidth: 4 }}>
            <CardHeader>
              <CardTitle>First-session pass-rate</CardTitle>
              <CardDescription>{data.firstSessionDefinition}</CardDescription>
            </CardHeader>
            <CardContent>
              <View style={s.headlineRow}>
                <Text style={[s.big, { color: data.headline.meetsTarget ? c.success : c.accent }]}>
                  {`${data.headline.value}%`}
                </Text>
                <View style={[s.badge, { backgroundColor: data.headline.meetsTarget ? c.successBg : c.accentBg }]}>
                  <Text style={{ color: data.headline.meetsTarget ? c.success : c.accent, fontSize: fontSizes.xs, fontWeight: '700' }}>
                    Target {data.headline.target}% · {data.headline.meetsTarget ? 'met' : 'below'}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Funnel */}
          <Card>
            <CardHeader><CardTitle>The funnel</CardTitle></CardHeader>
            <CardContent style={{ gap: spacing.md }}>
              {funnelSteps(data).map((step) => (
                <View key={step.label} style={{ gap: 4 }}>
                  <View style={s.stepRow}>
                    <Text style={s.stepLabel}>{step.label}</Text>
                    <Text style={s.stepValue}>{step.value}{step.hint ? <Text style={s.stepHint}>  ·  {step.hint}</Text> : null}</Text>
                  </View>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${step.widthPct}%`, backgroundColor: c.accent }]} />
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>

          {/* Weekly trend */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly first-session pass-rate</CardTitle>
              <CardDescription>Watch this rise after the entry-challenge fix ships.</CardDescription>
            </CardHeader>
            <CardContent style={{ gap: spacing.sm }}>
              {data.weekly.length === 0 && <Text style={{ color: c.textMuted }}>No signups in window.</Text>}
              {data.weekly.map((w) => (
                <View key={w.week} style={s.weekRow}>
                  <Text style={s.weekLabel}>{w.week}</Text>
                  <View style={s.weekBarTrack}>
                    <View style={[s.barFill, { width: `${w.firstSessionPassRate}%`, backgroundColor: c.accent }]} />
                  </View>
                  <Text style={s.weekValue}>{w.firstSessionPassRate}% ({w.passedFirstSession}/{w.signups})</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function funnelSteps(d: ActivationData) {
  const signups = d.funnel.signups || 1; // avoid /0 for bar width
  const w = (n: number) => Math.round((n / signups) * 100);
  return [
    { label: 'Signed up', value: d.funnel.signups, widthPct: 100, hint: '' },
    { label: 'Opened a challenge', value: d.funnel.openedChallenge, widthPct: w(d.funnel.openedChallenge), hint: `${d.rates.openRate}% of signups` },
    { label: 'Used AI on 1st attempt', value: d.funnel.usedAiOnFirstAttempt, widthPct: w(d.funnel.usedAiOnFirstAttempt), hint: `${d.rates.aiUseRateOfOpeners}% of openers` },
    { label: 'Passed (first session)', value: d.funnel.passedFirstSession, widthPct: w(d.funnel.passedFirstSession), hint: `${d.rates.firstSessionPassRate}% of signups` },
    { label: 'Returned after 24h', value: d.funnel.returnedAfterFirstSession, widthPct: w(d.funnel.returnedAfterFirstSession), hint: `${d.rates.returnRate}% of signups` },
  ];
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { paddingVertical: spacing.xs },
  h1: { color: c.text, fontFamily: fontFamily.display, fontSize: fontSizes['2xl'], fontWeight: '700' },
  sub: { color: c.textMuted, fontSize: fontSizes.sm, marginBottom: spacing.sm },
  center: { paddingVertical: spacing['2xl'], alignItems: 'center' },
  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  big: { fontFamily: fontFamily.display, fontSize: 56, fontWeight: '700', lineHeight: 60 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stepLabel: { color: c.text, fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  stepValue: { color: c.text, fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.mono },
  stepHint: { color: c.textMuted, fontSize: fontSizes.xs, fontWeight: '400' },
  barTrack: { height: 8, backgroundColor: c.border, borderRadius: radii.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radii.full },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekLabel: { color: c.textMuted, fontSize: fontSizes.xs, fontFamily: fontFamily.mono, width: 64 },
  weekBarTrack: { flex: 1, height: 8, backgroundColor: c.border, borderRadius: radii.full, overflow: 'hidden' },
  weekValue: { color: c.text, fontSize: fontSizes.xs, fontFamily: fontFamily.mono, width: 96, textAlign: 'right' },
});
