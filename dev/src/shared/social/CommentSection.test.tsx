// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    card: '#fff', background: '#fff',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));
vi.mock('./ReactionBar', () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));

const mockComments = [
  {
    id: 'c1',
    content: 'Great challenge!',
    solveCost: 500,
    parentId: null,
    createdAt: new Date(Date.now() - 120000).toISOString(), // 2 mins ago
    user: { id: 'u1', name: 'Alice', username: 'alice', avatarUrl: null },
    reactions: { thumbs_up: 3 },
    userReaction: null,
  },
  {
    id: 'c2',
    content: 'I agree!',
    solveCost: null,
    parentId: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hrs ago
    user: { id: 'u2', name: 'Bob', username: 'bob', avatarUrl: 'https://example.com/bob.png' },
    reactions: {},
    userReaction: null,
  },
];

const mockCommentsWithReply = [
  ...mockComments,
  {
    id: 'c3',
    content: 'Thanks!',
    solveCost: null,
    parentId: 'c1',
    createdAt: new Date(Date.now() - 60000).toISOString(),
    user: { id: 'u1', name: 'Alice', username: 'alice', avatarUrl: null },
    reactions: {},
    userReaction: null,
  },
];

function setupFetch(comments: any[] = mockComments) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts?: any) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          comment: {
            id: 'c-new',
            content: body.content,
            solveCost: null,
            parentId: body.parentId || null,
            createdAt: new Date().toISOString(),
            user: { id: 'u1', name: 'Me', username: 'me', avatarUrl: null },
            reactions: {},
            userReaction: null,
          },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ comments }),
    });
  }));
}

const { CommentSection } = await import('./CommentSection');

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state then comments', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    // After loading, comments appear
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });
    expect(screen.getByText('I agree!')).toBeTruthy();
  });

  it('shows user names', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows empty state when no comments', async () => {
    setupFetch([]);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('No comments yet. Be the first!')).toBeTruthy();
    });
  });

  it('renders comment input with placeholder', async () => {
    setupFetch([]);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('comment-input')).toBeTruthy();
    });
    expect(screen.getByTestId('comment-submit')).toBeTruthy();
  });

  it('uses custom prompt text for input placeholder', async () => {
    setupFetch([]);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" promptText="Share your thoughts..." />,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share your thoughts...')).toBeTruthy();
    });
  });

  it('submits new comment', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });

    const input = screen.getByTestId('comment-input');
    fireEvent.change(input, { target: { value: 'My new comment' } });
    fireEvent.click(screen.getByTestId('comment-submit'));

    await waitFor(() => {
      expect(screen.getByText('My new comment')).toBeTruthy();
    });
    // Verify POST was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/comments/ch1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows Reply button on top-level comments for challenge type', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Reply').length).toBe(2);
    });
  });

  it('does not show Reply button for replay type', async () => {
    setupFetch();
    render(
      <CommentSection targetType="replay" targetId="r1" apiPath="/api/comments/r1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });
    expect(screen.queryByText('Reply')).toBeNull();
  });

  it('shows reply input when Reply is clicked', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Reply').length).toBe(2);
    });
    fireEvent.click(screen.getAllByText('Reply')[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reply...')).toBeTruthy();
    });
  });

  it('toggles Reply button to Cancel when reply input is shown', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getAllByText('Reply').length).toBe(2);
    });
    fireEvent.click(screen.getAllByText('Reply')[0]);
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy();
    });
    // Click Cancel to close
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Cancel')).toBeNull();
    });
  });

  it('has sort toggle when multiple comments exist', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Recent')).toBeTruthy();
    });
    expect(screen.getByText('Top')).toBeTruthy();
  });

  it('does not show sort toggle with zero or one comment', async () => {
    setupFetch([mockComments[0]]);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });
    expect(screen.queryByText('Recent')).toBeNull();
    expect(screen.queryByText('Top')).toBeNull();
  });

  it('refetches when sort changes', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Recent')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Top'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('sort=top'));
    });
  });

  it('renders ReactionBar for each comment', async () => {
    setupFetch();
    const { container } = render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });
    const reactionBars = container.querySelectorAll('[data-testid="reaction-bar"]');
    expect(reactionBars.length).toBe(2);
  });

  it('renders nested replies', async () => {
    setupFetch(mockCommentsWithReply);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Thanks!')).toBeTruthy();
    });
  });

  it('shows solve cost badge when present', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('$0.05')).toBeTruthy();
    });
  });

  it('shows Anonymous for users with no name', async () => {
    const noNameComments = [{
      id: 'c4',
      content: 'anon comment',
      solveCost: null,
      parentId: null,
      createdAt: new Date().toISOString(),
      user: { id: 'u5', name: null, username: null, avatarUrl: null },
      reactions: {},
      userReaction: null,
    }];
    setupFetch(noNameComments);
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Anonymous')).toBeTruthy();
    });
  });

  it('does not submit empty comment', async () => {
    setupFetch();
    render(
      <CommentSection targetType="challenge" targetId="ch1" apiPath="/api/comments/ch1" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Great challenge!')).toBeTruthy();
    });
    // Click submit without typing anything
    fireEvent.click(screen.getByTestId('comment-submit'));
    // POST should not be called (only GET for initial fetch)
    const postCalls = (global.fetch as any).mock.calls.filter(
      (c: any[]) => c[1]?.method === 'POST',
    );
    expect(postCalls.length).toBe(0);
  });
});
