// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightReel, type HighlightMoment } from './HighlightReel';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000',
    textMuted: '#888',
    accent: '#c9a962',
    border: '#ccc',
    card: '#fff',
    borderStrong: '#aaa',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14 },
  fontFamily: { body: 'sans-serif' },
  radii: { xl: 16 },
}));

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
    expect(screen.getByText('Key Moments')).toBeTruthy();
  });

  it('renders all highlight narratives', () => {
    render(<HighlightReel highlights={highlights} />);
    expect(screen.getByText('Switched from Premium to Budget')).toBeTruthy();
    expect(screen.getByText('Recovered from syntax error')).toBeTruthy();
    expect(screen.getByText('Challenge solved!')).toBeTruthy();
  });

  it('renders cost when present and > 0', () => {
    render(<HighlightReel highlights={highlights} />);
    // 500 / 10000 = 0.05, formatted as $0.05
    expect(screen.getByText('$0.05')).toBeTruthy();
  });

  it('renders type icons', () => {
    render(<HighlightReel highlights={highlights} />);
    // model_switch icon is ⇄, error_recovery is ✔, pass is ★
    expect(screen.getByText('\u21C4')).toBeTruthy();
    expect(screen.getByText('\u2714')).toBeTruthy();
    expect(screen.getByText('\u2605')).toBeTruthy();
  });

  it('handles unknown type gracefully with bullet fallback', () => {
    const unknownHighlight: HighlightMoment[] = [
      { timestamp: '2025-01-15T11:00:00Z', type: 'unknown_type' as any, narrative: 'Something', challengeIndex: 0 },
    ];
    render(<HighlightReel highlights={unknownHighlight} />);
    expect(screen.getByText('\u2022')).toBeTruthy();
  });
});
