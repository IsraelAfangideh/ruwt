/**
 * Card showing a workout summary.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing, radii } from '@/theme/tokens';

interface WorkoutCardProps {
  name: string;
  durationMinutes?: number | null;
  setCount?: number;
  onPress?: () => void;
}

export function WorkoutCard({ name, durationMinutes, setCount, onPress }: WorkoutCardProps) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Workout: ${name}`}
    >
      <Text style={styles.icon}>💪</Text>
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.text }]}>{name}</Text>
        <View style={styles.details}>
          {durationMinutes ? (
            <Text style={[styles.detail, { color: c.textMuted }]}>{durationMinutes} min</Text>
          ) : null}
          {setCount ? (
            <Text style={[styles.detail, { color: c.textMuted }]}>{setCount} sets</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  pressed: { opacity: 0.9 },
  icon: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  name: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detail: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
});
