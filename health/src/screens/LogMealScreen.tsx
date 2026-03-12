/**
 * Log Meal screen — AI-first input with manual search fallback.
 * Two modes:
 *   1. AI Input (default): Describe meal in natural language, AI parses into items
 *   2. Manual Search: Traditional food search from database
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { AIInput } from '@/components/AIInput';
import { AIFoodCard } from '@/components/AIFoodCard';
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
  servingSize?: number;
  servingUnit?: string;
}

type InputMode = 'ai' | 'manual';

export function LogMealScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [mealType, setMealType] = useState<MealType>((route.params?.mealType || 'breakfast') as MealType);
  const date = route.params?.date || new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<InputMode>('ai');

  // AI mode state
  const [parsedItems, setParsedItems] = useState<ParsedFoodItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Manual mode state
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedFood[]>([]);

  // Shared state
  const [saving, setSaving] = useState(false);

  // Recent foods
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  useEffect(() => {
    fetch('/api/foods-recent?limit=8')
      .then(r => r.ok ? r.json() : [])
      .then(setRecentFoods)
      .catch(() => {});
  }, []);

  // Debounced food search (manual mode)
  useEffect(() => {
    if (mode !== 'manual' || !search.trim()) {
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
  }, [search, mode]);

  // AI parse handler
  const handleAIParse = async (text: string) => {
    setParsing(true);
    setParseError('');
    try {
      const res = await fetch('/api/ai/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mealType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parse failed');
      setParsedItems(data.items || []);
      if (data.suggestedMealType && !route.params?.mealType) {
        setMealType(data.suggestedMealType as MealType);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse. Try again or use manual search.');
    }
    setParsing(false);
  };

  // Update parsed item quantity
  const updateParsedQuantity = (index: number, qty: number) => {
    setParsedItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: qty } : item));
  };

  // Remove parsed item
  const removeParsedItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Manual: add food
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

  // AI mode totals
  const aiTotalCals = parsedItems.reduce((sum, item) => sum + item.estimatedCalories * item.quantity, 0);

  // Manual mode totals
  const manualTotalCals = selected.reduce((sum, s) => sum + s.food.calories * s.quantity, 0);

  // Save: AI mode
  const handleSaveAI = async () => {
    if (!parsedItems.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          mealType,
          items: parsedItems.map(item => ({
            foodId: item.matchedFoodId || undefined,
            name: item.name,
            quantity: item.quantity,
            servingSize: item.servingSize || 1,
            servingUnit: item.servingUnit || item.unit,
            calories: item.estimatedCalories,
            protein: item.estimatedProtein,
            carbs: item.estimatedCarbs,
            fat: item.estimatedFat,
          })),
        }),
      });
      if (res.ok) navigation.goBack();
    } catch {}
    setSaving(false);
  };

  // Save: Manual mode
  const handleSaveManual = async () => {
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
      if (res.ok) navigation.goBack();
    } catch {}
    setSaving(false);
  };

  // Quick-add calories
  const [quickAddCals, setQuickAddCals] = useState('');
  const handleQuickAdd = async () => {
    const cals = parseInt(quickAddCals);
    if (!cals) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ai/log-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          mealType,
          items: [{
            name: `Quick Add (${cals} cal)`,
            quantity: 1,
            servingSize: 1,
            servingUnit: 'serving',
            calories: cals,
            protein: 0,
            carbs: 0,
            fat: 0,
          }],
        }),
      });
      if (res.ok) navigation.goBack();
    } catch {}
    setSaving(false);
  };

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>&#x2190; Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>
          {MEAL_TYPE_ICONS[mealType]} {MEAL_TYPE_LABELS[mealType]}
        </Text>
        <Text style={[styles.dateText, { color: c.textMuted }]}>{date}</Text>
      </View>

      {/* Meal Type Selector */}
      <View style={styles.mealTypeRow}>
        {mealTypes.map(type => (
          <Pressable
            key={type}
            onPress={() => setMealType(type)}
            style={[
              styles.mealTypeBtn,
              { borderColor: c.border },
              mealType === type && { backgroundColor: c.accent },
            ]}
          >
            <Text style={[
              styles.mealTypeBtnText,
              { color: mealType === type ? '#fff' : c.text },
            ]}>
              {MEAL_TYPE_ICONS[type]} {MEAL_TYPE_LABELS[type]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('ai')}
          style={[styles.modeBtn, mode === 'ai' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
        >
          <Text style={[styles.modeBtnText, { color: mode === 'ai' ? c.accent : c.textMuted }]}>
            &#x2728; AI Input
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('manual')}
          style={[styles.modeBtn, mode === 'manual' && { borderBottomColor: c.accent, borderBottomWidth: 2 }]}
        >
          <Text style={[styles.modeBtnText, { color: mode === 'manual' ? c.accent : c.textMuted }]}>
            &#x1F50D; Manual Search
          </Text>
        </Pressable>
      </View>

      {/* AI Input Mode */}
      {mode === 'ai' && (
        <>
          <AIInput
            placeholder="Describe your meal... e.g., chicken sandwich with fries and a coke"
            onSubmit={handleAIParse}
            loading={parsing}
            buttonLabel="Parse with AI"
          />

          {parseError ? (
            <Card>
              <CardContent>
                <Text style={[styles.errorText, { color: c.error }]}>{parseError}</Text>
                <Pressable onPress={() => setMode('manual')}>
                  <Text style={[styles.fallbackLink, { color: c.accent }]}>Try manual search instead</Text>
                </Pressable>
              </CardContent>
            </Card>
          ) : null}

          {parsedItems.length > 0 && (
            <Card>
              <CardContent>
                <Text style={[styles.selectedTitle, { color: c.text }]}>
                  Parsed Items ({parsedItems.length})
                </Text>
                {parsedItems.map((item, i) => (
                  <AIFoodCard
                    key={i}
                    item={item}
                    onUpdateQuantity={(qty) => updateParsedQuantity(i, qty)}
                    onRemove={() => removeParsedItem(i)}
                  />
                ))}
                <View style={[styles.totalRow, { borderColor: c.border }]}>
                  <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: c.accent }]}>{Math.round(aiTotalCals)} cal</Text>
                </View>
              </CardContent>
            </Card>
          )}

          {parsedItems.length > 0 && (
            <Button
              onPress={handleSaveAI}
              disabled={saving}
              fullWidth
              size="lg"
            >
              {saving ? 'Saving...' : `Log ${MEAL_TYPE_LABELS[mealType]}`}
            </Button>
          )}

          {/* Quick Add */}
          <Card>
            <CardContent>
              <Text style={[styles.selectedTitle, { color: c.text }]}>Quick Add Calories</Text>
              <View style={styles.quickAddRow}>
                <Input
                  value={quickAddCals}
                  onChangeText={setQuickAddCals}
                  placeholder="e.g. 300"
                  keyboardType="numeric"
                  containerStyle={styles.quickAddInput}
                />
                <Button
                  onPress={handleQuickAdd}
                  disabled={saving || !quickAddCals}
                  size="sm"
                >
                  Add
                </Button>
              </View>
            </CardContent>
          </Card>
        </>
      )}

      {/* Manual Search Mode */}
      {mode === 'manual' && (
        <>
          {/* Recent Foods */}
          {recentFoods.length > 0 && !search.trim() && (
            <View style={styles.recentSection}>
              <Text style={[styles.recentTitle, { color: c.textMuted }]}>Recent</Text>
              <View style={styles.recentChips}>
                {recentFoods.map(food => (
                  <Pressable
                    key={food.id}
                    onPress={() => addFood(food)}
                    style={[styles.recentChip, { backgroundColor: c.bgWarm, borderColor: c.border }]}
                  >
                    <Text style={[styles.recentChipText, { color: c.text }]}>{food.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

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
                        <Text style={[styles.qtyBtn, { color: c.accent }]}>&#x2212;</Text>
                      </Pressable>
                      <Text style={[styles.qtyText, { color: c.text }]}>{s.quantity}</Text>
                      <Pressable onPress={() => updateQuantity(i, s.quantity + 0.5)}>
                        <Text style={[styles.qtyBtn, { color: c.accent }]}>+</Text>
                      </Pressable>
                      <Pressable onPress={() => removeFood(i)}>
                        <Text style={[styles.removeBtn, { color: c.error }]}>&#x2715;</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <View style={[styles.totalRow, { borderColor: c.border }]}>
                  <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: c.accent }]}>{Math.round(manualTotalCals)} cal</Text>
                </View>
              </CardContent>
            </Card>
          )}

          <Pressable onPress={() => navigation.navigate('FoodSearch')}>
            <Text style={[styles.customLink, { color: c.accent }]}>
              Can't find it? Create a custom food &#x2192;
            </Text>
          </Pressable>

          <Button
            onPress={handleSaveManual}
            disabled={saving || !selected.length}
            fullWidth
            size="lg"
          >
            {saving ? 'Saving...' : `Log ${MEAL_TYPE_LABELS[mealType]}`}
          </Button>
        </>
      )}

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
  mealTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  mealTypeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  mealTypeBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  modeBtn: {
    paddingBottom: spacing.sm,
  },
  modeBtnText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
  errorText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, marginBottom: spacing.sm },
  fallbackLink: { fontSize: fontSizes.sm, fontFamily: fontFamily.body, fontWeight: '600' },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  quickAddInput: { flex: 1 },
  recentSection: { gap: spacing.sm },
  recentTitle: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  recentChipText: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
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
