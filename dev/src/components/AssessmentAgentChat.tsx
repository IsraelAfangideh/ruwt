import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { useAssessmentAgent } from '@/hooks/useAssessmentAgent';
import { renderMarkdown } from '@/components/arena/ChatMarkdown';
import type { PassThreshold } from '@/components/PassThresholdEditor';

interface Props {
  assessmentId?: string;
  onChallengesChanged?: () => void;
  onWeightsChanged?: (weights: Record<string, number>) => void;
  onBrandingChanged?: (fields: Record<string, string>) => void;
  onTimeLimitChanged?: (minutes: number) => void;
  onThresholdChanged?: (threshold: PassThreshold) => void;
  onCustomChallengeCreated?: (challenge: { id: string; title: string }) => void;
  onAssessmentCreated?: (assessmentId: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Analyze a job description', prompt: 'I\'d like to create an assessment. Let me paste the job description:', requiresAssessment: false },
  { label: 'Suggest challenges for a role', prompt: 'Suggest challenges for a ', requiresAssessment: false },
  { label: 'Create a custom challenge', prompt: 'Create a custom challenge for our team. Our domain is ', requiresAssessment: false },
  { label: 'Optimize score weights', prompt: 'Based on the current assessment, what score weights do you recommend and why?', requiresAssessment: true },
];

export function AssessmentAgentChat({
  assessmentId,
  onChallengesChanged,
  onWeightsChanged,
  onBrandingChanged,
  onTimeLimitChanged,
  onThresholdChanged,
  onCustomChallengeCreated,
  onAssessmentCreated,
}: Props) {
  const c = useColors();
  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<any>(null);

  const handleToolResult = useCallback((tool: string, result: any) => {
    if (!result.success) return;

    switch (tool) {
      case 'select_challenges':
      case 'remove_challenges':
        onChallengesChanged?.();
        break;
      case 'set_weights':
        onWeightsChanged?.(result.result);
        break;
      case 'set_branding':
        onBrandingChanged?.(result.result);
        break;
      case 'set_time_limit':
        onTimeLimitChanged?.(result.result.minutes);
        break;
      case 'set_pass_threshold':
        onThresholdChanged?.(result.result);
        break;
      case 'create_custom_challenge':
        onCustomChallengeCreated?.(result.result);
        break;
    }
  }, [onChallengesChanged, onWeightsChanged, onBrandingChanged, onTimeLimitChanged, onThresholdChanged, onCustomChallengeCreated]);

  const { messages, sendMessage, streaming, streamingStatus, clearHistory } = useAssessmentAgent({
    assessmentId,
    onToolResult: handleToolResult,
    onAssessmentCreated,
  });

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    sendMessage(text);
  }, [input, streaming, sendMessage]);

  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  const handleKeyPress = useCallback((e: any) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <View style={[styles.container, { backgroundColor: c.bgWarm, borderColor: c.border }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: c.text }]}>AI Assistant</Text>
          <Badge variant="outline" style={{ borderColor: c.accent + '40' }}>
            <Text style={{ fontSize: 10, color: c.accent }}>BETA</Text>
          </Badge>
        </View>
        {messages.length > 0 && (
          confirmClear ? (
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Pressable onPress={() => { clearHistory(); setConfirmClear(false); }}>
                <Text style={{ fontSize: fontSizes.xs, color: c.destructive, fontWeight: '600' }}>Confirm</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmClear(false)}>
                <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmClear(true)}>
              <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Clear</Text>
            </Pressable>
          )
        )}
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={styles.messageArea} contentContainerStyle={styles.messageContent}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              Build assessments with AI
            </Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Paste a job description, describe your ideal candidate, or ask me to create custom challenges for your domain.
            </Text>
            <View style={styles.quickActions}>
              {QUICK_ACTIONS
                .filter((action) => !action.requiresAssessment || assessmentId)
                .map((action, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleQuickAction(action.prompt)}
                  style={[styles.quickActionBtn, { borderColor: c.border, backgroundColor: c.bg }]}
                >
                  <Text style={[styles.quickActionText, { color: c.accent }]}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg, i) => {
            // System messages render as compact chips
            if (msg.role === 'system') {
              const isError = msg.systemType === 'tool_error';
              const isCreated = msg.systemType === 'assessment_created';
              const chipColor = isError ? c.destructive : isCreated ? c.accent : c.success;
              return (
                <View
                  key={i}
                  style={[
                    styles.systemChip,
                    { backgroundColor: chipColor + '12', borderColor: chipColor + '30' },
                  ]}
                >
                  <Text style={{ fontSize: fontSizes.xs, color: chipColor }}>
                    {isError ? '\u2717 ' : '\u2713 '}{msg.content}
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={i}
                style={[
                  styles.messageBubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: c.accent + '15' }]
                    : [styles.assistantBubble, { backgroundColor: c.bg }],
                ]}
              >
                <Text
                  style={[
                    styles.roleLabel,
                    { color: msg.role === 'user' ? c.accent : c.textMuted },
                  ]}
                >
                  {msg.role === 'user' ? 'You' : 'AI'}
                </Text>
                {msg.role === 'assistant' ? (
                  <div style={{ color: c.text, fontSize: fontSizes.sm, lineHeight: '20px', fontFamily: fontFamily.body }}>
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <Text style={[styles.messageText, { color: c.text }]} selectable>
                    {msg.content}
                  </Text>
                )}
              </View>
            );
          })
        )}
        {streaming && (
          <View style={styles.streamingIndicator}>
            <Text style={{ color: c.accent, fontSize: fontSizes.xs }}>{streamingStatus}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputArea, { borderTopColor: c.border }]}>
        <TextInput
          style={[
            styles.input,
            { color: c.text, backgroundColor: c.bg, borderColor: c.border },
          ]}
          placeholder="Describe the role or paste a job description..."
          placeholderTextColor={c.textSubtle}
          value={input}
          onChangeText={setInput}
          onKeyPress={handleKeyPress}
          multiline
          numberOfLines={2}
          editable={!streaming}
        />
        <Button
          size="sm"
          onPress={handleSend}
          disabled={streaming || !input.trim()}
        >
          {streaming ? '...' : 'Send'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 300,
    maxHeight: 'calc(100vh - 140px)' as any,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: fontSizes.sm, fontWeight: '600' },
  messageArea: { flex: 1 },
  messageContent: { padding: spacing.md, gap: spacing.sm },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.xs },
  emptyDesc: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
  },
  quickActions: { gap: spacing.sm, width: '100%' },
  quickActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
  },
  quickActionText: { fontSize: fontSizes.sm, fontWeight: '500' },
  messageBubble: {
    padding: spacing.sm,
    borderRadius: 8,
    maxWidth: '85%',
  },
  userBubble: { alignSelf: 'flex-end' },
  assistantBubble: { alignSelf: 'flex-start' },
  systemChip: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase' as any },
  messageText: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fontFamily.body },
  streamingIndicator: { alignSelf: 'flex-start', padding: spacing.xs },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: fontSizes.sm,
    maxHeight: 80,
    minHeight: 40,
  },
});
