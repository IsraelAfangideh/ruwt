import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';

interface CustomChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  skillTested: string | null;
  language: string;
  starterCode: string | null;
  testCases: string;
  hiddenTestCases: string | null;
  testHarness: string | null;
  status: string;
  aiGenerated: number;
  tags: string | null;
}

interface Props {
  challenge: CustomChallenge;
  orgId: string;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export function CustomChallengeReview({ challenge, orgId, onApprove, onDelete, compact }: Props) {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [expanded, setExpanded] = useState(!compact);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/challenges/${challenge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      /* istanbul ignore next -- @preserve */
      if (res.ok) onApprove(challenge.id); else setActionError('Failed to approve challenge');
    } catch { /* istanbul ignore next -- @preserve */ setActionError('Network error — could not approve'); }
    setApproving(false);
  }, [challenge.id, orgId, onApprove]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/challenges/${challenge.id}`, {
        method: 'DELETE',
      });
      /* istanbul ignore next -- @preserve */
      if (res.ok) onDelete(challenge.id); else setActionError('Failed to delete challenge');
    } catch { /* istanbul ignore next -- @preserve */ setActionError('Network error — could not delete'); }
    setDeleting(false);
    setConfirmDelete(false);
  }, [challenge.id, orgId, onDelete]);

  let testCases: { input: string; expectedOutput: string }[] = [];
  try { testCases = JSON.parse(challenge.testCases); } catch {}

  let hiddenTestCases: { input: string; expectedOutput: string }[] = [];
  /* istanbul ignore next -- @preserve */
  try { hiddenTestCases = challenge.hiddenTestCases ? JSON.parse(challenge.hiddenTestCases) : []; } catch {}

  const difficultyColor = {
    easy: '#5a8a5a',
    medium: '#6b9bd2',
    hard: '#9a7b3c',
  }[challenge.difficulty] || c.textMuted;

  return (
    <Card style={[styles.card, { borderColor: challenge.status === 'draft' ? c.accent + '40' : c.border }]}>
      <CardHeader>
        <View style={styles.headerRow}>
          <View style={styles.badges}>
            {challenge.aiGenerated === 1 && (
              <Badge variant="outline" style={{ borderColor: c.accent + '40', backgroundColor: c.accent + '10' }}>
                <Text style={{ fontSize: 10, color: c.accent }}>AI Generated</Text>
              </Badge>
            )}
            <Badge variant="outline" style={{ borderColor: difficultyColor + '40', backgroundColor: difficultyColor + '10' }}>
              <Text style={{ fontSize: 10, color: difficultyColor }}>
                {challenge.difficulty.toUpperCase()}
              </Text>
            </Badge>
            <Badge variant="outline" style={{ borderColor: c.border }}>
              <Text style={{ fontSize: 10, color: c.textMuted }}>
                {challenge.status === 'draft' ? 'DRAFT' : challenge.status === 'active' ? 'APPROVED' : 'ARCHIVED'}
              </Text>
            </Badge>
          </View>
          {compact && (
            <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}>
              <Text style={{ fontSize: fontSizes.xs, color: c.accent }}>
                {expanded ? '\u25B2 Collapse' : '\u25BC Expand'}
              </Text>
            </Pressable>
          )}
        </View>
        <CardTitle>{challenge.title}</CardTitle>
        {challenge.skillTested && (
          <CardDescription>{challenge.skillTested}</CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent>
          {/* Description */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>Description</Text>
          <View style={[styles.codeBlock, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text style={[styles.codeText, { color: c.text }]} selectable>
              {challenge.description}
            </Text>
          </View>

          {/* Starter Code */}
          {challenge.starterCode && (
            <>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Starter Code ({challenge.language})</Text>
              <View style={[styles.codeBlock, { backgroundColor: '#1a1816', borderColor: c.border }]}>
                <Text style={[styles.codeText, { color: '#e8e4df' }]} selectable>
                  {challenge.starterCode}
                </Text>
              </View>
            </>
          )}

          {/* Test Cases */}
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            Test Cases ({testCases.length} visible, {hiddenTestCases.length} hidden)
          </Text>
          {testCases.slice(0, 5).map((tc, i) => (
            <View key={i} style={[styles.testCase, { borderColor: c.border }]}>
              <View style={styles.testRow}>
                <Text style={[styles.testLabel, { color: c.textMuted }]}>Input:</Text>
                <Text style={[styles.testValue, { color: c.text }]} numberOfLines={2}>{tc.input}</Text>
              </View>
              <View style={styles.testRow}>
                <Text style={[styles.testLabel, { color: c.textMuted }]}>Expected:</Text>
                <Text style={[styles.testValue, { color: c.success }]} numberOfLines={2}>{tc.expectedOutput}</Text>
              </View>
            </View>
          ))}
          {testCases.length > 5 && (
            <Text style={{ fontSize: fontSizes.xs, color: c.textMuted, fontStyle: 'italic', marginBottom: spacing.xs }}>
              +{testCases.length - 5} more test case{testCases.length - 5 !== 1 ? 's' : ''} not shown
            </Text>
          )}

          {/* Test Harness */}
          {challenge.testHarness && (
            <>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Test Harness</Text>
              <View style={[styles.codeBlock, { backgroundColor: '#1a1816', borderColor: c.border }]}>
                <Text style={[styles.codeText, { color: '#e8e4df' }]} selectable>
                  {challenge.testHarness}
                </Text>
              </View>
            </>
          )}

          {/* Try Challenge */}
          {challenge.starterCode && (
            <View style={{ marginTop: spacing.md }}>
              <Button variant="outline" onPress={() => navigation.navigate('Arena', { challengeId: challenge.id })}>
                Try Challenge
              </Button>
            </View>
          )}

          {/* Actions */}
          {actionError && (
            /* istanbul ignore next -- @preserve */
            <Text style={{ color: c.destructive, fontSize: fontSizes.xs, marginTop: spacing.sm }}>
              {actionError}
            </Text>
          )}
          {challenge.status === 'draft' && (
            <View style={styles.actions}>
              <Button onPress={handleApprove} disabled={approving}>
                {approving ? 'Approving...' : 'Approve Challenge'}
              </Button>
              {confirmDelete ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Button variant="outline" onPress={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                  <Pressable onPress={() => setConfirmDelete(false)} accessibilityRole="button" accessibilityLabel="Cancel delete">
                    <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Button variant="outline" onPress={() => setConfirmDelete(true)} disabled={deleting}>
                  Delete Draft
                </Button>
              )}
            </View>
          )}
        </CardContent>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  codeBlock: {
    padding: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  testCase: {
    borderWidth: 1,
    borderRadius: 6,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  testRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: 2 },
  testLabel: { fontSize: 11, fontWeight: '600', width: 60 },
  testValue: { fontSize: 11, flex: 1, fontFamily: 'monospace' },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
