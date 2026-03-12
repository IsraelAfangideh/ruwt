/**
 * Dedicated food search + create custom food screen.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { Button, Input, Card, CardContent, CardTitle } from '@/components/ui';

export function FoodSearchScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Custom food form
  const [newFood, setNewFood] = useState({
    name: '', brand: '', servingSize: '', servingUnit: 'g',
    calories: '', protein: '', carbs: '', fat: '',
  });

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(search)}&limit=30`);
        if (res.ok) setResults(await res.json());
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleCreate = async () => {
    if (!newFood.name || !newFood.servingSize || !newFood.calories) return;
    setSaving(true);
    try {
      const res = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFood.name,
          brand: newFood.brand || undefined,
          servingSize: parseFloat(newFood.servingSize),
          servingUnit: newFood.servingUnit,
          calories: parseFloat(newFood.calories),
          protein: parseFloat(newFood.protein) || 0,
          carbs: parseFloat(newFood.carbs) || 0,
          fat: parseFloat(newFood.fat) || 0,
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
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: c.text }]}>Food Database</Text>

      <Input
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or brand..."
      />

      {searching && <ActivityIndicator size="small" color={c.accent} />}

      {results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((food: any) => (
            <View key={food.id} style={[styles.resultItem, { borderColor: c.border }]}>
              <Text style={[styles.resultName, { color: c.text }]}>{food.name}</Text>
              <Text style={[styles.resultDetail, { color: c.textMuted }]}>
                {Math.round(food.calories)} cal | P:{Math.round(food.protein)}g C:{Math.round(food.carbs)}g F:{Math.round(food.fat)}g | {food.servingSize}{food.servingUnit}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Button variant="outline" onPress={() => setShowCreate(!showCreate)} fullWidth>
        {showCreate ? 'Hide Create Form' : '+ Create Custom Food'}
      </Button>

      {showCreate && (
        <Card>
          <CardTitle>Create Custom Food</CardTitle>
          <CardContent>
            <Input label="Name" value={newFood.name} onChangeText={v => setNewFood(p => ({ ...p, name: v }))} placeholder="e.g. Homemade Granola" />
            <Input label="Brand (optional)" value={newFood.brand} onChangeText={v => setNewFood(p => ({ ...p, brand: v }))} placeholder="e.g. Store brand" />
            <View style={styles.row}>
              <Input label="Serving Size" value={newFood.servingSize} onChangeText={v => setNewFood(p => ({ ...p, servingSize: v }))} placeholder="100" keyboardType="numeric" containerStyle={styles.halfInput} />
              <Input label="Unit" value={newFood.servingUnit} onChangeText={v => setNewFood(p => ({ ...p, servingUnit: v }))} placeholder="g" containerStyle={styles.halfInput} />
            </View>
            <Input label="Calories" value={newFood.calories} onChangeText={v => setNewFood(p => ({ ...p, calories: v }))} placeholder="0" keyboardType="numeric" />
            <View style={styles.row}>
              <Input label="Protein (g)" value={newFood.protein} onChangeText={v => setNewFood(p => ({ ...p, protein: v }))} placeholder="0" keyboardType="numeric" containerStyle={styles.thirdInput} />
              <Input label="Carbs (g)" value={newFood.carbs} onChangeText={v => setNewFood(p => ({ ...p, carbs: v }))} placeholder="0" keyboardType="numeric" containerStyle={styles.thirdInput} />
              <Input label="Fat (g)" value={newFood.fat} onChangeText={v => setNewFood(p => ({ ...p, fat: v }))} placeholder="0" keyboardType="numeric" containerStyle={styles.thirdInput} />
            </View>
            <Button onPress={handleCreate} disabled={saving} fullWidth>
              {saving ? 'Creating...' : 'Create Food'}
            </Button>
          </CardContent>
        </Card>
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
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  resultsList: { gap: spacing.xs },
  resultItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: 2,
  },
  resultName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  resultDetail: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  row: { flexDirection: 'row', gap: spacing.md },
  halfInput: { flex: 1 },
  thirdInput: { flex: 1 },
  bottomPad: { height: spacing['2xl'] },
});
