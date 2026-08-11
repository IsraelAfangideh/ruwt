import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes } from '@/shared/theme/tokens';
import { usernameProblem, normalizeUsername } from '@/shared/lib/username';

interface UsernameClaimProps {
  /** The handle already on the account, if any. */
  value: string | null;
  /** Runs after the server accepts a new handle. */
  onSaved: (username: string) => void;
  saveLabel?: string;
  testID?: string;
}

/**
 * Claims a public handle.
 *
 * Without one a user has no public profile, so every replay they produce is
 * unattributable and unshareable. The endpoint has always supported this;
 * until now nothing in the product asked.
 */
export function UsernameClaim({ value, onSaved, saveLabel = 'Claim', testID = 'username-claim' }: UsernameClaimProps) {
  const c = useColors();
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const candidate = normalizeUsername(draft);
    const problem = usernameProblem(candidate);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: candidate }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        // 409 is the common one and deserves plain words, not a status code.
        setError(res.status === 409 ? 'That handle is taken. Try another.' : data.error || 'Could not save. Try again.');
        return;
      }
      onSaved(candidate);
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID={testID}>
      <View style={styles.row}>
        <Text style={[styles.at, { color: c.textMuted }]}>@</Text>
        <Input
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          onSubmitEditing={() => { if (!saving) void save(); }}
          placeholder="your-handle"
          autoCapitalize="none"
          containerStyle={{ flex: 1 }}
          inputStyle={error ? { borderColor: c.error } : undefined}
          testID="username-input"
        />
        <Button onPress={save} disabled={saving} testID="username-save">
          {saving ? 'Saving...' : saveLabel}
        </Button>
      </View>
      {error && (
        <Text style={[styles.message, { color: c.error }]} testID="username-error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  at: {
    fontSize: fontSizes.md,
  },
  message: {
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});
