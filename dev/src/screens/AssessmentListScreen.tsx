import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CardGridSkeleton } from '@/components/ui/ScreenSkeletons';
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
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [orgInfo, setOrgInfo] = useState<{ id: string; name: string; role: string } | null>(null);
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

      const [assessmentsRes, orgsRes] = await Promise.all([
        fetch('/api/assessments').catch(() => null),
        fetch('/api/orgs').catch(() => null),
      ]);

      if (assessmentsRes?.ok) {
        const data = await assessmentsRes.json();
        setAssessments(data ?? []);
      }

      if (orgsRes?.ok) {
        const orgs = await orgsRes.json();
        if (orgs.length > 0) {
          setOrgInfo({ id: orgs[0].orgId, name: orgs[0].orgName, role: orgs[0].role });
        }
      }

      setLoading(false);
    };
    init();
  }, [navigation, supabase.auth]);

  const handleInvite = async (assessmentId: string) => {
    // If we already have a link for this assessment, just copy it
    /* istanbul ignore next -- @preserve UI replaces Generate button with link Pressable when cached; handleInvite is never re-called */
    if (inviteLinks[assessmentId]) {
      copyToClipboard(assessmentId, inviteLinks[assessmentId]);
      return;
    }

    setInviting(assessmentId);
    setInviteError(null);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || 'Failed to generate invite');
        setInviting(null);
        return;
      }
      const url = data.url as string;
      setInviteLinks((prev) => ({ ...prev, [assessmentId]: url }));
      copyToClipboard(assessmentId, url);
      // Update invite count locally
      setAssessments((prev) =>
        prev.map((a) => a.id === assessmentId ? { ...a, inviteCount: a.inviteCount + 1 } : a)
      );
    } catch {
      setInviteError('Failed to generate invite');
    }
    setInviting(null);
  };

  const copyToClipboard = (assessmentId: string, url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(assessmentId);
    /* istanbul ignore next -- @preserve */
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = async (assessmentId: string) => {
    setDuplicating(assessmentId);
    try {
      const res = await fetch(`/api/assessments/${assessmentId}`);
      if (!res.ok) return;
      const original = await res.json();

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

      navigation.navigate('AssessmentBuilder', { assessmentId: newAssessment.id });
    } catch {}
    setDuplicating(null);
  };

  if (loading) {
    return <CardGridSkeleton />;
  }

  /* istanbul ignore next -- @preserve */
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
    <DashboardLayout user={user} requireOrg>
      {/* Org banner */}
      {orgInfo && (
        <View style={[styles.orgBanner, { backgroundColor: c.accent + '08', borderColor: c.accent + '20' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSizes.sm, fontWeight: '600', color: c.text }}>
              {orgInfo.name}
            </Text>
            <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
              Team workspace {'\u00B7'} {orgInfo.role}
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('OrgManagement', { orgId: orgInfo.id })}
          >
            Manage Team
          </Button>
        </View>
      )}

      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.title, { color: c.text }]}>Assessments</Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Create and manage AI-efficiency assessments for your candidates.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {!orgInfo && (
              <Button
                variant="outline"
                onPress={() => navigation.navigate('OrgManagement' as never)}
              >
                Create Team
              </Button>
            )}
            <Button onPress={() => navigation.navigate('AssessmentBuilder' as never)}>
              Create Assessment
            </Button>
          </View>
        </View>
      </View>

      {inviteError && (
        <View style={[styles.errorBanner, { backgroundColor: c.destructive + '15', borderColor: c.destructive + '30' }]}>
          <Text style={[styles.errorText, { color: c.destructive }]}>{inviteError}</Text>
          <Pressable onPress={() => setInviteError(null)}>
            <Text style={{ color: c.destructive, fontWeight: '600' }}>{'\u2715'}</Text>
          </Pressable>
        </View>
      )}

      {assessments.length === 0 ? (
        <Card style={[styles.empty, { borderStyle: 'dashed', backgroundColor: c.muted + '20' }]}>
          <CardContent style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Get started in 3 steps</Text>
            <View style={styles.stepsRow}>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: c.accent }]}>{'\u2460'}</Text>
                <Text style={[styles.stepLabel, { color: c.text }]}>Create</Text>
                <Text style={[styles.stepDesc, { color: c.textMuted }]}>Build an assessment in minutes</Text>
              </View>
              <Text style={[styles.stepArrow, { color: c.textMuted }]}>{'\u2192'}</Text>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: c.accent }]}>{'\u2461'}</Text>
                <Text style={[styles.stepLabel, { color: c.text }]}>Invite</Text>
                <Text style={[styles.stepDesc, { color: c.textMuted }]}>Send a link to candidates</Text>
              </View>
              <Text style={[styles.stepArrow, { color: c.textMuted }]}>{'\u2192'}</Text>
              <View style={styles.step}>
                <Text style={[styles.stepNumber, { color: c.accent }]}>{'\u2462'}</Text>
                <Text style={[styles.stepLabel, { color: c.text }]}>Review</Text>
                <Text style={[styles.stepDesc, { color: c.textMuted }]}>See AI profiles, radar charts, and comparisons</Text>
              </View>
            </View>
            <Button
              style={{ marginTop: spacing.lg }}
              onPress={() => navigation.navigate('AssessmentBuilder' as never)}
            >
              Create Your First Assessment
            </Button>
            <Pressable
              onPress={() => navigation.navigate('AssessmentBuilder' as never)}
              style={{ marginTop: spacing.sm }}
            >
              <Text style={{ fontSize: fontSizes.sm, color: c.accent }}>
                Or start from a template {'\u2192'}
              </Text>
            </Pressable>
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

              {/* Invite link section for active assessments */}
              {a.status === 'active' && (
                <CardContent style={styles.inviteSection}>
                  {inviteLinks[a.id] ? (
                    <Pressable
                      onPress={() => copyToClipboard(a.id, inviteLinks[a.id])}
                      style={[styles.inviteLinkRow, { backgroundColor: c.muted + '20', borderColor: c.border }]}
                    >
                      <Text style={[styles.inviteLinkText, { color: c.textMuted }]} numberOfLines={1}>
                        {inviteLinks[a.id]}
                      </Text>
                      <Text style={[styles.copyLabel, { color: copiedId === a.id ? c.success : c.accent }]}>
                        {copiedId === a.id ? 'Copied!' : 'Copy'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onPress={() => handleInvite(a.id)}
                      disabled={inviting === a.id}
                      fullWidth
                    >
                      {inviting === a.id ? 'Generating...' : copiedId === a.id ? 'Copied!' : 'Generate Invite Link'}
                    </Button>
                  )}
                </CardContent>
              )}

              {a.status === 'draft' && (
                <CardContent style={styles.inviteSection}>
                  <Text style={[styles.draftHint, { color: c.textMuted }]}>
                    Activate this assessment in the builder to invite candidates.
                  </Text>
                </CardContent>
              )}

              <CardFooter style={[styles.cardFooter, { borderTopColor: c.border }]}>
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
  inviteSection: { paddingTop: 0 },
  inviteLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  inviteLinkText: { flex: 1, fontSize: fontSizes.xs, fontFamily: 'monospace' },
  copyLabel: { fontSize: fontSizes.xs, fontWeight: '600' },
  draftHint: { fontSize: fontSizes.xs, fontStyle: 'italic' },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: spacing.md,
  },
  errorText: { fontSize: fontSizes.sm },
  cardFooter: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm },
  orgBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  step: { alignItems: 'center', maxWidth: 160 },
  stepNumber: { fontSize: fontSizes['2xl'], marginBottom: spacing.xs },
  stepLabel: { fontSize: fontSizes.md, fontWeight: '600', marginBottom: 2 },
  stepDesc: { fontSize: fontSizes.xs, textAlign: 'center' },
  stepArrow: { fontSize: fontSizes.xl, marginTop: spacing.md },
});
