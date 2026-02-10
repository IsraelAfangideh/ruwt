import { Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontSizes, fontFamily } from '@/theme/tokens';

export function Label({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.text }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: { fontSize: fontSizes.sm, fontWeight: '500', fontFamily: fontFamily.body },
});
