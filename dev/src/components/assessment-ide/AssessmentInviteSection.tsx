import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { BulkInvitePanel } from '@/components/BulkInvitePanel';
import { InviteManagementTable } from '@/components/InviteManagementTable';
import { useColors } from '@/theme';
import { spacing, fontSizes } from '@/theme/tokens';

interface Props {
  assessmentId: string;
  inviteLink: string | null;
  copied: boolean;
  onCopyInviteLink: () => void;
  onGenerateInvite: () => void;
  generatingInvite: boolean;
  inviteRefreshKey: number;
  onInvitesSent: () => void;
}

export function AssessmentInviteSection({
  assessmentId,
  inviteLink,
  copied,
  onCopyInviteLink,
  onGenerateInvite,
  generatingInvite,
  inviteRefreshKey,
  onInvitesSent,
}: Props) {
  const c = useColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: c.text }]}>Distribution</Text>

      {!inviteLink && (
        <Button variant="secondary" onPress={onGenerateInvite} disabled={generatingInvite}>
          {generatingInvite ? 'Generating...' : 'Generate Invite Link'}
        </Button>
      )}

      {inviteLink && (
        <Card style={[styles.inviteCard, { borderColor: c.accent }]}>
          <CardContent>
            <Text style={[styles.inviteLabel, { color: c.text }]}>Candidate Invite Link:</Text>
            <Text style={[styles.inviteUrl, { color: c.accent }]} selectable>
              {inviteLink}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm }}>
              <Button variant="outline" size="sm" onPress={onCopyInviteLink}>
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </View>
            <Text style={[styles.inviteHint, { color: c.textMuted }]}>
              Share this link with your candidate. They'll need to create an account to start.
            </Text>
          </CardContent>
        </Card>
      )}

      <BulkInvitePanel assessmentId={assessmentId} onInvitesSent={onInvitesSent} />
      <View style={{ marginTop: spacing.lg }}>
        <InviteManagementTable assessmentId={assessmentId} refreshKey={inviteRefreshKey} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.md },
  inviteCard: { borderWidth: 2, marginBottom: spacing.lg },
  inviteLabel: { fontWeight: '600', marginBottom: spacing.xs },
  inviteUrl: { fontSize: fontSizes.sm, fontFamily: 'monospace', marginBottom: spacing.sm },
  inviteHint: { fontSize: fontSizes.xs },
});
