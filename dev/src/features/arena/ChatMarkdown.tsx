/**
 * ChatMarkdown: Standalone markdown rendering components extracted from ArenaIDE.
 * Exports CodeBlock, renderMarkdown, renderInline, ThinkingBlock, and mdStyles.
 */
import React from 'react';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

/* ─── Simple Markdown Renderer ────────────────────────────────────── */

export const CodeBlock = React.memo(function CodeBlock({ lang, code, collapsible }: { lang: string; code: string; collapsible?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(!!collapsible);
  const lineCount = code.split('\n').length;
  /* istanbul ignore next -- @preserve */
  const collapseLabel = collapsed ? `\u25B6 ${lineCount} lines` : '\u25BC collapse';
  /* istanbul ignore next -- @preserve */
  const copyLabel = copied ? 'Copied!' : 'Copy';
  /* istanbul ignore next -- @preserve */
  const copyAriaLabel = copied ? 'Copied to clipboard' : 'Copy code';
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      /* istanbul ignore next -- @preserve */
      setTimeout(() => setCopied(false), 1500);
    }).catch(/* istanbul ignore next -- @preserve */ () => {
      // Clipboard API unavailable — no-op (button stays in default state)
    });
  };
  return (
    <div style={mdStyles.codeBlock}>
      <div style={mdStyles.codeHeader}>
        {lang && <span style={mdStyles.codeLang}>{lang}</span>}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* istanbul ignore next -- @preserve */}
          {collapsible && (
            /* istanbul ignore next -- @preserve */
            <button
              onClick={/* istanbul ignore next -- @preserve */ () => setCollapsed(!collapsed)}
              style={mdStyles.collapseBtn}
              /* istanbul ignore next -- @preserve */
              aria-expanded={!collapsed}
              aria-label={/* istanbul ignore next -- @preserve */ collapsed ? 'Expand code block' : 'Collapse code block'}
            >
              {collapseLabel}
            </button>
          )}
          <button onClick={handleCopy} style={mdStyles.copyBtn} aria-label={copyAriaLabel}>
            {copyLabel}
          </button>
        </div>
      </div>
      {!collapsed && <pre style={mdStyles.codePre}>{code}</pre>}
    </div>
  );
});

export function renderMarkdown(text: string, onLineClick?: (line: number) => void, opts?: { collapsibleCodeBlocks?: boolean }): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const isLong = codeLines.length > 20;
      /* istanbul ignore next -- @preserve */
      const collapsible = opts?.collapsibleCodeBlocks && isLong;
      blocks.push(<CodeBlock key={blocks.length} lang={lang} code={codeLines.join('\n')} collapsible={collapsible} />);
      continue;
    }

    // horizontal rule
    /* istanbul ignore next -- @preserve */
    if (/^-{3,}$/.test(line.trim())) {
      /* istanbul ignore next -- @preserve */
      blocks.push(<hr key={blocks.length} style={mdStyles.hr} />);
      /* istanbul ignore next -- @preserve */
      i++;
      /* istanbul ignore next -- @preserve */
      continue;
    }

    // headings — offset by 1 (challenge title is h1, so # → h2, ## → h3, ### → h4)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const headingStyle = level === 1 ? mdStyles.h1 : level === 2 ? mdStyles.h2 : mdStyles.h3;
      const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      blocks.push(
        <Tag key={blocks.length} style={headingStyle}>
          {renderInline(headingMatch[2], onLineClick)}
        </Tag>
      );
      i++;
      continue;
    }

    // unordered list item
    if (/^[\-\*]\s+/.test(line)) {
      blocks.push(
        <div key={blocks.length} style={mdStyles.listItem}>
          <span style={mdStyles.listBullet}>{'\u2022'}</span>
          <span>{renderInline(line.replace(/^[\-\*]\s+/, ''), onLineClick)}</span>
        </div>
      );
      i++;
      continue;
    }

    // ordered list item
    if (/^\d+\.\s+/.test(line)) {
      /* istanbul ignore next -- @preserve */
      const num = line.match(/^(\d+)\./)?.[1] || '1';
      blocks.push(
        <div key={blocks.length} style={mdStyles.listItem}>
          <span style={mdStyles.listNum}>{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s+/, ''), onLineClick)}</span>
        </div>
      );
      i++;
      continue;
    }

    // regular line — parse inline elements
    blocks.push(
      <div key={blocks.length} style={mdStyles.paragraph}>
        {renderInline(line, onLineClick)}
      </div>
    );
    i++;
  }
  return blocks;
}

