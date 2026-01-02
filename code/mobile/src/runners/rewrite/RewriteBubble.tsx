import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BaseBubble from '../../components/ui/BaseBubble';
import { Message } from '../../types/chat';
import { useColors } from '../../theme';

type Props = {
  item: Message;
  onMakeKinder?: (rewriteText: string) => void;
  isCopied?: boolean;
};

export default function RewriteBubble({ item, onMakeKinder, isCopied }: Props) {
  const colors = useColors();

  // Build action buttons for rewrite-specific actions
  const actionButtons = item.isActionable ? (
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

  return <BaseBubble item={item} actionButtons={actionButtons} />;
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

