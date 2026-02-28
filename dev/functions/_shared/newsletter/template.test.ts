import { describe, it, expect } from 'vitest';
import { buildWeeklyHtml, buildWeeklyText, type WeeklyDigestData } from './template';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(overrides: Partial<WeeklyDigestData> = {}): WeeklyDigestData {
  return {
    date: 'Feb 28, 2026',
    perUserBody: 'Hello world.\n\nSecond paragraph here.',
    whatsNew: 'We shipped dark mode and a new leaderboard.',
    stories: [
      {
        title: 'AI Efficiency Is the New Moat',
        url: 'https://example.com/ai-efficiency',
        source: 'Hacker News',
        take: 'Great breakdown of why cost per token matters more than raw capability.',
      },
      {
        title: 'Cloudflare Workers AI Now Supports Tool Use',
        url: 'https://blog.cloudflare.com/workers-ai-tools',
        source: 'Cloudflare Blog',
        take: 'Native function calling makes agentic patterns viable on the edge.',
      },
    ],
    linkedinDraft: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildWeeklyHtml
// ---------------------------------------------------------------------------

describe('buildWeeklyHtml', () => {
  it('wraps output in a single dir="ltr" div', () => {
    const html = buildWeeklyHtml(makeData());
    expect(html).toMatch(/^<div dir="ltr">/);
    expect(html).toMatch(/<\/div>$/);
  });

  it('renders the date at the top in a font tag', () => {
    const html = buildWeeklyHtml(makeData({ date: 'Mar 7, 2026' }));
    expect(html).toContain('<font color="#8a847a" size="2">Mar 7, 2026</font>');
  });

  it('splits perUserBody paragraphs into separate <p> tags', () => {
    const html = buildWeeklyHtml(makeData({
      perUserBody: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    }));
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
    expect(html).toContain('<p>Third paragraph.</p>');
  });

  it('filters blank paragraphs from perUserBody', () => {
    const html = buildWeeklyHtml(makeData({
      perUserBody: 'Keep this.\n\n   \n\nAlso keep this.',
    }));
    // Only 2 body <p> tags (not counting date, footer, etc.)
    const bodyParagraphs = html.match(/<p>Keep this\.<\/p>|<p>Also keep this\.<\/p>/g);
    expect(bodyParagraphs).toHaveLength(2);
  });

  it('renders the "what\'s new" section when whatsNew has real content', () => {
    const html = buildWeeklyHtml(makeData({ whatsNew: 'New billing page.' }));
    expect(html).toContain("what's new —");
    expect(html).toContain('New billing page.');
  });

  it('omits the "what\'s new" section when whatsNew contains "quiet week" (case-insensitive)', () => {
    const html = buildWeeklyHtml(makeData({ whatsNew: 'It was a Quiet Week for shipping.' }));
    expect(html).not.toContain("what's new —");
    expect(html).not.toContain('Quiet Week');
  });

  it('omits the "what\'s new" section when whatsNew is empty string', () => {
    const html = buildWeeklyHtml(makeData({ whatsNew: '' }));
    expect(html).not.toContain("what's new —");
  });

  it('renders multiple stories with links, source, and take', () => {
    const data = makeData();
    const html = buildWeeklyHtml(data);

    expect(html).toContain('elsewhere —');

    // First story
    expect(html).toContain('<a href="https://example.com/ai-efficiency">AI Efficiency Is the New Moat</a>');
    expect(html).toContain('Hacker News');
    expect(html).toContain('Great breakdown of why cost per token matters more than raw capability.');

    // Second story
    expect(html).toContain('<a href="https://blog.cloudflare.com/workers-ai-tools">');
    expect(html).toContain('Cloudflare Blog');
  });

  it('omits the "elsewhere" section when stories array is empty', () => {
    const html = buildWeeklyHtml(makeData({ stories: [] }));
    expect(html).not.toContain('elsewhere —');
  });

  it('renders the linkedin draft section when provided', () => {
    const html = buildWeeklyHtml(makeData({
      linkedinDraft: 'AI efficiency matters.\nHere is why.',
    }));
    expect(html).toContain('linkedin draft (copy &amp; paste) —');
    // newlines in linkedin draft become <br>
    expect(html).toContain('AI efficiency matters.<br>Here is why.');
  });

  it('omits the linkedin draft section when linkedinDraft is null', () => {
    const html = buildWeeklyHtml(makeData({ linkedinDraft: null }));
    expect(html).not.toContain('linkedin draft');
  });

  it('omits the linkedin draft section when linkedinDraft is undefined', () => {
    const html = buildWeeklyHtml(makeData({ linkedinDraft: undefined }));
    expect(html).not.toContain('linkedin draft');
  });

  it('always includes the unsubscribe footer', () => {
    const html = buildWeeklyHtml(makeData());
    expect(html).toContain('reply stop to unsubscribe');
  });

  it('escapes HTML entities in user-generated content', () => {
    const html = buildWeeklyHtml(makeData({
      perUserBody: 'Use <script> tags & "quotes" to test.',
      whatsNew: 'We shipped <b>bold</b> features & more.',
      stories: [{
        title: 'XSS & <injection>',
        url: 'https://example.com/?q=1&b=2',
        source: '<Source>',
        take: 'A "great" take with <html>.',
      }],
      linkedinDraft: 'Check out <ruwt.dev> & more "stuff".',
    }));

    // Angle brackets, ampersands, quotes all escaped
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;quotes&quot;');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('XSS &amp; &lt;injection&gt;');
    expect(html).toContain('href="https://example.com/?q=1&amp;b=2"');
    expect(html).toContain('&lt;Source&gt;');
    expect(html).toContain('&lt;ruwt.dev&gt;');
  });

  it('renders a minimal email with all optional sections omitted', () => {
    const html = buildWeeklyHtml(makeData({
      whatsNew: '',
      stories: [],
      linkedinDraft: null,
    }));

    // Date, body, footer should still be present
    expect(html).toContain('Feb 28, 2026');
    expect(html).toContain('Hello world.');
    expect(html).toContain('reply stop to unsubscribe');

    // Optional sections absent
    expect(html).not.toContain("what's new —");
    expect(html).not.toContain('elsewhere —');
    expect(html).not.toContain('linkedin draft');
  });
});

// ---------------------------------------------------------------------------
// buildWeeklyText
// ---------------------------------------------------------------------------

describe('buildWeeklyText', () => {
  it('starts with the date and a separator', () => {
    const text = buildWeeklyText(makeData({ date: 'Mar 1, 2026' }));
    expect(text).toMatch(/^Mar 1, 2026\n---\n/);
  });

  it('includes the perUserBody as-is', () => {
    const text = buildWeeklyText(makeData({ perUserBody: 'Testing body content.' }));
    expect(text).toContain('Testing body content.');
  });

  it('includes "what\'s new" section when whatsNew has real content', () => {
    const text = buildWeeklyText(makeData({ whatsNew: 'Dark mode shipped.' }));
    expect(text).toContain("what's new —");
    expect(text).toContain('Dark mode shipped.');
  });

  it('omits "what\'s new" section when whatsNew contains "quiet week"', () => {
    const text = buildWeeklyText(makeData({ whatsNew: 'quiet week for us' }));
    expect(text).not.toContain("what's new —");
  });

  it('omits "what\'s new" section when whatsNew is empty', () => {
    const text = buildWeeklyText(makeData({ whatsNew: '' }));
    expect(text).not.toContain("what's new —");
  });

  it('renders numbered stories with title, source, take, and URL', () => {
    const data = makeData();
    const text = buildWeeklyText(data);

    expect(text).toContain('elsewhere —');
    expect(text).toContain('1. AI Efficiency Is the New Moat (Hacker News)');
    expect(text).toContain('   Great breakdown of why cost per token matters more than raw capability.');
    expect(text).toContain('   https://example.com/ai-efficiency');
    expect(text).toContain('2. Cloudflare Workers AI Now Supports Tool Use (Cloudflare Blog)');
  });

  it('omits stories section when stories array is empty', () => {
    const text = buildWeeklyText(makeData({ stories: [] }));
    expect(text).not.toContain('elsewhere —');
  });

  it('renders linkedin draft section when provided', () => {
    const text = buildWeeklyText(makeData({
      linkedinDraft: 'Post about efficiency.',
    }));
    expect(text).toContain('linkedin draft (copy & paste) —');
    expect(text).toContain('Post about efficiency.');
  });

  it('omits linkedin draft section when linkedinDraft is null', () => {
    const text = buildWeeklyText(makeData({ linkedinDraft: null }));
    expect(text).not.toContain('linkedin draft');
  });

  it('always ends with the unsubscribe footer', () => {
    const text = buildWeeklyText(makeData());
    expect(text).toMatch(/reply stop to unsubscribe$/);
  });

  it('does not escape HTML entities (plain text output)', () => {
    const text = buildWeeklyText(makeData({
      perUserBody: 'Use <script> & "quotes".',
    }));
    // Raw characters should appear, not entities
    expect(text).toContain('<script>');
    expect(text).toContain('& "quotes"');
    expect(text).not.toContain('&lt;');
    expect(text).not.toContain('&amp;');
  });

  it('renders a minimal email with all optional sections omitted', () => {
    const text = buildWeeklyText(makeData({
      whatsNew: '',
      stories: [],
      linkedinDraft: null,
    }));
    expect(text).toContain('Feb 28, 2026');
    expect(text).toContain('Hello world.');
    expect(text).toContain('reply stop to unsubscribe');
    expect(text).not.toContain("what's new —");
    expect(text).not.toContain('elsewhere —');
    expect(text).not.toContain('linkedin draft');
  });
});
