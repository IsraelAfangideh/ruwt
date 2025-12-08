import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types/chat';

export default function MessageBubble({ item }: { item: Message }) {
  
  const handleCopy = async () => {
    await Clipboard.setStringAsync(item.text);
    Alert.alert('Copied', 'Message copied to clipboard');
    item.onAction?.('copy');
  };

  return (
    <View style={[
      styles.container, 
      item.sender === 'user' ? styles.userContainer : styles.runnerContainer
    ]}>
      <View style={[
        styles.bubble,
        item.sender === 'user' ? styles.userBubble : styles.runnerBubble,
        item.isActionable && styles.actionableBubble
      ]}>
        <Text style={[
          styles.messageText,
          item.sender === 'user' ? styles.userText : styles.runnerText
        ]}>{item.text}</Text>

        {/* Action Buttons for Rewrite Bubbles */}
        {item.isActionable && (
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => item.onAction?.('send')}>
                    <Text style={styles.actionBtnText}>Send This</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleCopy}>
                    <Text style={styles.actionBtnTextSecondary}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnDestructive} onPress={() => item.onAction?.('kinder')}>
                    <Text style={styles.actionBtnTextDestructive}>Make Kinder</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    width: '100%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  runnerContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2,
  },
  runnerBubble: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 2,
  },
  actionableBubble: {
    backgroundColor: '#E8F2FF', // Light blue/distinctive for rewrites
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  userText: { color: '#fff' },
  runnerText: { color: '#000' },

  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
    flexWrap: 'wrap'
  },
  actionBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  actionBtnSecondary: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  actionBtnDestructive: {
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnTextSecondary: { color: '#333', fontSize: 13, fontWeight: '600' },
  actionBtnTextDestructive: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },
});
