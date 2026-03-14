import { View, Text, Image, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/tokens';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ src, alt, fallback, size = 32, style }: AvatarProps) {
  const c = useColors();
  return (
    <View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.muted }, style]}
      accessibilityLabel={alt ?? fallback}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={alt ?? fallback} />
      ) : (
        <Text style={[styles.text, { color: c.text, fontSize: size * 0.4 }]}>{fallback}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '600', fontFamily: fontFamily.body },
});
