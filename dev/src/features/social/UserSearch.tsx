/**
 * UserSearch: Search for users by username or name.
 * Shows results in a dropdown. Navigates to public profile on click.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Avatar } from '@/shared/ui/Avatar';
import { useColors } from '@/shared/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/shared/theme/tokens';

interface SearchResult {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export function UserSearch() {
  const c = useColors();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json() as { users: SearchResult[] };
        setResults(data.users);
        setOpen(data.users.length > 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  const handleSelect = (username: string) => {
    setOpen(false);
    setQuery('');
    (navigation.navigate as any)('PublicProfile', { username });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={[styles.searchIcon, { color: c.textMuted }]}>&#x1F50D;</Text>
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder="Search users..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          testID="user-search-input"
        />
        {loading && <ActivityIndicator size="small" color={c.accent} />}
      </View>

      {open && results.length > 0 && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }]}>
            {results.map((user) => (
              <Pressable
                key={user.username}
                style={({ pressed }: { pressed: boolean }) => [
                  styles.resultRow,
                  { borderBottomColor: c.border },
                  pressed && { backgroundColor: c.accentBg },
                ]}
                onPress={() => user.username && handleSelect(user.username)}
                testID={`search-result-${user.username}`}
              >
                <Avatar src={user.avatarUrl} fallback={(user.name || user.username || '?')[0]} size={32} />
                <View style={styles.resultText}>
                  <Text style={[styles.resultName, { color: c.text }]} numberOfLines={1}>
                    {user.name || user.username}
                  </Text>
                  <Text style={[styles.resultUsername, { color: c.textMuted }]}>
                    @{user.username}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchIcon: { fontSize: 14 },
  input: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    paddingVertical: spacing.sm,
    outlineStyle: 'none',
  } as any,
  backdrop: {
    position: 'fixed' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 4,
    maxHeight: 320,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  resultText: { flex: 1 },
  resultName: { fontSize: fontSizes.sm, fontWeight: '600', fontFamily: fontFamily.body },
  resultUsername: { fontSize: fontSizes.xs, fontFamily: fontFamily.body },
});
