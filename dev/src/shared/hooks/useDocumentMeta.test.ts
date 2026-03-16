// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from './useDocumentMeta';

/* ── Setup ──────────────────────────────────────────────────────────────── */

const DEFAULT_TITLE = 'Ruwt - Get Better at AI Coding. Get Discovered.';
const DEFAULT_DESC = 'Practice AI-assisted coding with real models. 100+ challenges, community replays, and hints. Build your skills, get noticed by employers.';
const SITE = 'https://ruwt.dev';

describe('useDocumentMeta', () => {
  let metaDesc: HTMLMetaElement;
  let canonical: HTMLLinkElement;

  beforeEach(() => {
    // Reset document state
    document.title = DEFAULT_TITLE;

    // Create meta description if it doesn't exist
    metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      metaDesc.setAttribute('content', DEFAULT_DESC);
      document.head.appendChild(metaDesc);
    } else {
      metaDesc.setAttribute('content', DEFAULT_DESC);
    }

    // Create canonical link if it doesn't exist
    canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.href = `${SITE}/`;
      document.head.appendChild(canonical);
    } else {
      canonical.href = `${SITE}/`;
    }
  });

  afterEach(() => {
    // Clean up
    document.title = DEFAULT_TITLE;
    metaDesc.setAttribute('content', DEFAULT_DESC);
    canonical.href = `${SITE}/`;
  });

  // ─── Title ──────────────────────────────────────────────────────────

  it('sets document.title with " | Ruwt" suffix when title is provided', () => {
    renderHook(() => useDocumentMeta({ title: 'Challenges' }));

    expect(document.title).toBe('Challenges | Ruwt');
  });

  it('sets default title when no title is provided', () => {
    renderHook(() => useDocumentMeta({}));

    expect(document.title).toBe(DEFAULT_TITLE);
  });

  it('restores default title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'My Page' }));

    expect(document.title).toBe('My Page | Ruwt');

    unmount();

    expect(document.title).toBe(DEFAULT_TITLE);
  });

  // ─── Meta description ───────────────────────────────────────────────

  it('updates meta description when provided', () => {
    renderHook(() => useDocumentMeta({ description: 'Custom description' }));

    expect(metaDesc.getAttribute('content')).toBe('Custom description');
  });

  it('does not update meta description when not provided', () => {
    renderHook(() => useDocumentMeta({}));

    expect(metaDesc.getAttribute('content')).toBe(DEFAULT_DESC);
  });

  it('restores default description on unmount', () => {
    const { unmount } = renderHook(() =>
      useDocumentMeta({ description: 'Temp desc' })
    );

    expect(metaDesc.getAttribute('content')).toBe('Temp desc');

    unmount();

    expect(metaDesc.getAttribute('content')).toBe(DEFAULT_DESC);
  });

  // ─── Canonical URL ──────────────────────────────────────────────────

  it('sets canonical URL when canonicalPath is provided', () => {
    renderHook(() => useDocumentMeta({ canonicalPath: '/challenges' }));

    expect(canonical.href).toBe(`${SITE}/challenges`);
  });

  it('does not update canonical when canonicalPath is not provided (undefined)', () => {
    renderHook(() => useDocumentMeta({}));

    expect(canonical.href).toBe(`${SITE}/`);
  });

  it('handles empty string canonicalPath (sets to site root)', () => {
    renderHook(() => useDocumentMeta({ canonicalPath: '' }));

    // Browser normalizes href to include trailing slash for root URLs
    expect(canonical.href).toBe(`${SITE}/`);
  });

  it('restores canonical to default on unmount', () => {
    const { unmount } = renderHook(() =>
      useDocumentMeta({ canonicalPath: '/leaderboard' })
    );

    expect(canonical.href).toBe(`${SITE}/leaderboard`);

    unmount();

    expect(canonical.href).toBe(`${SITE}/`);
  });

  // ─── All options combined ───────────────────────────────────────────

  it('sets all metadata at once', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'Leaderboard',
        description: 'Top performers on Ruwt',
        canonicalPath: '/leaderboard',
      })
    );

    expect(document.title).toBe('Leaderboard | Ruwt');
    expect(metaDesc.getAttribute('content')).toBe('Top performers on Ruwt');
    expect(canonical.href).toBe(`${SITE}/leaderboard`);
  });

  it('updates when props change via rerender', () => {
    const { rerender } = renderHook(
      (props) => useDocumentMeta(props),
      { initialProps: { title: 'Page 1' } }
    );

    expect(document.title).toBe('Page 1 | Ruwt');

    rerender({ title: 'Page 2' });

    expect(document.title).toBe('Page 2 | Ruwt');
  });

  // ─── OG Image ─────────────────────────────────────────────────────

  it('creates og:image meta tag when ogImage is provided and tag does not exist', () => {
    // Ensure no og:image meta exists initially
    const existing = document.querySelector('meta[property="og:image"]');
    if (existing) existing.remove();

    const { unmount } = renderHook(() =>
      useDocumentMeta({ ogImage: 'https://ruwt.dev/api/og/afi/alice' })
    );

    const ogMeta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    expect(ogMeta).not.toBeNull();
    expect(ogMeta.getAttribute('content')).toBe('https://ruwt.dev/api/og/afi/alice');

    // Cleanup should reset to default
    unmount();
    const afterUnmount = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    expect(afterUnmount?.getAttribute('content')).toBe(`${SITE}/og-image.png`);

    // Clean up for next tests
    afterUnmount?.remove();
  });

  it('reuses existing og:image meta tag when it already exists', () => {
    // Create an og:image tag first
    const ogMeta = document.createElement('meta');
    ogMeta.setAttribute('property', 'og:image');
    ogMeta.setAttribute('content', 'https://old-image.png');
    document.head.appendChild(ogMeta);

    renderHook(() =>
      useDocumentMeta({ ogImage: 'https://ruwt.dev/api/og/new' })
    );

    const found = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    expect(found.getAttribute('content')).toBe('https://ruwt.dev/api/og/new');

    // Clean up
    found.remove();
  });

  // ─── Missing DOM elements ──────────────────────────────────────────

  it('does not crash when meta description element is missing', () => {
    // Remove meta description from DOM
    metaDesc.remove();

    const { unmount } = renderHook(() =>
      useDocumentMeta({ title: 'No Meta', description: 'ignored' })
    );

    expect(document.title).toBe('No Meta | Ruwt');

    // Cleanup should not throw even without meta element
    unmount();

    expect(document.title).toBe(DEFAULT_TITLE);

    // Re-add for subsequent tests
    document.head.appendChild(metaDesc);
  });

  it('does not crash when canonical link element is missing', () => {
    // Remove canonical from DOM
    canonical.remove();

    const { unmount } = renderHook(() =>
      useDocumentMeta({ canonicalPath: '/gone' })
    );

    // Cleanup should not throw even without canonical element
    unmount();

    expect(document.title).toBe(DEFAULT_TITLE);

    // Re-add for subsequent tests
    document.head.appendChild(canonical);
  });
});
