import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types/chat';
import { useColors } from '../theme';

export default function MessageBubble({ item }: { item: Message }) {
  const colors = useColors();
  
  const handleCopy = async () => {
    await Clipboard.setStringAsync(item.text);
    Alert.alert('Copied', 'Message copied to clipboard');
    item.onAction?.('copy');
  };

  const isUser = item.sender === 'user';

  return (
    <View style={[
      styles.container, 
      isUser ? styles.userContainer : styles.runnerContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser 
          ? [styles.userBubble, { backgroundColor: colors.userBubble }] 
          : [styles.runnerBubble, { backgroundColor: colors.runnerBubble }],
        item.isActionable && [styles.actionableBubble, { 
          backgroundColor: colors.bgElevated,
          borderColor: colors.accent,
        }]
      ]}>
        <Text style={[
          styles.messageText,
          isUser 
            ? { color: colors.userBubbleText } 
            : { color: colors.runnerBubbleText }
        ]}>{item.text}</Text>

        {/* Action Buttons for Rewrite Bubbles */}
        {item.isActionable && (
            <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: colors.sendButton }]} 
                  onPress={() => item.onAction?.('send')}
                >
                    <Text style={[styles.actionBtnText, { color: colors.sendButtonText }]}>Send This</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtnSecondary, { 
                    backgroundColor: colors.copyButton,
                    borderColor: colors.copyButtonBorder,
                    borderWidth: 1,
                  }]} 
                  onPress={handleCopy}
                >
                    <Text style={[styles.actionBtnTextSecondary, { color: colors.copyButtonText }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtnDestructive, { 
                    backgroundColor: 'transparent',
                    borderColor: colors.kindButtonBorder,
                  }]} 
                  onPress={() => item.onAction?.('kinder')}
                >
                    <Text style={[styles.actionBtnTextDestructive, { color: colors.kindButtonText }]}>Make Kinder</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    width: '100%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  runnerContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
    maxWidth: '85%',
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  runnerBubble: {
    borderBottomLeftRadius: 4,
  },
  actionableBubble: {
    borderWidth: 1,
  },
  messageText: { 
    fontSize: 16, 
    lineHeight: 23,
  },

  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
    flexWrap: 'wrap'
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnDestructive: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnText: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  actionBtnTextSecondary: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  actionBtnTextDestructive: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
});
