// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

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
    expect(screen.getByText('Share on X')).toBeInTheDocument();
  });

  it('renders Share on LinkedIn button', () => {
    render(<SocialShareButtons text="Test" url="https://ruwt.dev" />);
    expect(screen.getByText('Share on LinkedIn')).toBeInTheDocument();
  });

  it('renders Copy Link button', () => {
    render(<SocialShareButtons text="Test" url="https://ruwt.dev" />);
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
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
    expect(screen.getByText('Copy Link')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-copy-link'));
    });

    expect(mockWriteText).toHaveBeenCalledWith('https://ruwt.dev/test');
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // After 2s, it should revert back to "Copy Link"
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  it('handles clipboard error gracefully', async () => {
    mockWriteText.mockRejectedValue(new Error('clipboard denied'));
    render(<SocialShareButtons text="Hello" url="https://ruwt.dev" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('share-copy-link'));
    });

    // Should still show Copy Link (no crash)
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });
});
