import React from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

type Props = {
  input: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
};

export default function ChatInput({ input, isLoading, onChangeText, onSend }: Props) {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={onChangeText}
        placeholder="Type a message..."
        editable={!isLoading}
      />
      <TouchableOpacity 
        style={styles.sendButton} 
        onPress={onSend}
        disabled={isLoading || !input.trim()}
      >
         {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#000',
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sendText: { color: '#fff', fontWeight: 'bold' },
});

