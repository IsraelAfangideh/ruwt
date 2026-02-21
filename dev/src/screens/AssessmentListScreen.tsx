import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number;
  status: string;
  challengeCount: number;
  inviteCount: number;
  completionCount: number;
  createdAt: string;
  companyName?: string | null;
}

export function AssessmentListScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const supabase = createClient();
  const c = useColors();

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const res = await fetch('/api/assessments');
        if (res.ok) {
          const data = await res.json();
          setAssessments(data ?? []);
        }
      } catch (_) {
        setAssessments([]);
      }
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth]);

  const handleDuplicate = async (assessmentId: string) => {
    setDuplicating(assessmentId);
    try {
      // Fetch the original assessment with challenges
      const res = await fetch(`/api/assessments/${assessmentId}`);
      if (!res.ok) return;
      const original = await res.json();

      // Create a new assessment
      const createRes = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${original.title} (Copy)`,
          description: original.description || undefined,
          timeLimit: original.timeLimit,
        }),
      });
      if (!createRes.ok) return;
      const newAssessment = await createRes.json();

      // Copy challenges
      const challengeIds = (original.challenges ?? [])
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((ch: any) => ch.id);
      if (challengeIds.length > 0) {
        await fetch(`/api/assessments/${newAssessment.id}/challenges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeIds }),
        });
      }

      // Copy branding + weights if present
      const brandingUpdates: Record<string, unknown> = {};
      if (original.companyName) brandingUpdates.companyName = original.companyName;
      if (original.companyLogoUrl) brandingUpdates.companyLogoUrl = original.companyLogoUrl;
      if (original.welcomeMessage) brandingUpdates.welcomeMessage = original.welcomeMessage;
      if (original.categoryWeights) brandingUpdates.categoryWeights = original.categoryWeights;
      if (Object.keys(brandingUpdates).length > 0) {
        await fetch(`/api/assessments/${newAssessment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(brandingUpdates),
        });
      }

      // Navigate to the new assessment builder
      navigation.navigate('AssessmentBuilder', { assessmentId: newAssessment.id });
    } catch {}
    setDuplicating(null);
  };

  if (loading && !user) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const formatTime = (seconds: number) => {
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const statusColor = (status: string) => {
    if (status === 'active') return c.success;
    if (status === 'draft') return c.textMuted;
    return c.destructive;
  };

  return (
    <DashboardLayout user={user}>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.title, { color: c.text }]}>Assessments</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Create and manage AI-efficiency assessments for your candidates.
            </Text>
          </View>
          <Button onPress={() => navigation.navigate('AssessmentBuilder' as never)}>
            Create Assessment
          </Button>
        </View>
      </View>

      {assessments.length === 0 ? (
        <Card style={[styles.empty, { borderStyle: 'dashed', backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No Assessments Yet</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              Create your first assessment to start evaluating candidates.
            </Text>
            <Button
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate('AssessmentBuilder' as never)}
            >
              Create Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <View style={styles.grid}>
          {assessments.map((a) => (
            <Card key={a.id} style={[styles.card, { borderColor: c.border }]}>
              <CardHeader>
                <View style={styles.badgeRow}>
                  <Badge variant="outline" style={{ borderColor: statusColor(a.status) }}>
                    <Text style={[styles.statusText, { color: statusColor(a.status) }]}>
                      {a.status}
                    </Text>
                  </Badge>
                  {a.companyName && (
                    <Badge variant="outline" style={{ borderColor: c.accent }}>
                      <Text style={{ fontSize: fontSizes.xs, color: c.accent }}>{a.companyName}</Text>
                    </Badge>
                  )}
                </View>
                <CardTitle>{a.title}</CardTitle>
                <CardDescription>
                  {a.challengeCount} challenge{a.challengeCount !== 1 ? 's' : ''} · {formatTime(a.timeLimit)}
                </CardDescription>
                {(a.inviteCount > 0 || a.completionCount > 0) && (
                  <Text style={[styles.statsText, { color: c.textMuted }]}>
                    {a.inviteCount} invited · {a.completionCount} completed
                  </Text>
                )}
              </CardHeader>
              <CardFooter style={styles.cardFooter}>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    navigation.navigate('AssessmentBuilder', { assessmentId: a.id })
                  }
                  style={{ flex: 1 }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    navigation.navigate('AssessmentResultsDashboard', { assessmentId: a.id })
                  }
                  style={{ flex: 1 }}
                >
                  Results
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => handleDuplicate(a.id)}
                  disabled={duplicating === a.id}
                >
                  {duplicating === a.id ? '...' : 'Duplicate'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </View>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  empty: { borderWidth: 2 },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  card: { flex: 1, minWidth: 280 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  statusText: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  statsText: { fontSize: fontSizes.xs, marginTop: spacing.xs },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm },
});
