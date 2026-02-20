import React, { useState } from 'react';
import { arena } from '@/theme/colors';

export interface TestResults {
  passed: boolean;
  passedTests: number;
  totalTests: number;
  results: Array<{ passed: boolean; input: string; expectedOutput: string; actualOutput: string; error?: string; hidden?: boolean }>;
  isSubmission: boolean;
}

function ResultsBar({ results, onDismiss, onAskAI }: { results: TestResults; onDismiss?: () => void; onAskAI?: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState(!results.passed); // auto-expand on failure
  const allPassed = results.passed;
  const barBg = allPassed ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)';
  const barBorder = allPassed ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)';
  const barColor = allPassed ? arena.success : arena.error;

  return (
    <div style={{ borderTop: `1px solid ${barBorder}`, background: barBg, flexShrink: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', minHeight: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: barColor, fontWeight: 700, fontSize: 13, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
            {allPassed ? '\u2713' : '\u2717'} {results.passedTests}/{results.totalTests} passed
          </span>
          {results.isSubmission && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: barColor,
              padding: '1px 8px', borderRadius: 9999,
              border: `1px solid ${barBorder}`, background: barBg,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}>
              {allPassed ? 'Submitted \u2014 Passed!' : 'Submitted \u2014 Failed'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent', border: `1px solid ${arena.border}`,
              borderRadius: 4, color: arena.textMuted, fontSize: 10,
              padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            }}
          >
            {expanded ? '\u25B2 Hide' : '\u25BC Details'}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent', border: 'none', color: arena.textMuted,
                fontSize: 14, cursor: 'pointer', padding: '0 4px',
              }}
            >
              \u00D7
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 8px', fontSize: 12, fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}>
          {results.results.map((r, i) => (
            <div key={i} style={{
              padding: '4px 0', borderTop: i > 0 ? `1px solid ${arena.border}` : undefined,
              color: r.passed ? arena.success : arena.error,
            }}>
              <span>{r.passed ? '\u2713' : '\u2717'} Test {i + 1}{r.hidden ? ' (hidden)' : ''}: </span>
              {!r.hidden && (
                <span style={{ color: arena.textMuted }}>
                  {r.input.length > 40 ? r.input.slice(0, 40) + '...' : r.input}
                </span>
              )}
              {!r.passed && !r.hidden && (
                <div style={{ color: arena.textMuted, paddingLeft: 16, fontSize: 11, marginTop: 2 }}>
                  expected <span style={{ color: arena.success }}>{r.expectedOutput}</span>
                  {' '}got <span style={{ color: arena.error }}>{r.actualOutput || '(empty)'}</span>
                  {r.error && <div style={{ color: arena.error, marginTop: 2 }}>{r.error}</div>}
                </div>
              )}
            </div>
          ))}
          {/* Encouraging message + Ask AI button for failures */}
          {!allPassed && onAskAI && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${arena.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: arena.textMuted, fontSize: 12 }}>
                {results.passedTests > 0
                  ? `${results.passedTests} of ${results.totalTests} tests passing \u2014 keep going!`
                  : 'No tests passing yet. Try asking the AI to help debug.'}
              </span>
              <button
                onClick={() => {
                  const firstFail = results.results.find((r) => !r.passed);
                  const failCount = results.totalTests - results.passedTests;
                  const prompt = firstFail
                    ? `My code fails ${failCount} test${failCount > 1 ? 's' : ''}. The first failing test expects "${firstFail.expectedOutput}" but got "${firstFail.actualOutput || '(empty)'}".${firstFail.error ? ` Error: ${firstFail.error}` : ''} Help me fix this.`
                    : `My code fails all ${results.totalTests} tests. Help me fix it.`;
                  onAskAI(prompt);
                }}
                style={{
                  background: arena.accent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#0d1117',
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                }}
              >
                Ask AI for Help
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(ResultsBar);
export { ResultsBar };
