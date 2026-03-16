/**
 * Assessment IDE: Two-panel AI workspace for building assessments.
 * Mirrors ArenaIDE layout with react-resizable-panels.
 * Left: AI chat, Right: Assessment document.
 */
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Group, Panel } from 'react-resizable-panels';
import { PanelResizeBar } from '@/features/shared-ide/PanelResizeBar';
import { FormSkeleton } from '@/shared/ui/ScreenSkeletons';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';
import { useIsMobile } from '@/shared/lib/useIsMobile';
import { useAssessmentIDEState } from '@/features/assessments/useAssessmentIDEState';
import { AssessmentIDEHeader } from '@/features/assessments/AssessmentIDEHeader';
import { AssessmentActionBar } from '@/features/assessments/AssessmentActionBar';
import { AssessmentChatPanel } from '@/features/assessments/AssessmentChatPanel';
import { AssessmentDocumentPanel } from '@/features/assessments/AssessmentDocumentPanel';

type MobileTab = 'chat' | 'document';

// Panel children need explicit height since Panel doesn't set display:flex
const panelFill: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };

export function AssessmentIDEScreen() {
  const c = useColors();
  const isMobile = useIsMobile();
  const state = useAssessmentIDEState();
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  // Keyboard shortcut: Cmd+L → focus chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /* istanbul ignore next -- @preserve */
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        /* istanbul ignore next -- @preserve */
        if (isMobile) setMobileTab('chat');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile]);

  if (state.loading) {
    return <FormSkeleton />;
  }

  /* v8 ignore next */
  if (!state.user) return null;

  const chatPanel = (
    <AssessmentChatPanel
      assessmentId={state.assessmentId}
      isEditing={state.isEditing}
      onChallengesChanged={state.handleAgentChallengesChanged}
      onWeightsChanged={state.handleAgentWeightsChanged}
      onBrandingChanged={state.handleAgentBrandingChanged}
      onTimeLimitChanged={state.handleAgentTimeLimitChanged}
      onThresholdChanged={state.handleAgentThresholdChanged}
      onCustomChallengeCreated={state.handleCustomChallengeCreated}
      onAssessmentCreated={state.handleAgentAssessmentCreated}
      onApplyTemplate={state.applyTemplate}
    />
  );

  const documentPanel = (
    <AssessmentDocumentPanel
      title={state.title}
      description={state.description}
      setTitle={state.setTitle}
      setDescription={state.setDescription}
      allChallenges={state.allChallenges}
      selectedChallengeIds={state.selectedChallengeIds}
      customChallenges={state.customChallenges}
      orgId={state.orgId}
      toggleChallenge={state.toggleChallenge}
      setSelectedChallengeIds={state.setSelectedChallengeIds}
      companyName={state.companyName}
      companyLogoUrl={state.companyLogoUrl}
      welcomeMessage={state.welcomeMessage}
      setCompanyName={state.setCompanyName}
      setCompanyLogoUrl={state.setCompanyLogoUrl}
      setWelcomeMessage={state.setWelcomeMessage}
      weights={state.weights}
      weightSum={state.weightSum}
      setWeights={state.setWeights}
      passThreshold={state.passThreshold}
      setPassThreshold={state.setPassThreshold}
      timeLimitMinutes={state.timeLimitMinutes}
      setTimeLimitMinutes={state.setTimeLimitMinutes}
      assessmentId={state.assessmentId}
      status={state.status}
      loadError={state.loadError}
      inviteLink={state.inviteLink}
      copied={state.copied}
      copyInviteLink={state.copyInviteLink}
      handleGenerateInvite={state.handleGenerateInvite}
      generatingInvite={state.generatingInvite}
      inviteRefreshKey={state.inviteRefreshKey}
      handleInvitesSent={state.handleInvitesSent}
      handleApproveCustomChallenge={state.handleApproveCustomChallenge}
      handleDeleteCustomChallenge={state.handleDeleteCustomChallenge}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <AssessmentIDEHeader
        title={state.title}
        assessmentId={state.assessmentId}
        status={state.status}
        isEditing={state.isEditing}
        dirty={state.dirty}
      />

      {isMobile ? (
        /* ── Mobile: tab switcher ── */
        <View style={{ flex: 1 }}>
          <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
            {(['chat', 'document'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setMobileTab(tab)}
                accessibilityRole="button"
                style={[
                  styles.tab,
                  mobileTab === tab && [styles.tabActive, { borderBottomColor: c.accent }],
                ]}
              >
                <Text style={{
                  fontSize: fontSizes.sm,
                  fontWeight: mobileTab === tab ? '600' : '400',
                  color: mobileTab === tab ? c.accent : c.textMuted,
                }}>
                  {tab === 'chat' ? 'Chat' : 'Document'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {mobileTab === 'chat' ? chatPanel : documentPanel}
          </View>
        </View>
      ) : (
        /* ── Desktop: resizable panels ── */
        <Group orientation="horizontal" id="assessment-ide" style={styles.panelGroup}>
          <Panel defaultSize="40%" minSize="25%" id="chat-panel" style={panelFill}>
            {chatPanel}
          </Panel>
          <PanelResizeBar direction="horizontal" />
          <Panel defaultSize="60%" minSize="30%" id="document-panel" style={panelFill}>
            <View style={{ flex: 1 }}>
              {documentPanel}
              <AssessmentActionBar
                assessmentId={state.assessmentId}
                status={state.status}
                title={state.title}
                saving={state.saving}
                saveSuccess={state.saveSuccess}
                saveError={state.saveError}
                activating={state.activating}
                activateError={state.activateError}
                confirmActivate={state.confirmActivate}
                weightSum={state.weightSum}
                inviteError={state.inviteError}
                onSave={state.handleSave}
                onActivate={state.handleActivate}
                onSetConfirmActivate={state.setConfirmActivate}
              />
            </View>
          </Panel>
        </Group>
      )}

      {/* Mobile: action bar below both panels */}
      {isMobile && (
        <AssessmentActionBar
          assessmentId={state.assessmentId}
          status={state.status}
          title={state.title}
          saving={state.saving}
          saveSuccess={state.saveSuccess}
          saveError={state.saveError}
          activating={state.activating}
          activateError={state.activateError}
          confirmActivate={state.confirmActivate}
          weightSum={state.weightSum}
          inviteError={state.inviteError}
          onSave={state.handleSave}
          onActivate={state.handleActivate}
          onSetConfirmActivate={state.setConfirmActivate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100vh' as any,
  },
  panelGroup: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
});
