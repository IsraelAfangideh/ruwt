// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    muted: '#f5f5f5',
  }),
}));

import { SocialShareButtons } from './SocialShareButtons';

describe('SocialShareButtons', () => {
  const mockWindowOpen = vi.fn();
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    mockWindowOpen.mockReset();
    mockWriteText.mockReset();
    vi.stubGlobal('open', mockWindowOpen);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText.mockResolvedValue(undefined) },
    });
  });

  it('renders Share on X button', () => {
    render(<SocialShareButtons text="Test" url="https://ruwt.dev" />);
    expect(screen.getByText('Share on X')).toBeTruthy();
  });

  it('renders Share on LinkedIn button', () => {
    render(<SocialShareButtons text="Test" url="https://ruwt.dev" />);
    expect(screen.getByText('Share on LinkedIn')).toBeTruthy();
  });

  it('renders Copy Link button', () => {
    render(<SocialShareButtons text="Test" url="https://ruwt.dev" />);
    expect(screen.getByText('Copy Link')).toBeTruthy();
  });

  it('opens Twitter share URL when Share on X is clicked', () => {
    render(<SocialShareButtons text="Hello World" url="https://ruwt.dev" />);
    fireEvent.click(screen.getByTestId('share-twitter'));
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens LinkedIn share URL when Share on LinkedIn is clicked', () => {
    render(<SocialShareButtons text="Hello" url="https://ruwt.dev" />);
    fireEvent.click(screen.getByTestId('share-linkedin'));
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('linkedin.com/sharing'),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('copies URL and shows "Copied!" when Copy Link is clicked', async () => {
    render(<SocialShareButtons text="Hello" url="https://ruwt.dev/test" />);
    expect(screen.getByText('Copy Link')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-copy-link'));
    });

    expect(mockWriteText).toHaveBeenCalledWith('https://ruwt.dev/test');
    expect(screen.getByText('Copied!')).toBeTruthy();

    // After 2s, it should revert back to "Copy Link"
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByText('Copy Link')).toBeTruthy();
  });

  it('handles clipboard error gracefully', async () => {
    mockWriteText.mockRejectedValue(new Error('clipboard denied'));
    render(<SocialShareButtons text="Hello" url="https://ruwt.dev" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-copy-link'));
    });

    // Should still show Copy Link (no crash)
    expect(screen.getByText('Copy Link')).toBeTruthy();
  });
});
