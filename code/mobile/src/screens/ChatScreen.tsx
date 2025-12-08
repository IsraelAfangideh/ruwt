import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { ENDPOINTS } from '../config';
import { PeacemakerChatResponse } from '@ruwt/shared';
import { Message } from '../types/chat';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';

export default function ChatScreen({ route }: any) {
  const { runner } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 15 },
});
