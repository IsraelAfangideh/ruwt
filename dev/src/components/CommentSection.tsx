/**
 * CommentSection: Reusable comment list + input for challenges and replays.
 * Shows comments with avatars, timestamps, reactions, and single-level replies.
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily } from '@/theme/tokens';
import { CommentListSkeleton } from '@/components/ui/ScreenSkeletons';
import { ReactionBar } from './ReactionBar';
import { timeAgo } from '@/lib/utils';
import { formatCostFromHundredths } from '@/lib/ai/pricing';

interface CommentUser {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  solveCost?: number | null;
  parentId?: string | null;
  createdAt: string;
  user: CommentUser;
  reactions: Record<string, number>;
  userReaction: string | null;
}

interface CommentSectionProps {
  targetType: 'challenge' | 'replay';
  targetId: string;
  apiPath: string;
  promptText?: string;
}

/** Render text with @mentions as clickable links */
function MentionText({ content, color, accentColor, onMentionPress }: { content: string; color: string; accentColor: string; onMentionPress: (username: string) => void }) {
  const parts = content.split(/(@[a-z0-9][a-z0-9-]{1,28}[a-z0-9])/g);
  return (
    <Text style={[styles.content, { color }]}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && /^@[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(part)) {
          const username = part.slice(1);
          return (
            <Text
              key={i}
              style={{ color: accentColor, fontWeight: '600' }}
              onPress={() => onMentionPress(username)}
              accessibilityRole="link"
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export function CommentSection({ targetType, targetId: _targetId, apiPath, promptText }: CommentSectionProps) {
  void _targetId; // reserved for future use
  const c = useColors();
  const navigation = useNavigation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [sort, setSort] = useState<'recent' | 'top'>('recent');

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${apiPath}?sort=${sort}&limit=50`);
      if (res.ok) {
        const data = await res.json() as { comments: Comment[] };
        setComments(data.comments ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiPath, sort]);

  useEffect(() => {
    setLoading(true);
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);

    try {
      const body: Record<string, string> = { content: trimmed };
      if (replyTo) body.parentId = replyTo;

      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json() as { comment: Comment };
        setComments((prev) => [data.comment, ...prev]);
        setText('');
        setReplyTo(null);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }, [text, submitting, replyTo, apiPath]);

  // Separate top-level and replies
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);
  const repliesByParent: Record<string, Comment[]> = {};
  for (const r of replies) {
    if (r.parentId) {
      if (!repliesByParent[r.parentId]) repliesByParent[r.parentId] = [];
      repliesByParent[r.parentId].push(r);
    }
  }

  const reactionTargetType = targetType === 'challenge' ? 'challenge_comment' : 'replay_comment';

  const renderComment = (comment: Comment, isReply = false) => (
    <View
      key={comment.id}
      style={[
        styles.comment,
        { borderBottomColor: c.border },
        isReply && styles.reply,
      ]}
    >
      <View style={styles.commentHeader}>
        <View style={styles.avatar}>
          {comment.user.avatarUrl ? (
            <img
              src={comment.user.avatarUrl}
              alt=""
              style={{ width: 24, height: 24, borderRadius: 12 }}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: c.border }]}>
              <Text style={{ fontSize: 10, color: c.textMuted }}>
                {(comment.user.name || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.userName, { color: c.text }]}>
          {comment.user.name || 'Anonymous'}
        </Text>
        {comment.solveCost != null && comment.solveCost > 0 && (
          <Text style={[styles.costBadge, { color: c.accent }]}>
            {formatCostFromHundredths(comment.solveCost)}
          </Text>
        )}
        <Text style={[styles.time, { color: c.textMuted }]}>
          {timeAgo(comment.createdAt)}
        </Text>
      </View>
      <MentionText
        content={comment.content}
        color={c.text}
        accentColor={c.accent as string}
        onMentionPress={(username) => (navigation.navigate as any)('PublicProfile', { username })}
      />
      <View style={styles.commentFooter}>
        <ReactionBar
          targetType={reactionTargetType}
          targetId={comment.id}
          reactions={comment.reactions}
          userReaction={comment.userReaction}
        />
        {!isReply && targetType === 'challenge' && (
          <Pressable onPress={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
            <Text style={[styles.replyButton, { color: c.textMuted }]}>
              {replyTo === comment.id ? 'Cancel' : 'Reply'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Inline reply input */}
      {replyTo === comment.id && (
        <View style={[styles.replyInput, { borderColor: c.border }]}>
          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border }]}
            placeholder="Write a reply..."
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !text.trim()}
            style={[styles.submitButton, { backgroundColor: c.accent, opacity: submitting || !text.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.submitText}>Reply</Text>
          </Pressable>
        </View>
      )}

      {/* Nested replies */}
      {repliesByParent[comment.id]?.map((r) => renderComment(r, true))}
    </View>
  );

  return (
    <View style={styles.container} testID="comment-section">
      {/* Sort toggle */}
      {comments.length > 1 && (
        <View style={styles.sortRow}>
          <Pressable onPress={() => setSort('recent')}>
            <Text style={[styles.sortOption, { color: sort === 'recent' ? c.accent : c.textMuted }]}>
              Recent
            </Text>
          </Pressable>
          <Pressable onPress={() => setSort('top')}>
            <Text style={[styles.sortOption, { color: sort === 'top' ? c.accent : c.textMuted }]}>
              Top
            </Text>
          </Pressable>
        </View>
      )}

      {/* Comment input (top-level, shown when not replying) */}
      {!replyTo && (
        <View style={[styles.inputRow, { borderColor: c.border }]}>
          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border }]}
            placeholder={promptText || 'Write a comment...'}
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            testID="comment-input"
          />
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !text.trim()}
            style={[styles.submitButton, { backgroundColor: c.accent, opacity: submitting || !text.trim() ? 0.5 : 1 }]}
            testID="comment-submit"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#0d1117" />
            ) : (
              <Text style={styles.submitText}>Post</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Comments list */}
      {loading ? (
        <CommentListSkeleton />
      ) : topLevel.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          No comments yet. Be the first!
        </Text>
      ) : (
        topLevel.map((comment) => renderComment(comment))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: 4,
  },
  sortOption: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputRow: {
    gap: 8,
  },
  input: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    minHeight: 40,
    maxHeight: 100,
  },
  submitButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
  },
  submitText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#0d1117',
  },
  comment: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: 4,
  },
  reply: {
    marginLeft: 24,
    borderBottomWidth: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {},
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  costBadge: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  time: {
    fontSize: fontSizes.xs,
    marginLeft: 'auto',
  },
  content: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.body,
    lineHeight: 20,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  replyButton: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  replyInput: {
    marginTop: 4,
    gap: 4,
  },
  empty: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
