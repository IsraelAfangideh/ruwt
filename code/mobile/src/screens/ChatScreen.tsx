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
import { Message, BlockedState } from '../types/chat';
import MessageBubble from '../components/MessageBubble';
import BlockedView from '../components/BlockedView';
import ChatInput from '../components/ChatInput';

export default function ChatScreen({ route }: any) {
  const { runner } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [blockedState, setBlockedState] = useState<BlockedState | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  // Initial Greeting
  useEffect(() => {
    setMessages([
      {
        id: 'init',
        text: `Hi Human, I am ${runner.name}. I am a Runner (Messenger). I deliver messages to other humans.`,
        sender: 'runner'
      }
    ]);
  }, []);

  const sendMessage = async (text: string, isRewrite = false) => {
    if (!text.trim()) return;

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
    
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => !m.isSystem)
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
        // Parse explanation from the text
        // Text format: [BLOCKED] Explanation... Proposed Rewrite: "..."
        const parts = data.text.split('Proposed Rewrite:');
        const explanation = parts[0].replace('[BLOCKED]', '').trim();
        
        setBlockedState({
          originalText: text,
          proposedRewrite: data.proposedRewrite || text, // Fallback
          explanation
        });
      } else {
        // Message sent successfully (simulated)
        // In a real app, this would go to the OTHER user. 
        // Here, the runner just confirms it.
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

  const handleDecision = (choice: 'rewrite' | 'original' | 'kinder') => {
    if (!blockedState) return;

    if (choice === 'rewrite') {
      // User accepts rewrite
      setMessages(prev => [...prev, {
          id: Date.now().toString() + '_rewritten',
          text: blockedState.proposedRewrite,
          sender: 'user'
      }]);
      
      // Simulate sending
      setTimeout(() => {
          setMessages(prev => [...prev, {
              id: Date.now().toString() + '_sent',
              text: `[SENT] ${blockedState.proposedRewrite}`,
              sender: 'runner'
          }]);
      }, 500);
      setBlockedState(null);

    } else if (choice === 'original') {
      // User insists on original
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_force',
        text: blockedState.originalText,
        sender: 'user'
      }]);
        
      setTimeout(() => {
        setMessages(prev => [...prev, {
            id: Date.now().toString() + '_sent',
            text: `[SENT] ${blockedState.originalText}`,
            sender: 'runner'
        }]);
      }, 500);
      setBlockedState(null);

    } else if (choice === 'kinder') {
        // "Make it EVEN KINDER" - Recursive call
        // We send a special prompt to the AI
        const prompt = `The user wants this message to be EVEN KINDER: "${blockedState.proposedRewrite}". Please rewrite it again to be overwhelmingly kind.`;
        setBlockedState(null); 
        sendMessage(prompt, false); // treat as new input to generate new options
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

      {blockedState ? (
        <BlockedView blockedState={blockedState} onDecision={handleDecision} />
      ) : (
        <ChatInput 
          input={input} 
          isLoading={isLoading} 
          onChangeText={setInput} 
          onSend={() => sendMessage(input)} 
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 15 },
});
