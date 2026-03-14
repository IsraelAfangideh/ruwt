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

export function FollowButton({ username, initialFollowing, onToggle }: FollowButtonProps) {
  const c = useColors();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const data = await res.json() as { following: boolean };
        setFollowing(data.following);
        onToggle?.(data.following);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [username, loading, onToggle]);

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
