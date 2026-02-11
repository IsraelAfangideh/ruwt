import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface CandidateResult {
  session: {
    id: string;
    status: string;
    totalCost: number;
    totalTokens: number;
    startedAt: string;
    completedAt: string | null;
    shareToken: string | null;
  };
  candidate: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  challengesPassed: number;
  totalChallenges: number;
}

export function AssessmentResultsDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { assessmentId: string };
  const c = useColors();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      try {
        const res = await fetch(`/api/assessments/${params.assessmentId}/results`);
        if (res.ok) setResults(await res.json());
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth, params.assessmentId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  const formatCost = (cost: number) => {
    const dollars = cost / 10000;
    return dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(2)}`;
  };

  return (
    <DashboardLayout user={user}>
      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate('Assessments' as never)}
        >
          ← Back to Assessments
        </Button>
        <Text style={[styles.title, { color: c.text }]}>Assessment Results</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {results.length} candidate{results.length !== 1 ? 's' : ''} have taken this assessment.
        </Text>
      </View>

      {results.length === 0 ? (
        <Card style={[styles.empty, { backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No Results Yet</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              Invite candidates to take this assessment.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <View style={styles.table}>
          <View style={[styles.tableHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.th, styles.thName, { color: c.textMuted }]}>Candidate</Text>
            <Text style={[styles.th, styles.thStatus, { color: c.textMuted }]}>Status</Text>
            <Text style={[styles.th, styles.thPassed, { color: c.textMuted }]}>Passed</Text>
            <Text style={[styles.th, styles.thCost, { color: c.textMuted }]}>Cost</Text>
            <Text style={[styles.th, styles.thTokens, { color: c.textMuted }]}>Tokens</Text>
          </View>
          {results
            .sort((a, b) => a.session.totalCost - b.session.totalCost)
            .map((r) => (
              <View key={r.session.id} style={[styles.tableRow, { borderBottomColor: c.border }]}>
                <Text style={[styles.td, styles.thName, { color: c.text }]} numberOfLines={1}>
                  {r.candidate.name || r.candidate.email}
                </Text>
                <View style={[styles.td, styles.thStatus]}>
                  <Badge
                    variant="outline"
                    style={{
                      borderColor:
                        r.session.status === 'completed' ? c.success : c.textMuted,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSizes.xs,
                        color:
                          r.session.status === 'completed' ? c.success : c.textMuted,
                      }}
                    >
                      {r.session.status}
                    </Text>
                  </Badge>
                </View>
                <Text style={[styles.td, styles.thPassed, { color: c.text }]}>
                  {r.challengesPassed}/{r.totalChallenges}
                </Text>
                <Text style={[styles.td, styles.thCost, { color: c.accent }]}>
                  {formatCost(r.session.totalCost)}
                </Text>
                <Text style={[styles.td, styles.thTokens, { color: c.textMuted }]}>
                  {r.session.totalTokens.toLocaleString()}
                </Text>
              </View>
            ))}
        </View>
      )}
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', fontFamily: fontFamily.body, marginTop: spacing.sm },
  subtitle: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  empty: { borderWidth: 1 },
  emptyContent: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  emptySub: { fontSize: fontSizes.sm, marginTop: spacing.xs },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  th: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'uppercase' },
  td: { fontSize: fontSizes.sm },
  thName: { flex: 3 },
  thStatus: { flex: 2 },
  thPassed: { flex: 1, textAlign: 'center' },
  thCost: { flex: 1, textAlign: 'right' },
  thTokens: { flex: 1, textAlign: 'right' },
});
