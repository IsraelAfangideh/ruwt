import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DetailCardSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/shared/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { getDifficultyStyle } from '@/shared/lib/difficulty';

interface AssessmentPreview {
  title: string;
  description: string | null;
  challengeCount: number;
  timeLimitMinutes: number;
  difficultyBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  expired: boolean;
  status?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  welcomeMessage?: string | null;
}

export function AssessmentLandingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  /* istanbul ignore next -- @preserve */
  const params = (route.params || {}) as { token: string };
  const token = params.token ?? '';
  const c = useColors();
  const supabase = createClient();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssessmentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoadingPreview(false);
      return;
    }
    fetch(`/api/assess/preview?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPreview(data);
        setLoadingPreview(false);
      })
      .catch(() => setLoadingPreview(false));
  }, [token]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    try {
      const res = await fetch('/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start assessment');
        setStarting(false);
        return;
      }

      navigation.navigate('AssessmentFlow', { sessionId: data.session.id });
    } catch (e) {
      /* istanbul ignore next -- @preserve */
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStarting(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.errorText, { color: c.destructive }]}>Invalid assessment link</Text>
      </View>
    );
  }

  if (loadingPreview) {
    return <DetailCardSkeleton />;
  }

  if (preview?.expired) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <View style={styles.container}>
          <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>This invite has expired</CardTitle>
              <CardDescription>
                Contact the person who sent you this link for a new one.
              </CardDescription>
            </CardHeader>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        {/* Company branding or Ruwt logo */}
        {preview?.companyLogoUrl ? (
          <View style={styles.brandingHeader}>
            <img
              src={preview.companyLogoUrl}
              alt={preview.companyName || 'Company'}
              style={{ maxHeight: 48, maxWidth: 200, objectFit: 'contain' }}
            />
            {preview.companyName && (
              <Text style={[styles.companyName, { color: c.text }]}>{preview.companyName}</Text>
            )}
          </View>
        ) : preview?.companyName ? (
          <Text style={[styles.companyName, { color: c.text }]}>{preview.companyName}</Text>
        ) : (
          <Text style={[styles.logo, { color: c.text }]}>Ruwt</Text>
        )}

        <Card style={styles.card}>
          <CardHeader>
            <Badge variant="secondary">AI-Efficiency Assessment</Badge>
            <CardTitle style={{ marginTop: spacing.sm }}>
              {preview?.title || "You've been invited to take an assessment"}
            </CardTitle>
            <CardDescription>
              {preview?.welcomeMessage || preview?.description ||
                'This assessment measures how efficiently you use AI to solve coding challenges. You\'ll be evaluated on model selection, prompt efficiency, and debugging strategy.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View style={styles.infoRows}>
              {preview && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: c.textMuted }]}>Challenges:</Text>
                    <Text style={[styles.infoValue, { color: c.text }]}>
                      {preview.challengeCount} coding challenge{preview.challengeCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: c.textMuted }]}>Time Limit:</Text>
                    <Text style={[styles.infoValue, { color: c.text }]}>
                      {preview.timeLimitMinutes} minutes
                    </Text>
                  </View>
                  {Object.keys(preview.difficultyBreakdown).length > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: c.textMuted }]}>Difficulty:</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                        {Object.entries(preview.difficultyBreakdown).map(([diff, count]) => {
                          const ds = getDifficultyStyle(diff);
                          return (
                            <Badge
                              key={diff}
                              variant="outline"
                              style={{ borderColor: ds.color, backgroundColor: ds.bg }}
                            >
                              <Text style={{ fontSize: fontSizes.xs, color: ds.color }}>
                                {count} {ds.label}
                              </Text>
                            </Badge>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textMuted }]}>How it works:</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>
                  You'll use AI models to help solve each challenge. Your cost efficiency matters — solve correctly at the lowest AI cost.
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: c.textMuted }]}>Scoring:</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>
                  Model selection, prompt efficiency, debugging strategy, and total cost are all tracked and compared.
                </Text>
              </View>
            </View>

            {error && (
              <Text style={[styles.errorText, { color: c.destructive, marginBottom: spacing.md }]}>
                {error}
              </Text>
            )}

            <Button size="lg" onPress={handleStart} disabled={starting} fullWidth>
              {starting ? 'Starting...' : 'Start Assessment'}
            </Button>
          </CardContent>
        </Card>

        {/* Powered by footer */}
        {(preview?.companyName || preview?.companyLogoUrl) && (
          <Text style={[styles.poweredBy, { color: c.textMuted }]}>
            Powered by Ruwt
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  logo: { fontSize: fontSizes.xl, fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.xl },
  card: { width: '100%' },
  infoRows: { gap: spacing.md, marginBottom: spacing.lg },
  infoRow: { gap: spacing.xs },
  infoLabel: { fontSize: fontSizes.sm, fontWeight: '600' },
  infoValue: { fontSize: fontSizes.sm },
  errorText: { fontSize: fontSizes.sm },
  brandingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  companyName: { fontSize: fontSizes['2xl'], fontWeight: '700', fontFamily: fontFamily.body, marginBottom: spacing.xl },
  poweredBy: { fontSize: fontSizes.xs, textAlign: 'center', marginTop: spacing.lg, fontFamily: fontFamily.body },
});