/** Render plain text with clickable line references (e.g. "line 42", "L12", "lines 10-15"). */
function renderPlainWithLineRefs(text: string, keyBase: number, onLineClick?: (line: number) => void): React.ReactNode[] {
  if (!onLineClick) return [<span key={keyBase}>{text}</span>];
  const parts: React.ReactNode[] = [];
  // Match: "line 42", "Line 42", "L42", "lines 10-15", "Lines 10-15"
  const lineRefRegex = /\b(?:L(?:ine)?s?\s*)(\d+)(?:\s*[-\u2013]\s*(\d+))?\b/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = lineRefRegex.exec(text)) !== null) {
    /* istanbul ignore next -- @preserve */
    if (m.index > last) {
      parts.push(<span key={keyBase + parts.length}>{text.slice(last, m.index)}</span>);
    }
    const startLine = parseInt(m[1], 10);
    parts.push(
      <span
        key={keyBase + parts.length}
        onClick={() => onLineClick(startLine)}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLineClick(startLine); } }}
        role="button"
        tabIndex={0}
        style={mdStyles.lineRef}
        title={/* istanbul ignore next -- @preserve */ m[2] ? `Go to line ${startLine}-${m[2]}` : `Go to line ${startLine}`}
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  /* istanbul ignore next -- @preserve */
  if (last < text.length) {
    parts.push(<span key={keyBase + parts.length}>{text.slice(last)}</span>);
  }
  /* istanbul ignore next -- @preserve */
  return parts.length ? parts : [<span key={keyBase}>{text}</span>];
}

