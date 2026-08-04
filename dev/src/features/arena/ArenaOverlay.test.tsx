// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArenaOverlay, { OVERLAY_TITLE, overlayActions, overlayButton } from './ArenaOverlay';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    text: '#e6edf3',
    textMuted: '#8b949e',
    border: '#30363d',
    accent: '#c9a962',
    error: '#f85149',
  },
}));

describe('ArenaOverlay', () => {
  it('renders its children', () => {
    render(<ArenaOverlay label="x"><p>Inside the card</p></ArenaOverlay>);
    expect(screen.getByText('Inside the card')).toBeInTheDocument();
  });

  it('always announces itself as a modal dialog', () => {
    render(<ArenaOverlay label="Confirm this"><p>a</p></ArenaOverlay>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Confirm this');
  });

  it('tightens the card padding on mobile', () => {
    render(<ArenaOverlay isMobile label="m"><p>a</p></ArenaOverlay>);
    expect(screen.getByRole('dialog')).toHaveStyle({ padding: '24px 20px' });
  });

  it('lets the caller override the card and the stacking order', () => {
    render(<ArenaOverlay label="g" zIndex={200} cardStyle={{ padding: '32px' }}><p>a</p></ArenaOverlay>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ padding: '32px' });
    expect(dialog.parentElement).toHaveStyle({ zIndex: '200' });
  });
});

describe('overlayActions', () => {
  it('lays the buttons in a row, and stacks them on mobile', () => {
    expect(overlayActions(false).flexDirection).toBeUndefined();
    expect(overlayActions(true).flexDirection).toBe('column');
  });
});

describe('overlayButton', () => {
  it('fills the primary variant with the accent colour', () => {
    const style = overlayButton('primary');
    expect(style.background).toBe('#c9a962');
    expect(style.border).toBe('none');
  });

  it('outlines the secondary variant', () => {
    const style = overlayButton('secondary');
    expect(style.background).toBe('transparent');
    expect(style.border).toContain('#30363d');
  });

  it('takes weight from the variant, not the size, so callers need no override', () => {
    expect(overlayButton('primary', 'lg').fontWeight).toBe(600);
    expect(overlayButton('primary', 'sm').fontWeight).toBe(600);
    expect(overlayButton('secondary', 'md').fontWeight).toBe(500);
  });

  it('offers three sizes', () => {
    expect(overlayButton('primary', 'lg').padding).toBe('10px 24px');
    expect(overlayButton('primary', 'md').padding).toBe('10px 20px');
    expect(overlayButton('primary', 'sm').padding).toBe('8px 20px');
    expect(overlayButton('primary', 'sm').fontSize).toBe(13);
    expect(overlayButton('primary', 'lg').fontSize).toBe(14);
  });
});

describe('OVERLAY_TITLE', () => {
  it('uses the shared display token', () => {
    expect(OVERLAY_TITLE.fontFamily).toContain('Cormorant Garamond');
  });
});
