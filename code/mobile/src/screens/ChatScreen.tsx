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
import * as Clipboard from 'expo-clipboard';
import { Message } from '../types/chat';
import { ChatActions } from '../types/runner';
import { getRunnerModule } from '../runners';
import ReportModal from '../components/ReportModal';
import TypingIndicator from '../components/TypingIndicator';
import Toast from '../components/Toast';
import { useColors } from '../theme';
import { submitReport } from '../services/report';
import { shareMessage } from '../services/share';

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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
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

  const handleShare = async (rewriteText: string) => {
    if (isBlocked) {
      Alert.alert('Blocked', `${runner.name} is blocked. Unblock from the menu to send messages.`);
      return;
    }

    const result = await shareMessage(rewriteText);
    
    // Show toast for clipboard fallback (desktop browsers without Web Share API)
    if (result.success && result.method === 'clipboard') {
      setToastMessage('Sharing not supported on desktop. Copied to clipboard!');
      setToastVisible(true);
    }
    // Note: Native share sheets and Web Share API handle their own UI,
    // so we don't need to show anything for those cases
  };

  // Handle user message long-press - shows inline actions below the message
  const handleUserMessageLongPress = (message: Message) => {
    // Toggle selection - if already selected, deselect
    if (selectedMessageId === message.id) {
      setSelectedMessageId(null);
    } else {
      setSelectedMessageId(message.id);
    }
  };

  // Dismiss inline action selection
  const handleDismissSelection = () => {
    setSelectedMessageId(null);
  };

  // Repeat a user message (submit again for a new rewrite)
  const handleRepeatMessage = async (text: string) => {
    setSelectedMessageId(null); // Dismiss selection first
    
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

    const history = messages.filter(m => !m.isSystem && !m.isActionable);

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

  // Copy a user message to clipboard
  const handleCopyUserMessage = async (message: Message) => {
    await Clipboard.setStringAsync(message.text);
    setCopiedMessageId(message.id);
    setToastMessage('Copied to clipboard');
    setToastVisible(true);
    // Keep selection visible briefly to show "Copied!" state, then dismiss
    setTimeout(() => {
      setCopiedMessageId(null);
      setSelectedMessageId(null);
    }, 1200);
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
          const handleAction = async (action: 'send' | 'copy' | 'kinder') => {
            if (action === 'send') {
              await handleShare(item.text);
            } else if (action === 'copy') {
              await Clipboard.setStringAsync(item.text);
              setCopiedMessageId(item.id);
              setTimeout(() => setCopiedMessageId(null), 2500);
            }
          };

          return (
            <RunnerBubble 
              item={{
                ...item,
                onAction: item.isActionable ? handleAction : item.onAction,
              }} 
              onMakeKinder={handleMakeKinder}
              isCopied={copiedMessageId === item.id}
              onUserLongPress={handleUserMessageLongPress}
              // Inline user message actions
              isSelected={selectedMessageId === item.id}
              onRepeat={() => handleRepeatMessage(item.text)}
              onCopy={() => handleCopyUserMessage(item)}
              onDismiss={handleDismissSelection}
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

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
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