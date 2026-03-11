import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { AssessmentChallengeList } from './AssessmentChallengeList';
import { AssessmentAdvancedSection } from './AssessmentAdvancedSection';
import { AssessmentInviteSection } from './AssessmentInviteSection';
import { CustomChallengeReview } from '@/components/CustomChallengeReview';
import type { AssessmentIDEState } from '@/hooks/useAssessmentIDEState';

type Props = Pick<AssessmentIDEState,
  | 'title' | 'description' | 'setTitle' | 'setDescription'
  | 'allChallenges' | 'selectedChallengeIds' | 'customChallenges' | 'orgId'
  | 'toggleChallenge' | 'setSelectedChallengeIds'
  | 'companyName' | 'companyLogoUrl' | 'welcomeMessage'
  | 'setCompanyName' | 'setCompanyLogoUrl' | 'setWelcomeMessage'
  | 'weights' | 'weightSum' | 'setWeights'
  | 'passThreshold' | 'setPassThreshold'
  | 'timeLimitMinutes' | 'setTimeLimitMinutes'
  | 'assessmentId' | 'status' | 'loadError'
  | 'inviteLink' | 'copied' | 'copyInviteLink' | 'handleGenerateInvite' | 'generatingInvite'
  | 'inviteRefreshKey' | 'handleInvitesSent'
  | 'handleApproveCustomChallenge' | 'handleDeleteCustomChallenge'
>;

export function AssessmentDocumentPanel(props: Props) {
  const c = useColors();

  const draftCustomChallenges = useMemo(
    () => props.customChallenges.filter((ch) => ch.status === 'draft'),
    [props.customChallenges]
  );
  const hasContent = props.title || props.selectedChallengeIds.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Empty state */}
      {!hasContent && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon, { color: c.textMuted }]}>{'\uD83D\uDCDD'}</Text>
          <Text style={[styles.emptyTitle, { color: c.textMuted }]}>
            Your assessment will appear here
          </Text>
          <Text style={[styles.emptyDesc, { color: c.textSubtle }]}>
            Use the AI chat to build your assessment, or fill in the fields below manually.
          </Text>
        </View>
      )}

      {/* Title & Description */}
      <View style={styles.section}>
        <Input
          label="Title"
          placeholder="e.g. Backend Developer Assessment"
          value={props.title}
          onChangeText={props.setTitle}
        />
        <Input
          label="Description (optional)"
          placeholder="Describe what this assessment evaluates"
          value={props.description}
          onChangeText={props.setDescription}
        />
      </View>

      {/* Challenge List */}
      <View style={styles.section}>
        <AssessmentChallengeList
          allChallenges={props.allChallenges}
          customChallenges={props.customChallenges}
          selectedChallengeIds={props.selectedChallengeIds}
          onToggle={props.toggleChallenge}
          onSelectAll={(ids) => props.setSelectedChallengeIds((prev) => [...new Set([...prev, ...ids])])}
          onClearAll={() => props.setSelectedChallengeIds([])}
          loadError={props.loadError}
        />
      </View>

      {/* Draft custom challenges to review */}
      {draftCustomChallenges.length > 0 && props.orgId && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.text }]}>
            AI-Generated Challenges ({draftCustomChallenges.length} pending review)
          </Text>
          <Text style={[styles.sectionHint, { color: c.textMuted }]}>
            Review and approve these challenges before adding them to your assessment.
          </Text>
          {draftCustomChallenges.map((ch) => (
            <CustomChallengeReview
              key={ch.id}
              challenge={ch}
              orgId={props.orgId!}
              onApprove={props.handleApproveCustomChallenge}
              onDelete={props.handleDeleteCustomChallenge}
              compact
            />
          ))}
        </View>
      )}

      {/* Advanced Settings */}
      <View style={styles.section}>
        <AssessmentAdvancedSection
          companyName={props.companyName}
          companyLogoUrl={props.companyLogoUrl}
          welcomeMessage={props.welcomeMessage}
          onCompanyNameChange={props.setCompanyName}
          onCompanyLogoUrlChange={props.setCompanyLogoUrl}
          onWelcomeMessageChange={props.setWelcomeMessage}
          weights={props.weights}
          weightSum={props.weightSum}
          onWeightsChange={props.setWeights}
          passThreshold={props.passThreshold}
          onPassThresholdChange={props.setPassThreshold}
          timeLimitMinutes={props.timeLimitMinutes}
          onTimeLimitChange={props.setTimeLimitMinutes}
        />
      </View>

      {/* Invite Section (active only) */}
      {props.assessmentId && props.status === 'active' && (
        <AssessmentInviteSection
          assessmentId={props.assessmentId}
          inviteLink={props.inviteLink}
          copied={props.copied}
          onCopyInviteLink={props.copyInviteLink}
          onGenerateInvite={props.handleGenerateInvite}
          generatingInvite={props.generatingInvite}
          inviteRefreshKey={props.inviteRefreshKey}
          onInvitesSent={props.handleInvitesSent}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  emptyIcon: { fontSize: 32, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.xs },
  emptyDesc: { fontSize: fontSizes.sm, textAlign: 'center', maxWidth: 300, fontFamily: fontFamily.body },
  section: { marginBottom: spacing.lg, gap: spacing.md },
  sectionLabel: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.md },
  sectionHint: { fontSize: fontSizes.sm, marginBottom: spacing.md, fontFamily: fontFamily.body },
});
