/**
 * ReactionBar: Inline emoji reaction buttons with counts.
 * Toggle on click via POST /api/reactions. Optimistic UI.
 */
import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/shared/theme';
import { fontSizes } from '@/shared/theme/tokens';

const EMOJI_MAP: Record<string, string> = {
  thumbs_up: '\u{1F44D}',
  fire: '\u{1F525}',
  brain: '\u{1F9E0}',
  heart: '\u{2764}\u{FE0F}',
  eyes: '\u{1F440}',
  rocket: '\u{1F680}',
};

const EMOJI_ORDER = ['thumbs_up', 'fire', 'brain', 'heart', 'eyes', 'rocket'];

interface ReactionBarProps {
  targetType: 'challenge_comment' | 'replay_comment';
  targetId: string;
  reactions: Record<string, number>;
  userReaction: string | null;
  onUpdate?: (reactions: Record<string, number>, userReaction: string | null) => void;
}

export function ReactionBar({ targetType, targetId, reactions: initialReactions, userReaction: initialUserReaction, onUpdate }: ReactionBarProps) {
  const c = useColors();
  const [reactions, setReactions] = useState(initialReactions);
  const [userReaction, setUserReaction] = useState(initialUserReaction);
  const [pending, setPending] = useState(false);

  const handleReaction = useCallback(async (emoji: string) => {
    if (pending) return;
    setPending(true);

    // Optimistic update
    const wasSelected = userReaction === emoji;
    const newReactions = { ...reactions };
    if (wasSelected) {
      newReactions[emoji] = Math.max(0, (newReactions[emoji] || 0) - 1);
      if (newReactions[emoji] === 0) delete newReactions[emoji];
    } else {
      // Remove old reaction if different emoji
      if (userReaction && userReaction !== emoji) {
        newReactions[userReaction] = Math.max(0, (newReactions[userReaction] || 0) - 1);
        if (newReactions[userReaction] === 0) delete newReactions[userReaction];
      }
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
    }
    const newUserReaction = wasSelected ? null : emoji;
    setReactions(newReactions);
    setUserReaction(newUserReaction);

    try {
      // If switching emojis, remove old first
      if (!wasSelected && userReaction && userReaction !== emoji) {
        await fetch('/api/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, targetId, emoji: userReaction }),
        });
      }

      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, emoji }),
      });

      if (res.ok) {
        const data = await res.json() as { action: string; reactionCounts: Record<string, number> };
        setReactions(data.reactionCounts);
        onUpdate?.(data.reactionCounts, newUserReaction);
      }
    } catch {
      // Revert on error
      setReactions(initialReactions);
      setUserReaction(initialUserReaction);
    } finally {
      setPending(false);
    }
  }, [targetType, targetId, reactions, userReaction, pending, initialReactions, initialUserReaction, onUpdate]);

  return (
    <View style={styles.container}>
      {EMOJI_ORDER.map((emoji) => {
        const count = reactions[emoji] || 0;
        const isActive = userReaction === emoji;
        const hasCount = count > 0;

        return (
          <Pressable
            key={emoji}
            onPress={() => handleReaction(emoji)}
            style={[
              styles.button,
              {
                backgroundColor: isActive ? `${c.accent}20` : 'transparent',
                borderColor: isActive ? c.accent : hasCount ? c.border : 'transparent',
                borderWidth: hasCount || isActive ? 1 : 0,
              },
            ]}
            testID={`reaction-${emoji}`}
          >
            <Text style={styles.emoji}>{EMOJI_MAP[emoji]}</Text>
            {hasCount && (
              <Text style={[styles.count, { color: isActive ? c.accent : c.textMuted }]}>
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  emoji: {
    fontSize: 14,
  },
  count: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
});
