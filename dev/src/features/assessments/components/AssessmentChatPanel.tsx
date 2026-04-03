import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily } from '@/shared/theme/tokens';
import { useAssessmentAgent, TOOL_SUCCESS_LABELS } from '@/features/assessments/hooks/useAssessmentAgent';
import { useToast } from '@/shared/ui/Toast';
import { renderMarkdown } from '@/features/shared-ide/components/ChatMarkdown';
import { ASSESSMENT_TEMPLATES, type AssessmentTemplate } from '@/features/assessments/assessment-templates';
import type { PassThreshold } from '@/features/assessments/components/PassThresholdEditor';

interface Props {
  assessmentId?: string;
  isEditing: boolean;
  onChallengesChanged: () => void;
  onWeightsChanged: (weights: Record<string, number>) => void;
  onBrandingChanged: (fields: Record<string, string>) => void;
  onTimeLimitChanged: (minutes: number) => void;
  onThresholdChanged: (threshold: PassThreshold) => void;
  onCustomChallengeCreated: () => void;
  onAssessmentCreated: (assessmentId: string) => void;
  onApplyTemplate: (template: AssessmentTemplate) => void;
}

/** Detect option-like patterns in the last assistant message for quick-reply buttons. */
export function extractQuickReplies(content: string): string[] {
  const replies: string[] = [];
  // Match "Option A:", "Option B:", etc. (case-insensitive)
  const optionRegex = /\b(Option\s+[A-C])\s*:/gi;
  let match;
  while ((match = optionRegex.exec(content)) !== null) {
    // Normalize to "Option X" format
    const letter = match[1].slice(-1).toUpperCase();
    const label = `Option ${letter}`;
    if (!replies.includes(label)) replies.push(label);
  }
  return replies;
}

const SUGGESTED_PROMPTS = [
  { label: 'Analyze a job description', prompt: 'I\'d like to create an assessment. Here\'s the job description:\n\n', requiresAssessment: false },
  { label: 'Suggest challenges for a role', prompt: 'Suggest challenges for a senior full-stack engineer role', requiresAssessment: false },
  { label: 'Create a custom challenge', prompt: 'Create a custom coding challenge that tests real-world skills for our team', requiresAssessment: false },
  { label: 'Optimize score weights', prompt: 'Based on the current assessment, what score weights do you recommend and why?', requiresAssessment: true },
];

