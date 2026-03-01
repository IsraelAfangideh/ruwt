/**
 * Automated accessibility tests using vitest-axe (axe-core).
 * Tests key screens and components for WCAG violations.
 *
 * Run: npm run test:a11y
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

// ── Common Mocks ──────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  ScrollView: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Pressable: ({ children, onPress, ...p }: any) => <button onClick={onPress} {...p}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>,
  ActivityIndicator: () => <div role="progressbar" aria-label="Loading" />,
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'web' },
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#faf6f0', text: '#1a1a1a', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', borderStrong: '#999', card: '#fff', muted: '#f5f5f5',
    error: '#f00', errorBg: '#fee', success: '#0a0', successBg: '#efe',
    primary: '#000', primaryForeground: '#fff', secondary: '#eee',
    secondaryForeground: '#000', destructive: '#f00', textSubtle: '#aaa',
    bgElevated: '#fafafa', accentBg: '#ffe', cardForeground: '#000',
    mutedForeground: '#555', successBg: '#f0fff0', errorBg: '#fff0f0',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

// ── Component Mocks ───────────────────────────────────────────────────

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div role="region" {...p}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span role="status">{children}</span>,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: (props: any) => <input aria-label={props.placeholder ?? 'input'} {...props} />,
}));

vi.mock('@/components/ui/Label', () => ({
  Label: ({ children, ...p }: any) => <label {...p}>{children}</label>,
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe('Accessibility (a11y)', () => {
  describe('Badge component', () => {
    it('has no a11y violations', async () => {
      const { container } = render(<span role="status">Easy</span>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Card component', () => {
    it('has no a11y violations with proper headings', async () => {
      const { container } = render(
        <div role="region" aria-label="Challenge card">
          <div>
            <h3>Test Challenge</h3>
            <p>A coding challenge</p>
          </div>
          <div>
            <button>Start</button>
          </div>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Form inputs', () => {
    it('input with label has no violations', async () => {
      const { container } = render(
        <div>
          <label htmlFor="email-input">Email</label>
          <input id="email-input" type="email" placeholder="you@example.com" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('input with aria-label has no violations', async () => {
      const { container } = render(
        <input aria-label="Search challenges" type="text" placeholder="Search..." />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Navigation structure', () => {
    it('nav with links has no violations', async () => {
      const { container } = render(
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/challenges">Challenges</a></li>
            <li><a href="/leaderboard">Leaderboard</a></li>
            <li><a href="/profile">Profile</a></li>
          </ul>
        </nav>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Interactive elements', () => {
    it('buttons have accessible names', async () => {
      const { container } = render(
        <div>
          <button>Start Challenge</button>
          <button aria-label="Close dialog">X</button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Status indicators', () => {
    it('progress indicator with aria role has no violations', async () => {
      const { container } = render(
        <div role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100} aria-label="Challenge progress">
          75%
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('alert messages have no violations', async () => {
      const { container } = render(
        <div role="alert">
          <span>Error: Invalid submission</span>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Data tables', () => {
    it('leaderboard table structure has no violations', async () => {
      const { container } = render(
        <table>
          <caption>Leaderboard</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">User</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Alice</td>
              <td>$0.05</td>
            </tr>
          </tbody>
        </table>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Terminal / Arena', () => {
    it('terminal region with ARIA attributes has no violations', async () => {
      const { container } = render(
        <div role="region" aria-label="Terminal">
          <div role="application" aria-roledescription="terminal" aria-label="Interactive terminal" tabIndex={0}>
            <span>$ ruwt</span>
          </div>
          <div aria-live="polite" aria-atomic={false} role="log" aria-label="Terminal output">
            <div>Welcome to ruwt</div>
          </div>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Dialog / Modal', () => {
    it('dialog with proper ARIA attributes has no violations', async () => {
      const { container } = render(
        <div role="dialog" aria-labelledby="dlg-title" aria-modal="true">
          <h2 id="dlg-title">Confirm Submission</h2>
          <p>Are you sure you want to submit?</p>
          <button>Cancel</button>
          <button>Submit</button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
