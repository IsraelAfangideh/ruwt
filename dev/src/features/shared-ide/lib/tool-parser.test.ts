import { describe, it, expect } from 'vitest';
import { parseToolCalls, stripToolCalls, hasToolCalls } from './tool-parser';

// ---------------------------------------------------------------------------
// parseToolCalls
// ---------------------------------------------------------------------------

describe('parseToolCalls', () => {
  it('parses <ruwt:run_tests/> self-closing tag', () => {
    const calls = parseToolCalls('Let me run the tests. <ruwt:run_tests/>');
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_tests');
  });

  it('parses <ruwt:run_tests /> with space before slash', () => {
    const calls = parseToolCalls('Running: <ruwt:run_tests />');
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_tests');
  });

  it('parses <ruwt:run_code/> self-closing tag', () => {
    const calls = parseToolCalls('Execute this: <ruwt:run_code/>');
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_code');
  });

  it('parses <ruwt:run_code /> with space before slash', () => {
    const calls = parseToolCalls('<ruwt:run_code />');
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_code');
  });

  it('parses non-self-closing tags (no slash)', () => {
    const calls = parseToolCalls('<ruwt:run_tests>');
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_tests');
  });

  it('parses both run_tests and run_code in the same text', () => {
    const text = 'First <ruwt:run_tests/> then <ruwt:run_code/>';
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(2);
    const types = calls.map(c => c.type);
    expect(types).toContain('run_tests');
    expect(types).toContain('run_code');
  });

  it('deduplicates repeated tool calls of the same type', () => {
    const text = '<ruwt:run_tests/> and again <ruwt:run_tests/>';
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].type).toBe('run_tests');
  });

  it('returns empty array when no tool calls present', () => {
    const calls = parseToolCalls('This is just a regular response with no tools.');
    expect(calls).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    const calls = parseToolCalls('');
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// stripToolCalls
// ---------------------------------------------------------------------------

describe('stripToolCalls', () => {
  it('removes a single run_tests tag and preserves surrounding text', () => {
    const text = 'Before <ruwt:run_tests/> After';
    const result = stripToolCalls(text);
    expect(result).toBe('Before  After');
  });

  it('removes a single run_code tag and preserves surrounding text', () => {
    const text = 'Start <ruwt:run_code /> End';
    const result = stripToolCalls(text);
    expect(result).toBe('Start  End');
  });

  it('removes multiple different tool tags', () => {
    const text = 'A <ruwt:run_tests/> B <ruwt:run_code/> C';
    const result = stripToolCalls(text);
    expect(result).toBe('A  B  C');
  });

  it('removes duplicate tool tags', () => {
    const text = '<ruwt:run_tests/> and <ruwt:run_tests/>';
    const result = stripToolCalls(text);
    expect(result).toBe('and');
  });

  it('collapses triple+ newlines left behind after stripping', () => {
    // After removing the tag: "Line 1\n\n\n\n\n\nLine 2" (6 newlines)
    // The regex \n{3,} → \n\n collapses to "Line 1\n\nLine 2"
    // Then .trim() keeps it as-is
    const text = 'Line 1\n\n\n<ruwt:run_tests/>\n\n\nLine 2';
    const result = stripToolCalls(text);
    expect(result).toBe('Line 1\n\nLine 2');
  });

  it('trims leading and trailing whitespace', () => {
    const text = '  <ruwt:run_tests/>  ';
    const result = stripToolCalls(text);
    expect(result).toBe('');
  });

  it('returns text unchanged (trimmed) when no tool calls present', () => {
    const text = '  Hello world  ';
    const result = stripToolCalls(text);
    expect(result).toBe('Hello world');
  });
});

// ---------------------------------------------------------------------------
// hasToolCalls
// ---------------------------------------------------------------------------

describe('hasToolCalls', () => {
  it('returns true when run_tests tag is present', () => {
    expect(hasToolCalls('Check: <ruwt:run_tests/>')).toBe(true);
  });

  it('returns true when run_code tag is present', () => {
    expect(hasToolCalls('<ruwt:run_code/>')).toBe(true);
  });

  it('returns true when both tags are present', () => {
    expect(hasToolCalls('<ruwt:run_tests/> <ruwt:run_code/>')).toBe(true);
  });

  it('returns false when no tags are present', () => {
    expect(hasToolCalls('Just regular text')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(hasToolCalls('')).toBe(false);
  });

  it('returns false for similar-looking but incorrect tags', () => {
    expect(hasToolCalls('<ruwt:run_something/>')).toBe(false);
    expect(hasToolCalls('<other:run_tests/>')).toBe(false);
  });
});
