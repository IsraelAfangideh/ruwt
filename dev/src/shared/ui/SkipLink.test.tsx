// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipLink } from './SkipLink';

/** Mounts a focusable region, optionally inside a hidden screen wrapper. */
function mountRegion({
  id,
  tag = 'div',
  hidden = false,
}: { id?: string; tag?: string; hidden?: boolean } = {}) {
  const screenWrapper = document.createElement('div');
  if (hidden) screenWrapper.style.display = 'none';

  const region = document.createElement(tag);
  if (id) region.id = id;
  if (tag !== 'main') region.setAttribute('role', 'main');
  region.tabIndex = -1;
  region.scrollIntoView = vi.fn();

  screenWrapper.appendChild(region);
  document.body.appendChild(screenWrapper);
  return region;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('SkipLink', () => {
  it('renders the link', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('renders custom label text and target', () => {
    render(<SkipLink targetId="arena-main">Jump to content</SkipLink>);
    expect(screen.getByRole('link', { name: 'Jump to content' })).toHaveAttribute('href', '#arena-main');
  });

  it('moves focus to the target without setting a URL hash', () => {
    const region = mountRegion({ id: 'main-content' });
    render(<SkipLink />);

    const link = screen.getByRole('link', { name: 'Skip to main content' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(document.activeElement).toBe(region);
    expect(region.scrollIntoView).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.hash).toBe('');
  });

  /* The stack keeps departed screens mounted under display:none, so more than
     one element can carry the id at once. getElementById would return the
     hidden one, which cannot take focus. */
  it('skips a hidden screen still carrying the target id', () => {
    mountRegion({ id: 'main-content', hidden: true });
    const visible = mountRegion({ id: 'main-content' });

    render(<SkipLink />);
    fireEvent.click(screen.getByRole('link', { name: 'Skip to main content' }));

    expect(document.activeElement).toBe(visible);
  });

  /* Screens that use a bare <main> rather than the shared id still work. */
  it('falls back to a rendered main region when the id is absent', () => {
    const region = mountRegion({ tag: 'main' });

    render(<SkipLink />);
    fireEvent.click(screen.getByRole('link', { name: 'Skip to main content' }));

    expect(document.activeElement).toBe(region);
  });

  it('does nothing when no main region is rendered', () => {
    mountRegion({ id: 'main-content', hidden: true });
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });

    expect(() => fireEvent.click(link)).not.toThrow();
    expect(window.location.hash).toBe('');
  });

  it('escapes ids that are not valid CSS selectors', () => {
    render(<SkipLink targetId="main content" />);
    expect(() =>
      fireEvent.click(screen.getByRole('link', { name: 'Skip to main content' })),
    ).not.toThrow();
  });
});
