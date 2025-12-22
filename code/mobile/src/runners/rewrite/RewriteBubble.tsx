import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseBubble from '../../components/ui/BaseBubble';
import { Message } from '../../types/chat';
import { useColors } from '../../theme';

type Props = {
  item: Message;
  onMakeKinder?: (rewriteText: string) => void;
};

export default function RewriteBubble({ item, onMakeKinder }: Props) {
  const colors = useColors();

  // Build action buttons for rewrite-specific actions
  const actionButtons = item.isActionable ? (
    <>
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
        onPress={() => item.onAction?.('copy')}
      >
        <Text style={[styles.actionBtnTextSecondary, { color: colors.copyButtonText }]}>Copy</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.actionBtnDestructive, { 
          backgroundColor: 'transparent',
          borderColor: colors.kindButtonBorder,
        }]} 
        onPress={() => {
          if (onMakeKinder) {
            onMakeKinder(item.text);
          }
        }}
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

