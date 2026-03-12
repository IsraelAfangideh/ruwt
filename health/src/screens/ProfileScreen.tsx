/**
 * Profile/Settings screen — goals, units, theme, sign out.
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors, useTheme } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button, Input, Card, CardContent, CardTitle } from '@/components/ui';
import { useAuth } from '@/lib/AuthContext';
import { createClient } from '@/lib/supabase/client';

export function ProfileScreen() {
  const c = useColors();
  const { mode, setMode } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [goals, setGoals] = useState({
    calorieTarget: '2000',
    proteinTarget: '150',
    carbsTarget: '200',
    fatTarget: '67',
    waterTarget: '8',
    weightGoal: '',
    activityLevel: 'moderate',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/goals')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setGoals({
            calorieTarget: String(data.calorieTarget || 2000),
            proteinTarget: String(data.proteinTarget || 150),
            carbsTarget: String(data.carbsTarget || 200),
            fatTarget: String(data.fatTarget || 67),
            waterTarget: String(data.waterTarget || 8),
            weightGoal: data.weightGoal ? String(data.weightGoal) : '',
            activityLevel: data.activityLevel || 'moderate',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calorieTarget: parseInt(goals.calorieTarget) || 2000,
          proteinTarget: parseInt(goals.proteinTarget) || 150,
          carbsTarget: parseInt(goals.carbsTarget) || 200,
          fatTarget: parseInt(goals.fatTarget) || 67,
          waterTarget: parseInt(goals.waterTarget) || 8,
          weightGoal: goals.weightGoal ? parseFloat(goals.weightGoal) : null,
          activityLevel: goals.activityLevel,
        }),
      });
    } catch {}
    setSaving(false);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
      </View>

      {/* Account Info */}
      <Card>
        <CardTitle>Account</CardTitle>
        <CardContent>
          <Text style={[styles.infoText, { color: c.text }]}>
            {user?.email || 'Not signed in'}
          </Text>
          <Text style={[styles.infoSubtext, { color: c.textMuted }]}>
            Shared with ruwt.dev
          </Text>
        </CardContent>
      </Card>

      {/* Nutrition Goals */}
      <Card>
        <CardTitle>Daily Goals</CardTitle>
        <CardContent>
          <Input label="Calorie Target" value={goals.calorieTarget} onChangeText={v => setGoals(g => ({ ...g, calorieTarget: v }))} keyboardType="numeric" />
          <View style={styles.row}>
            <Input label="Protein (g)" value={goals.proteinTarget} onChangeText={v => setGoals(g => ({ ...g, proteinTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
            <Input label="Carbs (g)" value={goals.carbsTarget} onChangeText={v => setGoals(g => ({ ...g, carbsTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
            <Input label="Fat (g)" value={goals.fatTarget} onChangeText={v => setGoals(g => ({ ...g, fatTarget: v }))} keyboardType="numeric" containerStyle={styles.thirdInput} />
          </View>
          <Input label="Water (cups)" value={goals.waterTarget} onChangeText={v => setGoals(g => ({ ...g, waterTarget: v }))} keyboardType="numeric" />
          <Input label="Target Weight" value={goals.weightGoal} onChangeText={v => setGoals(g => ({ ...g, weightGoal: v }))} keyboardType="numeric" placeholder="Optional" />
          <Button onPress={handleSaveGoals} disabled={saving} fullWidth>
            {saving ? 'Saving...' : 'Save Goals'}
          </Button>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardContent>
          <View style={styles.themeRow}>
            <Pressable
              onPress={() => setMode('light')}
              style={[
                styles.themeBtn,
                { borderColor: c.border },
                mode === 'light' && { borderColor: c.accent, backgroundColor: c.accentBg },
              ]}
            >
              <Text style={[styles.themeLabel, { color: c.text }]}>☀️ Light</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('dark')}
              style={[
                styles.themeBtn,
                { borderColor: c.border },
                mode === 'dark' && { borderColor: c.accent, backgroundColor: c.accentBg },
              ]}
            >
              <Text style={[styles.themeLabel, { color: c.text }]}>🌙 Dark</Text>
            </Pressable>
          </View>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button onPress={handleSignOut} variant="destructive" fullWidth>
        Sign Out
      </Button>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.xs },
  backText: { fontSize: fontSizes.sm, fontFamily: fontFamily.body },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    fontFamily: fontFamily.display,
  },
  infoText: { fontSize: fontSizes.md, fontFamily: fontFamily.body },
  infoSubtext: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
  row: { flexDirection: 'row', gap: spacing.md },
  thirdInput: { flex: 1 },
  themeRow: { flexDirection: 'row', gap: spacing.md },
  themeBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeLabel: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  bottomPad: { height: spacing['2xl'] },
});