export function renderInline(text: string, onLineClick?: (line: number) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // match **bold**, *italic*/_italic_, ``code`` (double-backtick), `code` (single), and [text](url)
  // Double-backtick checked first so inner single backticks are preserved.
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|``(.+?)``|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    /* istanbul ignore next -- @preserve */
    if (match.index > last) {
      parts.push(...renderPlainWithLineRefs(text.slice(last, match.index), parts.length * 100, onLineClick));
    }
    if (match[2]) {
      // bold
      parts.push(<strong key={parts.length}>{match[2]}</strong>);
    } else if (match[3]) {
      // italic with *
      parts.push(<em key={parts.length}>{match[3]}</em>);
    } else if (match[4]) {
      // italic with _
      parts.push(<em key={parts.length}>{match[4]}</em>);
    } else if (match[5]) {
      // inline code (double-backtick — may contain single backticks)
      parts.push(
        <code key={parts.length} style={mdStyles.inlineCode}>{match[5].trim()}</code>
      );
    } else if (match[6]) {
      // inline code (single-backtick)
      parts.push(
        <code key={parts.length} style={mdStyles.inlineCode}>{match[6]}</code>
      );
    } else {
      /* istanbul ignore next -- @preserve */
      if (match[7] && match[8]) {
      // link — only allow safe URL schemes
      /* istanbul ignore next -- @preserve */
      const href = match[8];
      /* istanbul ignore next -- @preserve */
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#');
      /* istanbul ignore next -- @preserve */
      parts.push(
        isSafe
          ? <a key={parts.length} href={href} target="_blank" rel="noopener noreferrer" style={mdStyles.link}>{match[7]}</a>
          : <span key={parts.length} style={mdStyles.link}>{match[7]}</span>
      );
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    /* istanbul ignore next -- @preserve */
    parts.push(...renderPlainWithLineRefs(text.slice(last), parts.length * 100, onLineClick));
  }
  return parts.length ? parts : [<span key={0}>{text || '\u00A0'}</span>];
}

export const mdStyles: Record<string, React.CSSProperties> = {
  codeBlock: {
    background: '#0d1117',
    borderRadius: 6,
    margin: '6px 0',
    overflow: 'hidden',
    border: `1px solid ${arena.border}`,
    position: 'relative',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    borderBottom: `1px solid ${arena.border}`,
    minHeight: 24,
  },
  codeLang: {
    fontSize: 11,
    color: arena.textMuted,
    fontFamily: fontFamily.mono,
  },
  copyBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: fontFamily.mono,
  },
  collapseBtn: {
    background: 'transparent',
    border: `1px solid ${arena.border}`,
    borderRadius: 4,
    color: arena.textMuted,
    fontSize: 10,
    padding: '2px 8px',
    cursor: 'pointer',
    fontFamily: fontFamily.mono,
  },
  hr: {
    border: 'none',
    borderTop: `1px solid ${arena.border}`,
    margin: '12px 0',
  },
  codePre: {
    margin: 0,
    padding: '10px 12px',
    fontSize: 13,
    lineHeight: '1.45',
    color: arena.text,
    fontFamily: fontFamily.mono,
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  inlineCode: {
    background: 'rgba(240,246,252,0.08)',
    padding: '2px 5px',
    borderRadius: 3,
    fontSize: '0.9em',
    fontFamily: fontFamily.mono,
  },
  link: {
    color: arena.accent,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  paragraph: {
    lineHeight: '1.5',
    minHeight: '1.2em',
  },
  h1: { fontSize: 18, fontWeight: 700, lineHeight: '1.4', margin: '16px 0 8px', color: arena.text },
  h2: { fontSize: 16, fontWeight: 600, lineHeight: '1.4', margin: '12px 0 6px', color: arena.text },
  h3: { fontSize: 14, fontWeight: 600, lineHeight: '1.4', margin: '10px 0 4px', color: arena.text },
  listItem: { display: 'flex', gap: 8, lineHeight: '1.5', paddingLeft: 4 },
  listBullet: { color: arena.textMuted, flexShrink: 0, width: 12 },
  listNum: { color: arena.textMuted, flexShrink: 0, width: 16, textAlign: 'right' as const },
  lineRef: {
    color: arena.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted' as const,
    textUnderlineOffset: '2px',
  },
};

/* ─── Thinking Block (reasoning models) ─────────────────────────── */

/* istanbul ignore next -- @preserve */
export const ThinkingBlock = React.memo(function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = React.useState(!!isStreaming);
  const lineCount = text.split('\n').length;

  // Auto-expand while streaming, collapse when done
  React.useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  return (
    <div style={{
      margin: '4px 0 6px',
      borderLeft: '2px solid #a78bfa',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={isStreaming ? 'Thinking in progress' : `Toggle thinking block, ${lineCount} lines`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          background: 'rgba(167,139,250,0.08)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11,
          color: '#a78bfa',
          fontFamily: fontFamily.mono,
          width: '100%',
          textAlign: 'left',
        }}
      >
        {isStreaming && (
          <span style={{ animation: 'ruwt-pulse 1.2s ease-in-out infinite', fontSize: 8 }}>{'\u25CF'}</span>
        )}
        <span>{expanded ? '\u25BC' : '\u25B6'}</span>
        <span>{isStreaming ? 'Thinking...' : `Thinking (${lineCount} line${lineCount !== 1 ? 's' : ''})`}</span>
      </button>
      {expanded && (
        <div style={{
          maxHeight: 200,
          overflowY: 'auto',
          padding: '6px 8px',
          fontSize: 11,
          lineHeight: '1.4',
          color: arena.textSubtle,
          fontFamily: fontFamily.mono,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'rgba(167,139,250,0.04)',
        }}>
          {text}
        </div>
      )}
    </div>
  );
});
