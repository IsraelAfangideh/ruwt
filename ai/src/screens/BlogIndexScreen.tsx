import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { PublicLayout } from '@/layout/PublicLayout';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { blogPosts } from '@/content/blog/posts';

export function BlogIndexScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  useVisitorTracking('/blog');

  return (
    <PublicLayout active="blog">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Agentic observability</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Notes on evidence, policy, and the market forming around agent governance.
        </Text>

        <View style={styles.list}>
          {blogPosts.map((post) => (
            <Pressable
              key={post.slug}
              onPress={() => navigation.navigate('BlogPost', { slug: post.slug })}
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            >
              <Text style={[styles.cardTitle, { color: c.text }]}>{post.title}</Text>
              <Text style={[styles.cardExcerpt, { color: c.textMuted }]}>{post.excerpt}</Text>
              <Text style={[styles.cardMeta, { color: c.textSubtle }]}>
                {post.publishedAt} · {post.readMinutes} min read
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </PublicLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  title: { fontFamily: fontFamily.display, fontSize: fontSizes['3xl'], fontWeight: '700' },
  subtitle: { fontSize: fontSizes.md, lineHeight: 24 },
  list: { gap: spacing.md },
  card: { padding: spacing.lg, borderWidth: 1, borderRadius: radii.md, gap: spacing.sm },
  cardTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  cardExcerpt: { fontSize: fontSizes.sm, lineHeight: 21 },
  cardMeta: { fontSize: fontSizes.xs, fontWeight: '600' },
});
