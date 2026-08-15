import { useState, useCallback } from 'react';
import { TextInput, View, Text, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  id?: string;
  label?: string;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onSubmitEditing?: () => void;
  onFocus?: (e: any) => void;
  onBlur?: (e: any) => void;
  testID?: string;
}

let inputIdCounter = 0;

export function Input({ id, label, containerStyle, inputStyle, onFocus, onBlur, ...props }: InputProps) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const [autoId] = useState(() => `input-${++inputIdCounter}`);
  const inputId = id || autoId;

  const handleFocus = useCallback((e: any) => {
    setFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: any) => {
    setFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: c.text }]} nativeID={`${inputId}-label`}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.textSubtle}
        accessibilityLabel={label}
        accessibilityLabelledBy={label ? `${inputId}-label` : undefined}
        nativeID={inputId}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          {
            backgroundColor: c.bgElevated,
            borderColor: focused ? c.accent : c.borderStrong,
            color: c.text,
          },
          focused && styles.inputFocused,
          inputStyle,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
  } as any,
  inputFocused: {
    borderWidth: 2,
    paddingHorizontal: spacing.md - 1,
    paddingVertical: spacing.sm + 1,
  },
});
