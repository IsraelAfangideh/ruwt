import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
import { Message } from '../types/chat';
import { ChatActions } from '../types/runner';
import { getRunnerModule } from '../runners';
import ReportModal from '../components/ReportModal';
import TypingIndicator from '../components/TypingIndicator';
import { useColors } from '../theme';
import { submitReport } from '../services/report';

// Default runner for web deep linking / screenshots
const DEFAULT_RUNNER = {
  id: 'rewrite',
  name: 'Rewrite',
  personality: 'I rewrite messages to be calm, empathetic, and kind.',
};

export default function ChatScreen({ route, navigation }: any) {
  const runner = route?.params?.runner || DEFAULT_RUNNER;
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  const runnerModule = useMemo(() => getRunnerModule(runner.name), [runner.name]);
  
  if (!runnerModule) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Runner not found: {runner.name}</Text>
      </View>
    );
  }

  const RunnerBubble = runnerModule.Bubble;
  const RunnerInput = runnerModule.Input;

  const actions = useMemo<ChatActions>(() => ({
    addMessage: (message: Message) => {
      setMessages(prev => [...prev, message]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    setLoading: setIsLoading,
    triggerError: (error: string) => {
      setIsLoading(false); // Ensure loading stops on error
      const now = Date.now();
      setMessages(prev => [...prev, 
        {
          id: now.toString() + '_error_title',
          text: 'Error',
          sender: 'runner'
        },
        {
          id: (now + 1).toString() + '_error_msg',
          text: error,
          sender: 'runner'
        }
      ]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // FIX: Removed Alert.alert()
      // Native alerts block Maestro from scrolling the list in subsequent steps.
      // The chat bubbles added above are sufficient for feedback.
    },
  }), []);

  // Add header menu button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={showMenu}
          style={styles.menuButton}
        >
          <Text style={[styles.menuIcon, { color: colors.textMuted }]}>•••</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

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

  const handleReport = async (reason: string, details: string) => {
    try {
      await submitReport({
        runner: runner.name,
        reason,
        details,
      });
      
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it within 24 hours.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert(
        'Error',
        'Failed to submit report. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    setMessages([
      {
        id: 'init',
        text: `Send me a message, and I will improve it, while preserving the intent`,
        sender: 'runner'
      }
    ]);
  }, []);

  const handleMakeKinder = (rewriteText: string) => {
    if (isBlocked) {
      Alert.alert('Blocked', `${runner.name} is blocked. Unblock from the menu to send messages.`);
      return;
    }

    const prompt = `The user wants this message to be EVEN KINDER: "${rewriteText}". Please rewrite it again to be overwhelmingly kind.`;
    const history = messages.filter(m => !m.isSystem && !m.isActionable);
    
    // Safe to assume this calls handleMessage, but adding safety just in case
    runnerModule.handleMessage(prompt, history, actions).catch((err: any) => {
       actions.triggerError(err.message || 'Failed to process request');
    });
  };

  const handleSendRewrite = (rewriteText: string) => {
    if (isBlocked) {
      Alert.alert('Blocked', `${runner.name} is blocked. Unblock from the menu to send messages.`);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text: rewriteText,
      sender: 'user',
    };
    actions.addMessage(userMsg);
    
    actions.addMessage({
      id: Date.now().toString() + '_sent',
      text: `[SENT] ${rewriteText}`,
      sender: 'runner'
    });
  };

  // Main send message handler
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    if (isBlocked) {
      Alert.alert('Blocked', `${runner.name} is blocked. Unblock from the menu to send messages.`);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
    };
    actions.addMessage(userMsg);
    setInput('');

    const history = messages.filter(m => !m.isSystem && !m.isActionable);

    // FIX: Wrap logic in try/catch. 
    // If the runner crashes (e.g. 500 error or network fail), we must catch it to show the "Error" bubble.
    try {
      await runnerModule.handleMessage(text, history, actions);
    } catch (error: any) {
      console.error('Message handling failed:', error);
      actions.triggerError(error.message || 'Failed to send message');
    }
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    // @ts-ignore: React 19 type mismatch with RN
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.bg }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 50}
    >
      {isBlocked && (
        <View style={[styles.blockedBanner, { backgroundColor: colors.blockedBg }]}>
          <Text style={[styles.blockedText, { color: colors.blocked }]}>
            {runner.name} is blocked. Tap ••• to unblock.
          </Text>
        </View>
      )}
      
      {/* @ts-ignore: React 19 type mismatch with RN */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => {
          const handleAction = (action: 'send' | 'copy' | 'kinder') => {
            if (action === 'send') {
              handleSendRewrite(item.text);
            }
          };

          return (
            <RunnerBubble 
              item={{
                ...item,
                onAction: item.isActionable ? handleAction : item.onAction,
              }} 
              onMakeKinder={handleMakeKinder}
            />
          );
        }}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListFooterComponent={isLoading ? <TypingIndicator isRunner /> : null}
      />

      <RunnerInput 
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