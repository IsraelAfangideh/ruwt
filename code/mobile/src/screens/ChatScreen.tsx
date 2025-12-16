import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  TouchableOpacity,
  Text,
  ActionSheetIOS,
} from 'react-native';
import { ENDPOINTS } from '../config';
import { PeacemakerChatResponse } from '@ruwt/shared';
import { Message } from '../types/chat';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ReportModal from '../components/ReportModal';

export default function ChatScreen({ route, navigation }: any) {
  const { runner } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  // Add header menu button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={showMenu}
          style={styles.menuButton}
        >
          <Text style={styles.menuIcon}>•••</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const showMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Report Issue', isBlocked ? 'Unblock Runner' : 'Block Runner'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setShowReportModal(true);
          } else if (buttonIndex === 2) {
            handleBlock();
          }
        }
      );
    } else {
      // Android fallback - show Alert with options
      Alert.alert(
        'Options',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Report Issue', onPress: () => setShowReportModal(true) },
          { 
            text: isBlocked ? 'Unblock Runner' : 'Block Runner', 
            onPress: handleBlock,
            style: 'destructive'
          },
        ]
      );
    }
  };

  const handleBlock = () => {
    if (isBlocked) {
      setIsBlocked(false);
      Alert.alert('Unblocked', `${runner.name} has been unblocked.`);
    } else {
      Alert.alert(
        'Block Runner',
        `Are you sure you want to block ${runner.name}? You won't receive messages from this runner.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Block', 
            style: 'destructive',
            onPress: () => {
              setIsBlocked(true);
              Alert.alert('Blocked', `${runner.name} has been blocked. You can unblock from the menu.`);
            }
          },
        ]
      );
    }
  };

  const handleReport = (reason: string, details: string) => {
    // In production, this would send to your API
    // For now, we log it and show confirmation
    console.log('Report submitted:', { runner: runner.name, reason, details });
    
    Alert.alert(
      'Report Submitted',
      'Thank you for your report. We will review it within 24 hours.',
      [{ text: 'OK' }]
    );
  };

  // Initial Greeting
  useEffect(() => {
    setMessages([
      {
        id: 'init',
        text: `Hi Human, I am ${runner.name}. I am a Runner. I deliver messages to other humans.`,
        sender: 'runner'
      }
    ]);
  }, []);

  const sendMessage = async (text: string, isRewrite = false, isSystemInstruction = false) => {
    if (!text.trim()) return;
    
    // Check if blocked
    if (isBlocked) {
      Alert.alert('Blocked', `${runner.name} is blocked. Unblock from the menu to send messages.`);
      return;
    }

    // Only add visible messages to the UI list
    if (!isSystemInstruction) {
        const userMsg: Message = {
          id: Date.now().toString(),
          text: text,
          sender: 'user',
        };
        
        // Optimistically add user message if it's not a rewrite flow
        if (!isRewrite) {
            setMessages(prev => [...prev, userMsg]);
            setInput('');
        } else {
            // If it is a rewrite (user accepted AI version), we just send it as the final message
            setMessages(prev => [...prev, userMsg]);
        }
    } else {
        // Clear input even if system instruction
        setInput('');
    }
    
    setIsLoading(true);

    try {
      // Filter out system instructions from history so AI doesn't see "User said: make it kinder" as a literal message to deliver
      const history = messages
        .filter(m => !m.isSystem && !m.isActionable) // Don't include previous 'action' bubbles in history context to keep it clean, or keep them if you want context
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: m.text }]
        }));

      const response = await fetch(ENDPOINTS.peacemakerChat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: 'user_1', // Hardcoded for prototype
          history
        })
      });

      const data: PeacemakerChatResponse = await response.json();

      if (data.isBlocked) {
        // 1. Add Explanation Bubble
        if (data.explanation) {
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_exp',
                text: data.explanation || "This feels sharp.",
                sender: 'runner'
            }]);
        }

        // 2. Add Actionable Rewrite Bubble
        if (data.proposedRewrite) {
            const rewriteText = data.proposedRewrite;
            
            // Define action handler
            const handleAction = (action: 'send' | 'copy' | 'kinder') => {
                if (action === 'send') {
                    // Send the rewrite as if user typed it
                    sendMessage(rewriteText, true); 
                } else if (action === 'kinder') {
                    // Request even kinder version
                    const prompt = `The user wants this message to be EVEN KINDER: "${rewriteText}". Please rewrite it again to be overwhelmingly kind.`;
                    sendMessage(prompt, false, true);
                }
                // Copy is handled in component
            };

            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_rewrite',
                text: rewriteText,
                sender: 'runner',
                isActionable: true,
                onAction: handleAction
            }]);
        }

      } else {
        // Message sent successfully (simulated)
        const runnerMsg: Message = {
            id: Date.now().toString() + '_r',
            text: `[SENT] ${text}`,
            sender: 'runner'
        };
        setMessages(prev => [...prev, runnerMsg]);
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // @ts-ignore: React 19 type mismatch with RN
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedText}>
            {runner.name} is blocked. Tap ••• to unblock.
          </Text>
        </View>
      )}
      
      {/* @ts-ignore: React 19 type mismatch with RN */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble item={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <ChatInput 
        input={input} 
        isLoading={isLoading} 
        onChangeText={setInput} 
        onSend={() => sendMessage(input)} 
      />

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        runnerName={runner.name}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 15 },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  blockedBanner: {
    backgroundColor: '#ffebee',
    padding: 12,
    alignItems: 'center',
  },
  blockedText: {
    color: '#c62828',
    fontSize: 14,
  },
});
