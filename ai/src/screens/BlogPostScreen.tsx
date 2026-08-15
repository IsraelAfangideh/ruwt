import { useNavigation, useRoute } from '@react-navigation/native';
import { MarketingChrome } from '@/marketing/MarketingChrome';
import { DownloadButton } from '@/marketing/DownloadButton';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { getBlogPost } from '@/content/blog/posts';

export function BlogPostScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug as string;
  const post = getBlogPost(slug);
  useVisitorTracking(`/blog/${slug}`);

  if (!post) {
    return (
      <MarketingChrome active="blog">
        <main className="mk-shell mk-article">
          <p>Post not found.</p>
          <button type="button" className="mk-link" onClick={() => navigation.navigate('Blog')}>
            Back to blog
          </button>
        </main>
      </MarketingChrome>
    );
  }

  return (
    <MarketingChrome active="blog">
      <main className="mk-shell mk-article">
        <button type="button" className="mk-link" onClick={() => navigation.navigate('Blog')}>
          ← All posts
        </button>
        <h1 className="mk-display" style={{ fontSize: 'clamp(36px, 6vw, 56px)' }}>
          {post.title}
        </h1>
        <p className="mk-kicker">
          {post.publishedAt} · {post.readMinutes} min read
        </p>
        {post.body.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="mk-deck">
            {paragraph}
          </p>
        ))}
        <div style={{ margin: '32px 0 48px' }}>
          <DownloadButton source="landing" />
        </div>
      </main>
    </MarketingChrome>
  );
}
