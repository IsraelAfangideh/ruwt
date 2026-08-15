import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '@/layout/DashboardLayout';
import { useAuth } from '@/lib/AuthContext';
import { useColors } from '@/theme';
import { fontFamily, fontSizes, radii, spacing } from '@/theme/tokens';
import { Button, Input } from '@/components/ui';

type Org = { id: string; name: string; role: string; memberCount: number };
type ApiKey = { id: string; name: string; keyPrefix: string; createdAt: string };

export function OrgSettingsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const c = useColors();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [keyName, setKeyName] = useState('Desktop collector');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrgs = async () => {
    const response = await fetch('/api/orgs');
    if (!response.ok) throw new Error('Could not load workspaces.');
    const items = await response.json() as Org[];
    setOrgs(items);
    if (!selectedOrgId && items[0]) setSelectedOrgId(items[0].id);
    return items;
  };

  const loadKeys = async (orgId: string) => {
    if (!orgId) return;
    const response = await fetch(`/api/intelligence/api-keys?orgId=${encodeURIComponent(orgId)}`);
    if (!response.ok) return;
    const data = await response.json() as { keys: ApiKey[] };
    setKeys(data.keys);
  };

  useEffect(() => {
    if (!user) return;
    loadOrgs().then((items) => {
      if (items[0]) void loadKeys(items[0].id);
    }).catch(() => setError('Could not load workspaces.'));
  }, [user]);

  useEffect(() => {
    if (selectedOrgId) void loadKeys(selectedOrgId);
  }, [selectedOrgId]);

  const createOrg = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!response.ok) throw new Error('Could not create workspace.');
      setOrgName('');
      setMessage('Workspace created.');
      const items = await loadOrgs();
      if (items[0]) setSelectedOrgId(items[0].id);
    } catch (e: any) {
      setError(e.message || 'Could not create workspace.');
    } finally {
      setBusy(false);
    }
  };

  const createKey = async () => {
    if (!selectedOrgId) return;
    setBusy(true);
    setError('');
    setMessage('');
    setNewKey('');
    try {
      const response = await fetch('/api/intelligence/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: selectedOrgId, name: keyName.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create ingestion key.');
      setNewKey(data.key);
      setMessage(data.warning);
      await loadKeys(selectedOrgId);
    } catch (e: any) {
      setError(e.message || 'Could not create ingestion key.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.navigate('Dashboard')}>
          <Text style={[styles.back, { color: c.accent }]}>← Back to dashboard</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>Workspace settings</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>Create an organization, then issue ingestion keys for desktop collectors and adapters.</Text>

        {error ? <View style={[styles.notice, { backgroundColor: c.errorBg }]}><Text style={{ color: c.error }}>{error}</Text></View> : null}
        {message ? <View style={[styles.notice, { backgroundColor: c.successBg }]}><Text style={{ color: c.success }}>{message}</Text></View> : null}

        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Create workspace</Text>
          <Input label="Organization name" value={orgName} onChangeText={setOrgName} placeholder="Acme Engineering" />
          <Button onPress={createOrg} disabled={busy || !orgName.trim()} fullWidth>Create workspace</Button>
        </View>

        {orgs.length ? (
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Your workspaces</Text>
            <View style={styles.orgList}>
              {orgs.map((org) => (
                <Pressable key={org.id} onPress={() => setSelectedOrgId(org.id)} style={[styles.orgItem, selectedOrgId === org.id && { backgroundColor: c.accentBg }]}>
                  <Text style={[styles.orgName, { color: c.text }]}>{org.name}</Text>
                  <Text style={[styles.orgMeta, { color: c.textMuted }]}>{org.role} · {org.memberCount} members</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {selectedOrgId ? (
          <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Ingestion keys</Text>
            <Input label="Key label" value={keyName} onChangeText={setKeyName} placeholder="Desktop collector" />
            <Button onPress={createKey} disabled={busy} variant="outline" fullWidth>Create ingestion key</Button>
            {newKey ? (
              <View style={[styles.keyBox, { borderColor: c.borderStrong, backgroundColor: c.bgWarm }]}>
                <Text style={[styles.keyLabel, { color: c.textMuted }]}>Copy now — shown once</Text>
                <Text selectable style={[styles.keyValue, { color: c.text }]}>{newKey}</Text>
              </View>
            ) : null}
            {keys.map((key) => (
              <View key={key.id} style={[styles.keyRow, { borderTopColor: c.border }]}>
                <Text style={[styles.keyName, { color: c.text }]}>{key.name}</Text>
                <Text style={[styles.keyMeta, { color: c.textMuted }]}>{key.keyPrefix}… · {new Date(key.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing['2xl'] },
  back: { fontSize: fontSizes.sm, fontWeight: '600' },
  title: { fontFamily: fontFamily.display, fontSize: fontSizes['4xl'], fontWeight: '700' },
  subtitle: { fontSize: fontSizes.sm, lineHeight: 21, maxWidth: 640 },
  notice: { padding: spacing.md, borderRadius: radii.md },
  card: { borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, gap: spacing.md },
  cardTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  orgList: { gap: 4 },
  orgItem: { padding: spacing.sm, borderRadius: radii.sm, gap: 2 },
  orgName: { fontSize: fontSizes.sm, fontWeight: '700' },
  orgMeta: { fontSize: fontSizes.xs },
  keyBox: { padding: spacing.md, borderWidth: 1, borderRadius: radii.sm, gap: spacing.sm },
  keyLabel: { fontSize: fontSizes.xs, fontWeight: '600' },
  keyValue: { fontFamily: fontFamily.mono, fontSize: fontSizes.sm },
  keyRow: { paddingTop: spacing.sm, borderTopWidth: 1, gap: 2 },
  keyName: { fontSize: fontSizes.sm, fontWeight: '600' },
  keyMeta: { fontSize: fontSizes.xs },
});
