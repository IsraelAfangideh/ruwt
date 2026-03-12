/**
 * Reusable AI text input with sparkle icon and submit button.
 * Used for meal parsing, coach chat, and workout generation.
 */
import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

interface AIInputProps {
  placeholder?: string;
  onSubmit: (text: string) => void;
  loading?: boolean;
  buttonLabel?: string;
  multiline?: boolean;
}

export function AIInput({ placeholder, onSubmit, loading, buttonLabel = 'Parse with AI', multiline = true }: AIInputProps) {
  const c = useColors();
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
  };

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.inputRow}>
        <Text style={styles.sparkle}>&#x2728;</Text>
        <TextInput
          style={[
            styles.input,
            { color: c.text },
            multiline && styles.multiline,
          ]}
          placeholder={placeholder || 'Describe your meal...'}
          placeholderTextColor={c.textMuted}
          value={text}
          onChangeText={setText}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          onSubmitEditing={!multiline ? handleSubmit : undefined}
        />
      </View>
      <Pressable
        onPress={handleSubmit}
        disabled={!text.trim() || loading}
        style={[
          styles.button,
          { backgroundColor: c.accent },
          (!text.trim() || loading) && { opacity: 0.5 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sparkle: {
    fontSize: 20,
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
    padding: 0,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  button: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
});
