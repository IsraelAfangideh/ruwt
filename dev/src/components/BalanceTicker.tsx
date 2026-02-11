import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

export function BalanceTicker() {
  const c = useColors();
  const [balance, setBalance] = useState(12450);

  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((prev) => prev + (Math.random() - 0.4) * 10);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: c.muted, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.primary }]}>Credits</Text>
      <Text style={[styles.value, { color: c.text }]}>{balance.toFixed(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 9999,
    borderWidth: 1,
  },
  label: { fontSize: fontSizes.xs, fontWeight: '600', fontFamily: fontFamily.body },
  value: { fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.body },
});
