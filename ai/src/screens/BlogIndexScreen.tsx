import { useNavigation } from '@react-navigation/native';
import { MarketingChrome } from '@/marketing/MarketingChrome';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { blogPosts } from '@/content/blog/posts';

export function BlogIndexScreen() {
  const navigation = useNavigation<any>();
  useVisitorTracking('/blog');

  return (
    <MarketingChrome active="blog">
      <main className="mk-shell mk-article">
        <p className="mk-kicker">Journal</p>
        <h1 className="mk-display" style={{ fontSize: 'clamp(36px, 6vw, 56px)' }}>
          Agentic observability
        </h1>
        <p className="mk-deck">Notes on evidence, policy, and the market forming around agent governance.</p>
        <div className="mk-post-list">
          {blogPosts.map((post) => (
            <button
              key={post.slug}
              type="button"
              className="mk-post"
              onClick={() => navigation.navigate('BlogPost', { slug: post.slug })}
            >
              <strong>{post.title}</strong>
              <span>{post.excerpt}</span>
              <em>
                {post.publishedAt} · {post.readMinutes} min
              </em>
            </button>
          ))}
        </div>
      </main>
    </MarketingChrome>
  );
}
