// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock, renderMarkdown, renderInline, ThinkingBlock } from './ChatMarkdown';
import React from 'react';

vi.mock('@/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
    textMuted: '#8b949e',
    textSubtle: '#6e7681',
    border: '#30363d',
    accent: '#c9a962',
    success: '#3fb950',
    error: '#f85149',
    surface: '#161b22',
  },
}));

describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock lang="javascript" code="const x = 1;" />);
    expect(screen.getByText('const x = 1;')).toBeTruthy();
  });

  it('renders language label', () => {
    render(<CodeBlock lang="typescript" code="const y = 2;" />);
    expect(screen.getByText('typescript')).toBeTruthy();
  });

  it('renders copy button', () => {
    render(<CodeBlock lang="js" code="code" />);
    expect(screen.getByText('Copy')).toBeTruthy();
  });

  it('copies code to clipboard on click', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<CodeBlock lang="js" code="hello world" />);
    fireEvent.click(screen.getByText('Copy'));
    expect(mockClipboard.writeText).toHaveBeenCalledWith('hello world');
  });
});

describe('renderMarkdown', () => {
  it('renders plain text as paragraph', () => {
    const nodes = renderMarkdown('Hello world');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('Hello world');
  });

  it('renders fenced code blocks', () => {
    const nodes = renderMarkdown('```js\nconst a = 1;\n```');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('const a = 1;');
  });

  it('renders headings', () => {
    const nodes = renderMarkdown('# Title\n## Subtitle\n### Sub-sub');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Subtitle');
    expect(container.textContent).toContain('Sub-sub');
  });

  it('renders unordered list items', () => {
    const nodes = renderMarkdown('- Item one\n- Item two');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('Item one');
    expect(container.textContent).toContain('Item two');
  });

  it('renders ordered list items', () => {
    const nodes = renderMarkdown('1. First\n2. Second');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
  });
});

describe('renderInline', () => {
  it('renders bold text', () => {
    const nodes = renderInline('This is **bold** text');
    const { container } = render(<div>{nodes}</div>);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });

  it('renders italic text with asterisk', () => {
    const nodes = renderInline('This is *italic* text');
    const { container } = render(<div>{nodes}</div>);
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('italic');
  });

  it('renders italic text with underscore', () => {
    const nodes = renderInline('This is _italic_ text');
    const { container } = render(<div>{nodes}</div>);
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('italic');
  });

  it('renders inline code with single backtick', () => {
    const nodes = renderInline('Use `console.log` here');
    const { container } = render(<div>{nodes}</div>);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('console.log');
  });

  it('renders inline code with double backtick', () => {
    const nodes = renderInline("Use ``it's code`` here");
    const { container } = render(<div>{nodes}</div>);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe("it's code");
  });

  it('renders links', () => {
    const nodes = renderInline('Visit [Google](https://google.com)');
    const { container } = render(<div>{nodes}</div>);
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('Google');
    expect(link?.getAttribute('href')).toBe('https://google.com');
  });

  it('renders clickable line references when onLineClick provided', () => {
    const onLineClick = vi.fn();
    const nodes = renderInline('See line 42 for details', onLineClick);
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toContain('line 42');
    // The line reference should be a clickable span
    const clickable = container.querySelector('[title]');
    expect(clickable).toBeTruthy();
    fireEvent.click(clickable!);
    expect(onLineClick).toHaveBeenCalledWith(42);
  });

  it('returns non-breaking space for empty text', () => {
    const nodes = renderInline('');
    const { container } = render(<div>{nodes}</div>);
    expect(container.textContent).toBe('\u00A0');
  });
});

describe('ThinkingBlock', () => {
  it('renders thinking content with toggle', () => {
    render(<ThinkingBlock text="Analyzing the problem..." />);
    expect(screen.getByText(/Thinking/)).toBeTruthy();
  });

  it('shows line count when not streaming', () => {
    const multiline = `Line 1
Line 2
Line 3`;
    render(<ThinkingBlock text={multiline} />);
    expect(screen.getByText(/3 line/)).toBeTruthy();
  });

  it('shows "Thinking..." when streaming', () => {
    render(<ThinkingBlock text="Working on it..." isStreaming />);
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('starts collapsed when not streaming', () => {
    const { container } = render(<ThinkingBlock text="Hidden content" />);
    // Content should not be visible since it defaults to collapsed
    expect(container.textContent).not.toContain('Hidden content');
  });

  it('starts expanded when streaming', () => {
    const { container } = render(<ThinkingBlock text="Visible content" isStreaming />);
    expect(container.textContent).toContain('Visible content');
  });

  it('toggles expanded state on click', () => {
    const { container } = render(<ThinkingBlock text="Toggle content" />);
    // Initially collapsed
    expect(container.textContent).not.toContain('Toggle content');
    // Click to expand
    fireEvent.click(screen.getByText(/Thinking/));
    expect(container.textContent).toContain('Toggle content');
    // Click to collapse
    fireEvent.click(screen.getByText(/Thinking/));
    expect(container.textContent).not.toContain('Toggle content');
  });
});
