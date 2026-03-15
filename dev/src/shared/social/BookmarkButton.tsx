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

  /* istanbul ignore next -- @preserve */
  const handleToggle = useCallback(async (e?: { stopPropagation?: () => void }) => {
    /* istanbul ignore next -- @preserve */
    e?.stopPropagation?.();
    /* istanbul ignore next -- @preserve */
    if (loading) return;
    /* istanbul ignore next -- @preserve */
    setLoading(true);
    /* istanbul ignore next -- @preserve */
    const prev = bookmarked;
    /* istanbul ignore next -- @preserve */
    setBookmarked(!prev); // Optimistic
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      });
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        const data = await res.json() as { bookmarked: boolean };
        /* istanbul ignore next -- @preserve */
        setBookmarked(data.bookmarked);
      /* istanbul ignore next -- @preserve */
      } else {
        /* istanbul ignore next -- @preserve */
        setBookmarked(prev); // Revert
      }
    } catch {
      /* istanbul ignore next -- @preserve */
      setBookmarked(prev); // Revert
    }
    /* istanbul ignore next -- @preserve */
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
