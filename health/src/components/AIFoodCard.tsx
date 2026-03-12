/**
 * Parsed AI food item card with confidence indicator, macros, and quantity controls.
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';

interface ParsedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  estimatedCalories: number;
  estimatedProtein: number;
  estimatedCarbs: number;
  estimatedFat: number;
  confidence: 'high' | 'medium' | 'low';
  matchedFoodId?: string;
  matchedFoodName?: string;
}

interface AIFoodCardProps {
  item: ParsedFoodItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#f97316',
};

export function AIFoodCard({ item, onUpdateQuantity, onRemove }: AIFoodCardProps) {
  const c = useColors();
  const totalCal = Math.round(item.estimatedCalories * item.quantity);

  return (
    <View style={[styles.card, { borderColor: c.border }]}>
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: CONFIDENCE_COLORS[item.confidence] }]} />
          <Text style={[styles.name, { color: c.text }]}>{item.name}</Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={[styles.removeBtn, { color: c.error }]}>&#x2715;</Text>
        </Pressable>
      </View>

      <Text style={[styles.macroLine, { color: c.textMuted }]}>
        {totalCal} cal &middot; {Math.round(item.estimatedProtein * item.quantity)}p &middot; {Math.round(item.estimatedCarbs * item.quantity)}c &middot; {Math.round(item.estimatedFat * item.quantity)}f
      </Text>

      {item.matchedFoodName && (
        <View style={[styles.matchChip, { backgroundColor: c.successBg }]}>
          <Text style={[styles.matchText, { color: c.success }]}>
            Matched: {item.matchedFoodName}
          </Text>
        </View>
      )}

      <View style={styles.qtyRow}>
        <Pressable onPress={() => onUpdateQuantity(Math.max(0.25, item.quantity - 0.5))}>
          <Text style={[styles.qtyBtn, { color: c.accent }]}>&#x2212;</Text>
        </Pressable>
        <Text style={[styles.qtyText, { color: c.text }]}>
          {item.quantity} {item.unit}
        </Text>
        <Pressable onPress={() => onUpdateQuantity(item.quantity + 0.5)}>
          <Text style={[styles.qtyBtn, { color: c.accent }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: 1,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    textTransform: 'capitalize',
  },
  removeBtn: {
    fontSize: fontSizes.md,
    paddingLeft: spacing.sm,
  },
  macroLine: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
    paddingLeft: 20,
  },
  matchChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginLeft: 20,
  },
  matchText: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.body,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 20,
  },
  qtyBtn: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
  },
  qtyText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
    minWidth: 60,
    textAlign: 'center',
  },
});
