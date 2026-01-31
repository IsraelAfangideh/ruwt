/**
 * BaseBubble - A pure UI shell for chat message bubbles
 * 
 * This is a "dumb" component following the Shell & Slot pattern.
 * - Zero business logic
 * - Accepts slots for runner-specific content (actionButtons, userActionButtons)
 * - Runners decide WHAT to render, this handles HOW it looks
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Message } from '../../types/chat';
import { useColors } from '../../theme';

type Props = {
  item: Message;
  // Slot for runner message actions (e.g., Send, Copy, Make Kinder)
  actionButtons?: React.ReactNode;
  // Slot for user message actions (e.g., Repeat, Copy) - provided by runner
  userActionButtons?: React.ReactNode;
  // Interaction handlers
  onLongPress?: () => void;
  onPress?: () => void;
  // Visual state
  isSelected?: boolean;
};

export default function BaseBubble({ 
  item, 
  actionButtons,
  userActionButtons,
  onLongPress,
  onPress,
  isSelected,
}: Props) {
  const colors = useColors();
  const isUser = item.sender === 'user';
  const hasInteraction = isUser && (onLongPress || onPress);

  const bubbleContent = (
    <View style={[
      styles.bubble,
      !hasInteraction && styles.bubbleMaxWidth,
      isUser 
        ? [styles.userBubble, { backgroundColor: colors.userBubble }] 
        : [styles.runnerBubble, { backgroundColor: colors.runnerBubble }],
      item.isActionable && [styles.actionableBubble, { 
        backgroundColor: colors.bgElevated,
        borderColor: colors.accent,
      }],
      isSelected && [styles.selectedBubble, { borderColor: colors.accent }]
    ]}>
      <Text 
        style={[
          styles.messageText,
          isUser 
            ? { color: colors.userBubbleText } 
            : { color: colors.runnerBubbleText }
        ]}
        accessibilityLabel={item.id === 'init' ? 'Send me a message' : item.text}
        accessible={true}
      >{item.text}</Text>

      {/* Runner action buttons slot */}
      {item.isActionable && actionButtons && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {actionButtons}
        </View>
      )}
    </View>
  );

  // Handle context menu for web (right-click)
  const handleContextMenu = (e: any) => {
    if (Platform.OS === 'web' && onLongPress) {
      e.preventDefault();
      onLongPress();
    }
  };

  return (
    <View 
      style={[
        styles.container, 
        isUser ? styles.userContainer : styles.runnerContainer
      ]}
      testID={item.id === 'init' ? 'initial-message' : `message-${item.id}`}
    >
      {hasInteraction ? (
        <View style={styles.pressableWrapper}>
          <Pressable 
            onLongPress={onLongPress}
            onPress={onPress}
            delayLongPress={300}
            style={({ pressed }) => [
              pressed && !isSelected && { opacity: 0.7 }
            ]}
            // @ts-ignore - web-only prop
            onContextMenu={handleContextMenu}
          >
            {bubbleContent}
          </Pressable>
          {/* User action buttons slot - rendered by runner */}
          {userActionButtons}
        </View>
      ) : (
        bubbleContent
      )}
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
  pressableWrapper: {
    maxWidth: '85%',
    alignItems: 'flex-end',
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
  },
  bubbleMaxWidth: {
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
  selectedBubble: {
    borderWidth: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
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
    flexWrap: 'wrap',
  },
});
