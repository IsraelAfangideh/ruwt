/**
 * BookmarkButton: Toggle bookmark on challenges or replays.
 */
import { useState, useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';

interface BookmarkButtonProps {
  targetType: 'challenge' | 'replay';
  targetId: string;
  initialBookmarked?: boolean;
  size?: number;
}

export function BookmarkButton({ targetType, targetId, initialBookmarked = false, size = 18 }: BookmarkButtonProps) {
  const c = useColors();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (loading) return;
    setLoading(true);
    const prev = bookmarked;
    setBookmarked(!prev); // Optimistic
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (res.ok) {
        const data = await res.json() as { bookmarked: boolean };
        setBookmarked(data.bookmarked);
      } else {
        setBookmarked(prev); // Revert
      }
    } catch {
      setBookmarked(prev); // Revert
    }
    setLoading(false);
  }, [targetType, targetId, bookmarked, loading]);

  return (
    <Pressable
      onPress={handleToggle}
      disabled={loading}
      style={[styles.button, { opacity: loading ? 0.5 : 1 }]}
      accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      accessibilityRole="button"
      testID="bookmark-button"
    >
      <Text style={{ fontSize: size, color: bookmarked ? c.accent : c.textMuted }}>
        {bookmarked ? '\u2605' : '\u2606'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
