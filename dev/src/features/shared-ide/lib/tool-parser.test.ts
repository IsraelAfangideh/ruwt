import { describe, it, expect } from 'vitest';
import { stripToolCalls, hasToolCalls } from './tool-parser';

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
