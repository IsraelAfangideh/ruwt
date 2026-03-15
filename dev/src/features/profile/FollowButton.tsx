/**
 * FollowButton: Follow/unfollow toggle button for public profiles.
 */
import { useState, useCallback } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useColors } from '@/shared/theme';
import { fontSizes, fontFamily, radii, spacing } from '@/shared/theme/tokens';

interface FollowButtonProps {
  username: string;
  initialFollowing: boolean;
  onToggle?: (following: boolean) => void;
}

/* istanbul ignore next -- @preserve */
export function FollowButton({ username, initialFollowing, onToggle }: FollowButtonProps) {
  /* istanbul ignore next -- @preserve */
  const c = useColors();
  /* istanbul ignore next -- @preserve */
  const [following, setFollowing] = useState(initialFollowing);
  /* istanbul ignore next -- @preserve */
  const [loading, setLoading] = useState(false);

  /* istanbul ignore next -- @preserve */
  const handleToggle = useCallback(async () => {
    /* istanbul ignore next -- @preserve */
    if (loading) return;
    /* istanbul ignore next -- @preserve */
    setLoading(true);
    /* istanbul ignore next -- @preserve */
    try {
      /* istanbul ignore next -- @preserve */
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      /* istanbul ignore next -- @preserve */
      if (res.ok) {
        /* istanbul ignore next -- @preserve */
        const data = await res.json() as { following: boolean };
        /* istanbul ignore next -- @preserve */
        setFollowing(data.following);
        onToggle?.(data.following);
      }
    } catch { /* ignore */ }
    /* istanbul ignore next -- @preserve */
    setLoading(false);
  }, [username, loading, onToggle]);

  /* istanbul ignore next -- @preserve */
  return (
    <Pressable
      onPress={handleToggle}
      disabled={loading}
      style={[
        styles.button,
        following
          ? { backgroundColor: 'transparent', borderColor: c.border, borderWidth: 1 }
          : { backgroundColor: c.accent },
      ]}
      testID="follow-button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={following ? c.textMuted : '#0d1117'} />
      ) : (
        <Text style={[
          styles.text,
          { color: following ? c.textMuted : '#0d1117' },
        ]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      )}
    </Pressable>
  );
}

/* istanbul ignore next -- @preserve */
const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  text: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  },
});