export function AssessmentChatPanel({
  assessmentId,
  isEditing,
  onChallengesChanged,
  onWeightsChanged,
  onBrandingChanged,
  onTimeLimitChanged,
  onThresholdChanged,
  onCustomChallengeCreated,
  onAssessmentCreated,
  onApplyTemplate,
}: Props) {
  const c = useColors();
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const msgIdRef = useRef(0);

  const handleToolResult = useCallback((tool: string, result: any) => {
    if (!result.success) return;
    // Fire toast using existing label map
    const labelFn = TOOL_SUCCESS_LABELS[tool];
    if (labelFn) showToast(labelFn(result.result), 'success');
    switch (tool) {
      case 'select_challenges':
      case 'remove_challenges':
        onChallengesChanged();
        break;
      case 'set_weights':
        onWeightsChanged(result.result);
        break;
      case 'set_branding':
        onBrandingChanged(result.result);
        break;
      case 'set_time_limit':
        onTimeLimitChanged(result.result.minutes);
        break;
      case 'set_pass_threshold':
        onThresholdChanged(result.result);
        break;
      case 'create_custom_challenge':
        onCustomChallengeCreated();
        break;
    }
  }, [onChallengesChanged, onWeightsChanged, onBrandingChanged, onTimeLimitChanged, onThresholdChanged, onCustomChallengeCreated, showToast]);

  const { messages, sendMessage, streaming, streamingStatus, clearHistory, abort } = useAssessmentAgent({
    assessmentId,
    onToolResult: handleToolResult,
    onAssessmentCreated,
  });

  // Rotating thinking verbs (à la Claude Code)
  const THINKING_VERBS = [
    'Thinking...', 'Analyzing...', 'Reasoning...', 'Considering...',
    'Evaluating...', 'Pondering...', 'Processing...', 'Deliberating...',
    'Assembling...', 'Strategizing...', 'Examining...', 'Formulating...',
  ];
  const [thinkingVerb, setThinkingVerb] = useState(THINKING_VERBS[0]);
  useEffect(() => {
    if (!streaming || streamingStatus !== 'Thinking...') return;
    let idx = 0;
    setThinkingVerb(THINKING_VERBS[0]);
    /* istanbul ignore next -- @preserve */
    const timer = setInterval(() => {
      /* istanbul ignore next -- @preserve */
      idx = (idx + 1) % THINKING_VERBS.length;
      /* istanbul ignore next -- @preserve */
      setThinkingVerb(THINKING_VERBS[idx]);
    }, 2000);
    return () => clearInterval(timer);
  }, [streaming, streamingStatus]);
  const displayStatus = streamingStatus === 'Thinking...' ? thinkingVerb : streamingStatus;

  // Stable message keys
  const msgKeyMap = useRef(new WeakMap<object, number>());
  const getMsgKey = useCallback((msg: object) => {
    if (!msgKeyMap.current.has(msg)) {
      msgKeyMap.current.set(msg, ++msgIdRef.current);
    }
    return msgKeyMap.current.get(msg)!;
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    /* istanbul ignore next -- @preserve */
    if (!text || streaming) return;
    setInput('');
    sendMessage(text);
  }, [input, streaming, sendMessage]);

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleTemplateClick = useCallback((template: AssessmentTemplate) => {
    // Apply template settings directly (instant, reliable — no AI needed)
    onApplyTemplate(template);
    // Send a summary to the AI so it knows the context for follow-up questions
    sendMessage(`I applied the ${template.name} template with these ${template.challengeTitles.length} challenges: ${template.challengeTitles.join(', ')}. Time limit: ${template.timeLimitMinutes} minutes. Review it and make any improvements directly — swap challenges, adjust weights, or change the time limit as you see fit.`);
  }, [onApplyTemplate, sendMessage]);

  /* istanbul ignore next -- @preserve: RNW onKeyPress nativeEvent not reachable via testing-library */
  const handleKeyPress = useCallback((e: any) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const showEmpty = messages.length === 0;

  // Memoize quick-reply extraction so regex only runs when last message changes
  const lastAssistantContent = !streaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant'
    ? messages[messages.length - 1].content : null;
  const quickReplyButtons = useMemo(() => {
    if (!lastAssistantContent) return null;
    const quickReplies = extractQuickReplies(lastAssistantContent);
    const endsWithQuestion = /\?\s*$/.test(lastAssistantContent.trim());
    if (quickReplies.length === 0 && !endsWithQuestion) return null;
    return { quickReplies, showApplyAll: endsWithQuestion && quickReplies.length === 0 };
  }, [lastAssistantContent]);

  return (
    <View style={[styles.container, { backgroundColor: c.bgWarm }]}>
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
              <Pressable onPress={() => { clearHistory(); setConfirmClear(false); }} accessibilityRole="button" accessibilityLabel="Confirm clear chat history">
                <Text style={{ fontSize: fontSizes.xs, color: c.destructive, fontWeight: '600' }}>Confirm</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmClear(false)} accessibilityRole="button" accessibilityLabel="Cancel clear">
                <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmClear(true)} accessibilityRole="button" accessibilityLabel="Clear chat history">
              <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>Clear</Text>
            </Pressable>
          )
        )}
      </View>

      {/* Messages / Empty state */}
      <ScrollView ref={scrollRef} style={styles.messageArea} contentContainerStyle={styles.messageContent}>
        {showEmpty ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              Build your assessment with AI
            </Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Paste a job description, describe your ideal candidate, or pick a template below.
            </Text>

            {/* Template suggestions (only for new assessments) */}
            {!isEditing && (
              <View style={styles.templateSection}>
                <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Quick Start</Text>
                <View style={styles.templateGrid}>
                  {ASSESSMENT_TEMPLATES.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => handleTemplateClick(t)}
                      accessibilityRole="button"
                      style={[styles.templateBtn, { borderColor: c.border, backgroundColor: c.bg }]}
                    >
                      <Text style={[styles.templateName, { color: c.text }]}>{t.name}</Text>
                      <Text style={{ fontSize: fontSizes.xs, color: c.textMuted }}>
                        {t.challengeTitles.length} challenges · {t.timeLimitMinutes} min
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Suggested prompts */}
            <View style={styles.promptSection}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Or try</Text>
              <View style={styles.prompts}>
                {SUGGESTED_PROMPTS
                  .filter((p) => !p.requiresAssessment || assessmentId)
                  .map((p, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleSuggestedPrompt(p.prompt)}
                    accessibilityRole="button"
                    style={[styles.promptBtn, { borderColor: c.border, backgroundColor: c.bg }]}
                  >
                    <Text style={[styles.promptText, { color: c.accent }]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          messages.map((msg) => {
            const msgKey = getMsgKey(msg);
            if (msg.role === 'system') {
              const isError = msg.systemType === 'tool_error';
              const isCreated = msg.systemType === 'assessment_created';
              const chipColor = isError ? c.destructive : isCreated ? c.accent : c.success;
              return (
                <View
                  key={msgKey}
                  style={[styles.systemChip, { backgroundColor: chipColor + '12', borderColor: chipColor + '30' }]}
                >
                  <Text style={{ fontSize: fontSizes.xs, color: chipColor }}>
                    {isError ? '\u2717 ' : '\u2713 '}{msg.content}
                  </Text>
                </View>
              );
            }

            return (
              <View
                key={msgKey}
                style={[
                  styles.messageBubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: c.accent + '15' }]
                    : [styles.assistantBubble, { backgroundColor: c.bg }],
                ]}
              >
                <Text
                  style={[styles.roleLabel, { color: msg.role === 'user' ? c.accent : c.textMuted }]}
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
        {/* Quick-reply buttons from last assistant message */}
        {quickReplyButtons && (
          <View style={styles.quickReplyRow}>
            {quickReplyButtons.quickReplies.map((label) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => sendMessage(label)}
                style={[styles.quickReplyBtn, { borderColor: c.accent + '50', backgroundColor: c.accent + '10' }]}
              >
                <Text style={[styles.quickReplyText, { color: c.accent }]}>{label}</Text>
              </Pressable>
            ))}
            {quickReplyButtons.showApplyAll && (
              <Pressable
                accessibilityRole="button"
                onPress={/* istanbul ignore next -- @preserve */ () => sendMessage('Apply all')}
                style={[styles.quickReplyBtn, { borderColor: c.accent + '50', backgroundColor: c.accent + '10' }]}
              >
                <Text style={[styles.quickReplyText, { color: c.accent }]}>Apply all</Text>
              </Pressable>
            )}
          </View>
        )}
        {streaming && (
          <View style={styles.streamingIndicator}>
            <Text style={{ color: c.accent, fontSize: fontSizes.xs }}>{displayStatus}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputArea, { borderTopColor: c.border }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
          placeholder="Describe the role or paste a job description..."
          placeholderTextColor={c.textSubtle}
          value={input}
          onChangeText={setInput}
          onKeyPress={handleKeyPress}
          multiline
          numberOfLines={2}
          editable={!streaming}
        />
        {streaming ? (
          <Button size="sm" variant="outline" onPress={abort}>
            Stop
          </Button>
        ) : (
          <Button size="sm" onPress={handleSend} disabled={!input.trim()}>
            Send
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
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
  messageArea: { flex: 1, minHeight: 0 },
  messageContent: { padding: spacing.md, gap: spacing.sm },
  emptyState: { paddingVertical: spacing.xl, paddingHorizontal: spacing.sm },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  emptyDesc: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: fontFamily.body,
  },
  templateSection: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'uppercase' as any, marginBottom: spacing.sm },
  templateGrid: { gap: spacing.sm },
  templateBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
  },
  templateName: { fontSize: fontSizes.sm, fontWeight: '600', marginBottom: 2 },
  promptSection: {},
  prompts: { gap: spacing.sm },
  promptBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 8,
  },
  promptText: { fontSize: fontSizes.sm, fontWeight: '500' },
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
  quickReplyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.xs },
  quickReplyBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  quickReplyText: { fontSize: fontSizes.xs, fontWeight: '600' },
  streamingIndicator: { alignSelf: 'flex-start', padding: spacing.xs },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
    flexShrink: 0,
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
