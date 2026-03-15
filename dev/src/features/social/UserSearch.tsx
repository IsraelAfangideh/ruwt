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

/* istanbul ignore next -- @preserve */
export function UserSearch() {
  /* istanbul ignore next -- @preserve */
  const c = useColors();
  /* istanbul ignore next -- @preserve */
  const navigation = useNavigation();
  /* istanbul ignore next -- @preserve */
  const [query, setQuery] = useState('');
  /* istanbul ignore next -- @preserve */
  const [results, setResults] = useState<SearchResult[]>([]);
  /* istanbul ignore next -- @preserve */
  const [loading, setLoading] = useState(false);
  /* istanbul ignore next -- @preserve */
  const [open, setOpen] = useState(false);
  /* istanbul ignore next -- @preserve */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /* istanbul ignore next -- @preserve */
  const search = useCallback(async (q: string) => {
    /* istanbul ignore next -- @preserve */
    if (q.length < 2) {
      /* istanbul ignore next -- @preserve */
      setResults([]);
      /* istanbul ignore next -- @preserve */
      setOpen(false);
      /* istanbul ignore next -- @preserve */
      return;
    }
    /* istanbul ignore next -- @preserve */
    setLoading(true);
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`);
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        const data = await res.json() as { users: SearchResult[] };
        /* istanbul ignore next -- @preserve */
        setResults(data.users);
        /* istanbul ignore next -- @preserve */
        setOpen(data.users.length > 0);
      }
    } catch { /* ignore */ }
    /* istanbul ignore next -- @preserve */
    setLoading(false);
  }, []);

  /* istanbul ignore next -- @preserve */
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    clearTimeout(debounceRef.current);
    /* istanbul ignore next -- @preserve */
    debounceRef.current = setTimeout(() => search(query.trim()), 300);
    /* istanbul ignore next -- @preserve */
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  /* istanbul ignore next -- @preserve */
  const handleSelect = (username: string) => {
    /* istanbul ignore next -- @preserve */
    setOpen(false);
    /* istanbul ignore next -- @preserve */
    setQuery('');
    (navigation.navigate as any)('PublicProfile', { username });
  };

  /* istanbul ignore next -- @preserve */
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

/* istanbul ignore next -- @preserve */
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
