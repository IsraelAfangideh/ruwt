/**
 * AI Nutrition Coach — chat interface with streaming responses.
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { useCoachChat } from '@/hooks/useCoachChat';

const QUICK_PROMPTS = [
  'What should I eat next?',
  'Am I on track today?',
  'Meal prep ideas for the week',
  'How can I hit my protein goal?',
];

export function CoachScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const { messages, streaming, sendMessage, clearChat } = useCoachChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (streaming) return;
    sendMessage(prompt);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: c.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>&#x2190; Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>AI Coach</Text>
        {messages.length > 0 && (
          <Pressable onPress={clearChat}>
            <Text style={[styles.clearText, { color: c.textMuted }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>&#x1F4AC; Nutrition Coach</Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Ask me anything about your nutrition, goals, or meal ideas.
              I can see your daily intake and targets.
            </Text>
            <View style={styles.quickPrompts}>
              {QUICK_PROMPTS.map((prompt, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleQuickPrompt(prompt)}
                  style={[styles.quickChip, { borderColor: c.border }]}
                >
                  <Text style={[styles.quickChipText, { color: c.accent }]}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === 'user'
                ? [styles.userBubble, { backgroundColor: c.accent }]
                : [styles.assistantBubble, { backgroundColor: c.card, borderColor: c.border }],
            ]}
          >
            <Text style={[
              styles.bubbleText,
              { color: msg.role === 'user' ? '#fff' : c.text },
            ]}>
              {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBar, { borderColor: c.border, backgroundColor: c.bgWarm }]}>
        <TextInput
          style={[styles.textInput, { color: c.text }]}
          placeholder="Ask your coach..."
          placeholderTextColor={c.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          editable={!streaming}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || streaming}
          style={[
            styles.sendBtn,
            { backgroundColor: c.accent },
            (!input.trim() || streaming) && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.sendBtnText}>&#x2191;</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
  },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  clearText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  messageList: { flex: 1 },
  messageContent: {
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  emptyDesc: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  quickPrompts: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    width: '100%',
    maxWidth: 320,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
  },
  bubble: {
    padding: spacing.md,
    borderRadius: radii.xl,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: radii.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderBottomLeftRadius: radii.sm,
  },
  bubbleText: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});
