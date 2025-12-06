import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types/chat';

export default function MessageBubble({ item }: { item: Message }) {
  return (
    <View style={[
      styles.bubble, 
      item.sender === 'user' ? styles.userBubble : styles.runnerBubble
    ]}>
      <Text style={[
        styles.messageText,
        item.sender === 'user' ? styles.userText : styles.runnerText
      ]}>{item.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2,
  },
  runnerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 2,
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  userText: { color: '#fff' },
  runnerText: { color: '#000' },
});

