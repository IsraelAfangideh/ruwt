import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColors } from '@/theme';
import { spacing, fontSizes, fontFamily, radii } from '@/theme/tokens';
import { Button } from '@/components/ui';
import { PublicLayout } from '@/layout/PublicLayout';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { getBlogPost } from '@/content/blog/posts';
import { copyInstallCommand } from '@/lib/marketing/tracking';

export function BlogPostScreen() {
  const c = useColors();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug as string;
  const post = getBlogPost(slug);
  useVisitorTracking(`/blog/${slug}`);

  if (!post) {
    return (
      <PublicLayout active="blog">
        <View style={styles.missing}>
          <Text style={{ color: c.text }}>Post not found.</Text>
          <Pressable onPress={() => navigation.navigate('Blog')}>
            <Text style={{ color: c.accent }}>Back to blog</Text>
          </Pressable>
        </View>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout active="blog">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.navigate('Blog')}>
          <Text style={[styles.back, { color: c.accent }]}>← All posts</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{post.title}</Text>
        <Text style={[styles.meta, { color: c.textSubtle }]}>
          {post.publishedAt} · {post.readMinutes} min read
        </Text>

        {post.body.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={[styles.paragraph, { color: c.textMuted }]}>
            {paragraph}
          </Text>
        ))}

        <View style={[styles.cta, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.ctaTitle, { color: c.text }]}>Try the collector</Text>
          <Text style={[styles.ctaDesc, { color: c.textMuted }]}>
            Install locally in one command — no account required.
          </Text>
          <Button
            onPress={() => {
              void copyInstallCommand('landing').finally(() => navigation.navigate('Download'));
            }}
          >
            Download
          </Button>
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
    gap: spacing.md,
  },
  missing: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
  back: { fontSize: fontSizes.sm, fontWeight: '600' },
  title: { fontFamily: fontFamily.display, fontSize: fontSizes['3xl'], lineHeight: 38, fontWeight: '700' },
  meta: { fontSize: fontSizes.xs, fontWeight: '600', marginBottom: spacing.sm },
  paragraph: { fontSize: fontSizes.md, lineHeight: 26 },
  cta: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  ctaTitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  ctaDesc: { fontSize: fontSizes.sm, lineHeight: 21, marginBottom: spacing.xs },
});
