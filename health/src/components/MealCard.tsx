/**
 * Card showing a meal summary (type, calories, item count).
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, spacing, radii } from '@/theme/tokens';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ICONS, type MealType } from '@/lib/nutrition';

interface MealCardProps {
  mealType: MealType;
  calories: number;
  itemCount: number;
  onPress?: () => void;
}

export function MealCard({ mealType, calories, itemCount, onPress }: MealCardProps) {
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
      accessibilityLabel={`${MEAL_TYPE_LABELS[mealType]}: ${calories} calories, ${itemCount} items`}
    >
      <Text style={styles.icon}>{MEAL_TYPE_ICONS[mealType]}</Text>
      <View style={styles.info}>
        <Text style={[styles.type, { color: c.text }]}>{MEAL_TYPE_LABELS[mealType]}</Text>
        <Text style={[styles.detail, { color: c.textMuted }]}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={[styles.calories, { color: c.accent }]}>{calories} cal</Text>
    </Pressable>
  );
}

/** Placeholder card for empty meal slot */
export function EmptyMealCard({ mealType, onPress }: { mealType: MealType; onPress?: () => void }) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        styles.emptyCard,
        { borderColor: c.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${MEAL_TYPE_LABELS[mealType]}`}
    >
      <Text style={styles.icon}>{MEAL_TYPE_ICONS[mealType]}</Text>
      <View style={styles.info}>
        <Text style={[styles.type, { color: c.textMuted }]}>{MEAL_TYPE_LABELS[mealType]}</Text>
        <Text style={[styles.detail, { color: c.textSubtle }]}>Tap to log</Text>
      </View>
      <Text style={[styles.plus, { color: c.accent }]}>+</Text>
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
  emptyCard: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  } as any,
  pressed: { opacity: 0.9 },
  icon: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  type: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  detail: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  calories: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    fontFamily: fontFamily.body,
  },
  plus: {
    fontSize: fontSizes['2xl'],
    fontWeight: '300',
  },
});
