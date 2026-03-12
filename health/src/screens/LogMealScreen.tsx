/**
 * Log Meal screen — select meal type, search foods, set quantities, save.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { MEAL_TYPE_LABELS, MEAL_TYPE_ICONS, type MealType } from '@/lib/nutrition';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface SelectedFood {
  food: FoodItem;
  quantity: number;
}

export function LogMealScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mealType = (route.params?.mealType || 'breakfast') as MealType;
  const date = route.params?.date || new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedFood[]>([]);
  const [saving, setSaving] = useState(false);

  // Debounced food search
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(search)}&limit=20`);
        if (res.ok) setResults(await res.json());
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const addFood = (food: FoodItem) => {
    setSelected(prev => [...prev, { food, quantity: 1 }]);
    setSearch('');
    setResults([]);
  };

  const updateQuantity = (index: number, qty: number) => {
    setSelected(prev => prev.map((s, i) => i === index ? { ...s, quantity: Math.max(0.25, qty) } : s));
  };

  const removeFood = (index: number) => {
    setSelected(prev => prev.filter((_, i) => i !== index));
  };

  const totalCals = selected.reduce((sum, s) => sum + s.food.calories * s.quantity, 0);

  const handleSave = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          mealType,
          items: selected.map(s => ({ foodId: s.food.id, quantity: s.quantity })),
        }),
      });
      if (res.ok) {
        navigation.goBack();
      }
    } catch {}
    setSaving(false);
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>
          {MEAL_TYPE_ICONS[mealType]} {MEAL_TYPE_LABELS[mealType]}
        </Text>
        <Text style={[styles.dateText, { color: c.textMuted }]}>{date}</Text>
      </View>

      {/* Food Search */}
      <View style={styles.searchSection}>
        <Input
          label="Search foods"
          value={search}
          onChangeText={setSearch}
          placeholder="e.g. chicken breast, rice, banana..."
        />
        {searching && <ActivityIndicator size="small" color={c.accent} />}
        {results.length > 0 && (
          <View style={[styles.resultsList, { backgroundColor: c.card, borderColor: c.border }]}>
            {results.map(food => (
              <Pressable
                key={food.id}
                onPress={() => addFood(food)}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.resultItem,
                  { borderColor: c.border },
                  pressed && { backgroundColor: c.bgWarm },
                ]}
              >
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: c.text }]}>{food.name}</Text>
                  {food.brand && <Text style={[styles.resultBrand, { color: c.textSubtle }]}>{food.brand}</Text>}
                </View>
                <View style={styles.resultNutrition}>
                  <Text style={[styles.resultCal, { color: c.accent }]}>{Math.round(food.calories)} cal</Text>
                  <Text style={[styles.resultServing, { color: c.textMuted }]}>
                    per {food.servingSize}{food.servingUnit}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Selected Foods */}
      {selected.length > 0 && (
        <Card>
          <CardContent>
            <Text style={[styles.selectedTitle, { color: c.text }]}>
              Selected ({selected.length} item{selected.length !== 1 ? 's' : ''})
            </Text>
            {selected.map((s, i) => (
              <View key={i} style={[styles.selectedItem, { borderColor: c.border }]}>
                <View style={styles.selectedInfo}>
                  <Text style={[styles.selectedName, { color: c.text }]}>{s.food.name}</Text>
                  <Text style={[styles.selectedCal, { color: c.textMuted }]}>
                    {Math.round(s.food.calories * s.quantity)} cal
                  </Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => updateQuantity(i, s.quantity - 0.5)}>
                    <Text style={[styles.qtyBtn, { color: c.accent }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.qtyText, { color: c.text }]}>{s.quantity}</Text>
                  <Pressable onPress={() => updateQuantity(i, s.quantity + 0.5)}>
                    <Text style={[styles.qtyBtn, { color: c.accent }]}>+</Text>
                  </Pressable>
                  <Pressable onPress={() => removeFood(i)}>
                    <Text style={[styles.removeBtn, { color: c.error }]}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <View style={[styles.totalRow, { borderColor: c.border }]}>
              <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: c.accent }]}>{Math.round(totalCals)} cal</Text>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Create Custom Food */}
      <Pressable onPress={() => navigation.navigate('FoodSearch')}>
        <Text style={[styles.customLink, { color: c.accent }]}>
          Can't find it? Create a custom food →
        </Text>
      </Pressable>

      {/* Save Button */}
      <Button
        onPress={handleSave}
        disabled={saving || !selected.length}
        fullWidth
        size="lg"
      >
        {saving ? 'Saving...' : `Log ${MEAL_TYPE_LABELS[mealType]}`}
      </Button>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.md,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs, paddingTop: spacing.md },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  dateText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  searchSection: { gap: spacing.sm },
  resultsList: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  resultBrand: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  resultNutrition: { alignItems: 'flex-end', gap: 2 },
  resultCal: { fontSize: fontSizes.sm, fontWeight: '700', fontFamily: fontFamily.body },
  resultServing: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  selectedTitle: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  selectedInfo: { flex: 1, gap: 2 },
  selectedName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  selectedCal: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: { fontSize: fontSizes.xl, fontWeight: '600', paddingHorizontal: spacing.sm },
  qtyText: { fontSize: fontSizes.md, fontWeight: '600', fontFamily: fontFamily.body, minWidth: 30, textAlign: 'center' },
  removeBtn: { fontSize: fontSizes.md, paddingLeft: spacing.md },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  totalValue: { fontSize: fontSizes.md, fontWeight: '700', fontFamily: fontFamily.body },
  customLink: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, textAlign: 'center' },
  bottomPad: { height: spacing['2xl'] },
});
