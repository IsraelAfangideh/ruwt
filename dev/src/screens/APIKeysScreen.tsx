/**
 * APIKeysScreen: Manage BYOK API keys for commercial models.
 * Route: /api-keys
 */
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';

interface StoredKey {
  id: string;
  provider: string;
  label: string | null;
  createdAt: string | null;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza...' },
] as const;

export function APIKeysScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json() as { keys: StoredKey[] };
        setKeys(data.keys ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
        return;
      }
      setUser(u);
      await fetchKeys();
      setLoading(false);
    };
    init();
  }, [navigation]);

  const handleAdd = async (provider: string) => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: keyInput.trim() }),
      });
      if (res.ok) {
        setAdding(null);
        setKeyInput('');
        await fetchKeys();
      }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await fetchKeys();
    } catch {}
    setDeleting(null);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <Text style={[styles.title, { color: c.text }]}>API Keys</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Add your own API keys to use commercial models (GPT-4o, Claude, Gemini) in the Arena. Keys are encrypted and never shared.
      </Text>

      <ScrollView style={styles.scroll}>
        {PROVIDERS.map((provider) => {
          const existing = keys.find((k) => k.provider === provider.id);
          const isAdding = adding === provider.id;

          return (
            <Card key={provider.id} style={styles.card}>
              <CardHeader>
                <View style={styles.cardHeader}>
                  <CardTitle>{provider.name}</CardTitle>
                  {existing ? (
                    <Badge variant="default">Connected</Badge>
                  ) : (
                    <Badge variant="outline">Not configured</Badge>
                  )}
                </View>
                {existing && (
                  <CardDescription>
                    {existing.label || `${provider.name} key`}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {existing ? (
                  <View style={styles.existingRow}>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => { setAdding(provider.id); setKeyInput(''); }}
                    >
                      Replace Key
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleDelete(existing.id)}
                      disabled={deleting === existing.id}
                    >
                      {deleting === existing.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </View>
                ) : !isAdding ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => { setAdding(provider.id); setKeyInput(''); }}
                  >
                    Add {provider.name} Key
                  </Button>
                ) : null}

                {isAdding && (
                  <View style={styles.addForm}>
                    <TextInput
                      style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                      placeholder={provider.placeholder}
                      placeholderTextColor={c.textMuted as string}
                      value={keyInput}
                      onChangeText={setKeyInput}
                      secureTextEntry
                      autoFocus
                    />
                    <View style={styles.addActions}>
                      <Button
                        size="sm"
                        onPress={() => handleAdd(provider.id)}
                        disabled={saving || !keyInput.trim()}
                      >
                        {saving ? 'Saving...' : 'Save Key'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => { setAdding(null); setKeyInput(''); }}
                      >
                        Cancel
                      </Button>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card style={[styles.card, { backgroundColor: c.muted + '20' }]}>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Your API keys are encrypted before storage and never sent back to the browser. They are only decrypted server-side at the moment of proxying your request to the provider.
            </CardDescription>
          </CardHeader>
        </Card>
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: fontSizes['3xl'], fontWeight: '700', marginBottom: spacing.xs, fontFamily: fontFamily.body },
  subtitle: { fontSize: fontSizes.sm, marginBottom: spacing.lg },
  scroll: { flex: 1 },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  existingRow: { flexDirection: 'row', gap: spacing.sm },
  addForm: { marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    marginBottom: spacing.sm,
  },
  addActions: { flexDirection: 'row', gap: spacing.sm },
});
