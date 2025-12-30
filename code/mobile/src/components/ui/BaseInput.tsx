import React, { useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  Platform, 
  TextInput as TextInputType
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme';

type Props = {
  input: string;
  isLoading: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
};

export default function BaseInput({ input, isLoading, onChangeText, onSend }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputType>(null);
  
  const currentValueRef = useRef(input);

  useEffect(() => {
    currentValueRef.current = input;
  }, [input]);

  // ---------------------------------------------------------
  // THE FIX: DEFENSIVE SAFE AREA CALCULATION
  // ---------------------------------------------------------
  // 1. Detect if insets are valid (sometimes 0 on simulator init).
  // 2. If invalid on iOS, FORCE the standard Home Indicator height (34px).
  // 3. Add 10px "Breathing Room" so the input isn't glued to the bar.
  const safeBottom = insets.bottom > 0 
    ? insets.bottom 
    : (Platform.OS === 'ios' ? 34 : 0);

  // iOS: Safe Area + 10px buffer
  // Android: Fixed 12px (or more if you have translucent nav bars)
  const bottomPadding = Platform.OS === 'ios' 
    ? safeBottom + 10 
    : 12;

  const handleChangeText = useCallback((text: string) => {
    currentValueRef.current = text; 
    onChangeText(text);             
  }, [onChangeText]);

  const handleSend = useCallback(() => {
    const currentText = currentValueRef.current;
    if (currentText && currentText.trim().length > 0) {
        onSend();
    }
  }, [onSend]);

  return (
    <View style={[styles.inputContainer, { 
      borderTopColor: colors.border,
      backgroundColor: colors.bgElevated,
      // The corrected padding forces the input UP into the clickable zone
      paddingBottom: bottomPadding,
    }]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, {
          borderColor: colors.borderStrong,
          backgroundColor: colors.bg,
          color: colors.text,
          minHeight: 44,
        }]}
        value={input}
        onChangeText={handleChangeText}
        placeholder="Type a message..."
        placeholderTextColor={colors.textSubtle}
        editable={!isLoading}
        multiline={true}
        maxLength={1000}
        
        accessible={true}
        accessibilityLabel="Message Input"
        // THIS ID IS CRITICAL FOR MAESTRO
        testID="message-input"
        
        enablesReturnKeyAutomatically={true}
        textAlignVertical="center"
      />
      
      <TouchableOpacity 
        style={[styles.sendButton, { backgroundColor: colors.accent }]} 
        onPress={handleSend}
        disabled={isLoading}
        accessibilityLabel="Send"
        accessible={true}
        testID="send-button"
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      >
         {isLoading 
           ? <ActivityIndicator color={colors.userBubbleText} /> 
           : <Text style={[styles.sendText, { color: colors.userBubbleText }]}>Send</Text>
         }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 20,
    marginBottom: 1,
  },
  sendText: { 
    fontWeight: '600',
    fontSize: 15,
  },
});