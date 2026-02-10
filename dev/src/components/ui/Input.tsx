import { TextInput, View, Text, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radii, fontSizes, fontFamily } from '@/theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: string;
  autoCapitalize?: string;
  onSubmitEditing?: () => void;
}

export function Input({ label, containerStyle, inputStyle, ...props }: InputProps) {
  const c = useColors();
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: c.text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.textSubtle}
        style={[
          styles.input,
          {
            backgroundColor: c.bgElevated,
            borderColor: c.borderStrong,
            color: c.text,
          },
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
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    fontFamily: fontFamily.body,
  },
});
