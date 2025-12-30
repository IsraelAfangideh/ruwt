import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../../types/chat';
import { useColors } from '../../theme';

type Props = {
  item: Message;
  actionButtons?: React.ReactNode;
};

export default function BaseBubble({ item, actionButtons }: Props) {
  const colors = useColors();
  const isUser = item.sender === 'user';

  return (
    <View 
      style={[
        styles.container, 
        isUser ? styles.userContainer : styles.runnerContainer
      ]}
      testID={item.id === 'init' ? 'initial-message' : `message-${item.id}`}
    >
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

        {/* Action Buttons - provided by runner-specific components */}
        {item.isActionable && actionButtons && (
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            {actionButtons}
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
});

