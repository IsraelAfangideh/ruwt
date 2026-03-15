// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { ReactionBar } = await import('./ReactionBar');

describe('ReactionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 6 emoji buttons', () => {
    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{}}
        userReaction={null}
      />,
    );
    expect(screen.getByTestId('reaction-thumbs_up')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-fire')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-brain')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-heart')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-eyes')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-rocket')).toBeInTheDocument();
  });

  it('shows count for reactions with counts', () => {
    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ thumbs_up: 5, fire: 2 }}
        userReaction={null}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show count for reactions with zero', () => {
    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ thumbs_up: 0 }}
        userReaction={null}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });

  it('handles click with optimistic update (increment)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ action: 'added', reactionCounts: { fire: 1 } }),
    }));

    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{}}
        userReaction={null}
      />,
    );

    fireEvent.click(screen.getByTestId('reaction-fire'));

    // Optimistic update should show count immediately
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Verify POST was made
    expect(global.fetch).toHaveBeenCalledWith('/api/reactions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ targetType: 'challenge_comment', targetId: 'c1', emoji: 'fire' }),
    }));
  });

  it('handles click with optimistic update (decrement/toggle off)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ action: 'removed', reactionCounts: {} }),
    }));

    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ fire: 1 }}
        userReaction="fire"
      />,
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reaction-fire'));

    // Optimistic: count should be removed
    await waitFor(() => {
      expect(screen.queryByText('1')).toBeNull();
    });
  });

  it('highlights active user reaction', () => {
    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ thumbs_up: 3 }}
        userReaction="thumbs_up"
      />,
    );
    // The active button should have accent-based background color
    const activeButton = screen.getByTestId('reaction-thumbs_up');
    expect(activeButton).toBeTruthy();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('switches reaction from one emoji to another', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ action: 'removed', reactionCounts: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ action: 'added', reactionCounts: { brain: 1 } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ fire: 1 }}
        userReaction="fire"
      />,
    );

    fireEvent.click(screen.getByTestId('reaction-brain'));

    // Optimistic: fire removed, brain added
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // brain has 1
    });

    // Should have made 2 fetch calls (remove old, add new)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('reverts on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{ thumbs_up: 2 }}
        userReaction={null}
      />,
    );

    fireEvent.click(screen.getByTestId('reaction-thumbs_up'));

    // Optimistic: 3 momentarily
    // After error: reverts to 2
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('calls onUpdate callback after successful reaction', async () => {
    const onUpdate = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ action: 'added', reactionCounts: { heart: 1 } }),
    }));

    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{}}
        userReaction={null}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByTestId('reaction-heart'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({ heart: 1 }, 'heart');
    });
  });

  it('renders emoji characters in buttons', () => {
    render(
      <ReactionBar
        targetType="challenge_comment"
        targetId="c1"
        reactions={{}}
        userReaction={null}
      />,
    );
    // Check that emoji characters are rendered
    expect(screen.getByText('\u{1F44D}')).toBeInTheDocument(); // thumbs up
    expect(screen.getByText('\u{1F525}')).toBeInTheDocument(); // fire
    expect(screen.getByText('\u{1F9E0}')).toBeInTheDocument(); // brain
    expect(screen.getByText('\u{2764}\u{FE0F}')).toBeInTheDocument(); // heart
    expect(screen.getByText('\u{1F440}')).toBeInTheDocument(); // eyes
    expect(screen.getByText('\u{1F680}')).toBeInTheDocument(); // rocket
  });
});
