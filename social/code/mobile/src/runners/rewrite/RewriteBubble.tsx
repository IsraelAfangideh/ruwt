/**
 * RewriteBubble - The "smart" runner-specific bubble component
 * 
 * This component contains the business logic for the Rewrite runner:
 * - Decides what action buttons to show for runner messages (Send, Copy, Make Kinder)
 * - Decides what action buttons to show for user messages (Repeat, Copy)
 * 
 * It imports BaseBubble (the shell) and injects runner-specific content.
 */
import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BaseBubble from '../../components/ui/BaseBubble';
import UserActionBar, { UserAction } from '../../components/ui/UserActionBar';
import { Message } from '../../types/chat';
import { useColors } from '../../theme';

type Props = {
  item: Message;
  onMakeKinder?: (rewriteText: string) => void;
  isCopied?: boolean;
  // User message interaction
  onUserLongPress?: (item: Message) => void;
  isSelected?: boolean;
  onRepeat?: () => void;
  onCopy?: () => void;
  onDismiss?: () => void;
};

export default function RewriteBubble({ 
  item, 
  onMakeKinder, 
  isCopied, 
  onUserLongPress,
  isSelected,
  onRepeat,
  onCopy,
  onDismiss,
}: Props) {
  const colors = useColors();
  const isUser = item.sender === 'user';

  // Runner message actions (Send, Copy, Make Kinder)
  const runnerActionButtons = item.isActionable ? (
    <>
      <TouchableOpacity 
        style={[styles.actionBtn, { backgroundColor: colors.sendButton }]} 
        onPress={() => item.onAction?.('send')}
      >
        <View style={styles.buttonContent}>
          <Feather name="send" size={14} color={colors.sendButtonText} />
          <Text style={[styles.actionBtnText, { color: colors.sendButtonText }]}>Send</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.actionBtnSecondary, { 
          backgroundColor: isCopied ? colors.successBg : colors.copyButton,
          borderColor: isCopied ? colors.success : colors.copyButtonBorder,
          borderWidth: 1,
        }]} 
        onPress={() => item.onAction?.('copy')}
        disabled={isCopied}
      >
        <View style={styles.buttonContent}>
          <Feather 
            name={isCopied ? 'check' : 'copy'} 
            size={14} 
            color={isCopied ? colors.success : colors.copyButtonText} 
          />
          <Text style={[styles.actionBtnTextSecondary, { color: isCopied ? colors.success : colors.copyButtonText }]}>
            {isCopied ? 'Copied' : 'Copy'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.actionBtnDestructive, { 
          backgroundColor: 'transparent',
          borderColor: colors.kindButtonBorder,
        }]} 
        onPress={() => onMakeKinder?.(item.text)}
      >
        <Text style={[styles.actionBtnTextDestructive, { color: colors.kindButtonText }]}>Make Kinder</Text>
      </TouchableOpacity>
    </>
  ) : undefined;

  // User message actions (Repeat, Copy) - only shown when selected
  const userActionButtons = isUser && isSelected && onDismiss ? (
    <UserActionBar
      actions={[
        {
          id: 'repeat',
          label: 'Repeat',
          icon: 'refresh-cw',
          color: 'accent',
          onPress: onRepeat || (() => {}),
        },
        {
          id: 'copy',
          label: 'Copy',
          activeLabel: 'Copied!',
          icon: isCopied ? 'check' : 'copy',
          color: 'success',
          onPress: onCopy || (() => {}),
          isActive: isCopied,
          disabled: isCopied,
        },
      ]}
      onDismiss={onDismiss}
    />
  ) : undefined;

  return (
    <BaseBubble 
      item={item} 
      actionButtons={runnerActionButtons}
      userActionButtons={userActionButtons}
      onLongPress={isUser && onUserLongPress ? () => onUserLongPress(item) : undefined}
      onPress={isSelected && onDismiss ? onDismiss : undefined}
      isSelected={isSelected}
    />
  );
}

const styles = StyleSheet.create({
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
