import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlockedState } from '../types/chat';

type Props = {
  blockedState: BlockedState;
  onDecision: (choice: 'rewrite' | 'original' | 'kinder') => void;
};

export default function BlockedView({ blockedState, onDecision }: Props) {
  return (
    <View style={styles.blockedContainer}>
      <Text style={styles.blockedTitle}>Message Intercepted</Text>
      <Text style={styles.blockedExplanation}>{blockedState.explanation}</Text>
      
      <View style={styles.rewriteBox}>
        <Text style={styles.rewriteLabel}>Proposed Rewrite:</Text>
        <Text style={styles.rewriteText}>"{blockedState.proposedRewrite}"</Text>
      </View>

      <View style={styles.decisionButtons}>
        <TouchableOpacity 
            style={[styles.btn, styles.btnPrimary]} 
            onPress={() => onDecision('rewrite')}
        >
            <Text style={styles.btnText}>Send Rewrite</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
            style={[styles.btn, styles.btnSecondary]} 
            onPress={() => onDecision('kinder')}
        >
            <Text style={styles.btnTextSecondary}>Make Kinder</Text>
        </TouchableOpacity>

        <TouchableOpacity 
            style={[styles.btn, styles.btnDestructive]} 
            onPress={() => onDecision('original')}
        >
            <Text style={styles.btnTextDestructive}>Send Original</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockedContainer: {
    padding: 20,
    backgroundColor: '#FFF5F5', // Light red background
    borderTopWidth: 2,
    borderTopColor: '#FFCCCC',
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D00000',
    marginBottom: 5,
  },
  blockedExplanation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  rewriteBox: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rewriteLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
    fontWeight: '600',
  },
  rewriteText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#333',
  },
  decisionButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#007AFF' },
  btnSecondary: { backgroundColor: '#E5E5EA' },
  btnDestructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF3B30' },
  
  btnText: { color: '#fff', fontWeight: '600' },
  btnTextSecondary: { color: '#000', fontWeight: '600' },
  btnTextDestructive: { color: '#FF3B30', fontWeight: '600' },
});

