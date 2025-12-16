import React from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useColors } from '../theme';

type Props = {
  input: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
};

export default function ChatInput({ input, isLoading, onChangeText, onSend }: Props) {
  const colors = useColors();
  
  return (
    <View style={[styles.inputContainer, { 
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
    }]}>
      <TextInput
        style={[styles.input, {
          borderColor: colors.borderStrong,
          backgroundColor: colors.bg,
          color: colors.text,
        }]}
        value={input}
        onChangeText={onChangeText}
        placeholder="Type a message..."
        placeholderTextColor={colors.textSubtle}
        editable={!isLoading}
      />
      <TouchableOpacity 
        style={[styles.sendButton, { backgroundColor: colors.accent }]} 
        onPress={onSend}
        disabled={isLoading || !input.trim()}
      >
         {isLoading 
           ? <ActivityIndicator color={colors.userBubbleText} /> 
           : <Text style={[styles.sendText, { color: colors.userBubbleText }]}>Send</Text>
         }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  sendText: { 
    fontWeight: '600',
    fontSize: 15,
  },
});
