// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightReel, type HighlightMoment } from './HighlightReel';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const highlights: HighlightMoment[] = [
  { timestamp: '2025-01-15T10:30:00Z', type: 'model_switch', narrative: 'Switched from Premium to Budget', challengeIndex: 0 },
  { timestamp: '2025-01-15T10:35:00Z', type: 'error_recovery', narrative: 'Recovered from syntax error', challengeIndex: 0, cost: 500 },
  { timestamp: '2025-01-15T10:40:00Z', type: 'pass', narrative: 'Challenge solved!', challengeIndex: 0 },
];

describe('HighlightReel', () => {
  it('returns null when highlights array is empty', () => {
    const { container } = render(<HighlightReel highlights={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the "Key Moments" title', () => {
    render(<HighlightReel highlights={highlights} />);
    expect(screen.getByText('Key Moments')).toBeInTheDocument();
  });

  it('renders all highlight narratives', () => {
    render(<HighlightReel highlights={highlights} />);
    expect(screen.getByText('Switched from Premium to Budget')).toBeInTheDocument();
    expect(screen.getByText('Recovered from syntax error')).toBeInTheDocument();
    expect(screen.getByText('Challenge solved!')).toBeInTheDocument();
  });

  it('renders cost when present and > 0', () => {
    render(<HighlightReel highlights={highlights} />);
    // 500 / 10000 = 0.05, formatted as $0.05
    expect(screen.getByText('$0.05')).toBeInTheDocument();
  });

  it('renders type icons', () => {
    render(<HighlightReel highlights={highlights} />);
    // model_switch icon is ⇄, error_recovery is ✔, pass is ★
    expect(screen.getByText('\u21C4')).toBeInTheDocument();
    expect(screen.getByText('\u2714')).toBeInTheDocument();
    expect(screen.getByText('\u2605')).toBeInTheDocument();
  });

  it('handles unknown type gracefully with bullet fallback', () => {
    const unknownHighlight: HighlightMoment[] = [
      { timestamp: '2025-01-15T11:00:00Z', type: 'unknown_type' as any, narrative: 'Something', challengeIndex: 0 },
    ];
    render(<HighlightReel highlights={unknownHighlight} />);
    expect(screen.getByText('\u2022')).toBeInTheDocument();
  });
});
