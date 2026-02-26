import React, { useState } from 'react';
import { arena } from '@/theme/colors';

export interface TestResults {
  passed: boolean;
  passedTests: number;
  totalTests: number;
  results: Array<{ passed: boolean; input: string; expectedOutput: string; actualOutput: string; error?: string; hidden?: boolean; hint?: string }>;
  isSubmission: boolean;
}

const mono = 'Menlo, Monaco, "Courier New", monospace';
const codeBg = 'rgba(0,0,0,0.3)';
const codeBorder = 'rgba(255,255,255,0.06)';

/** Truncate for inline preview; full value shown in detail block */
function preview(s: string, max = 120): string {
  if (!s) return '(empty)';
  const oneLine = s.replace(/\n/g, ' ');
  return oneLine.length > max ? oneLine.slice(0, max) + '\u2026' : oneLine;
}

function CodeBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, color: arena.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <pre style={{
        margin: 0, padding: '6px 10px', borderRadius: 4,
        background: codeBg, border: `1px solid ${codeBorder}`,
        color, fontSize: 12, fontFamily: mono,
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: 120, overflow: 'auto',
      }}>
        {value || '(empty)'}
      </pre>
    </div>
  );
}

function ResultsBar({ results, onDismiss, onAskAI, hiddenTestCount }: { results: TestResults; onDismiss?: () => void; onAskAI?: (prompt: string) => void; hiddenTestCount?: number }) {
  // Auto-expand on submission (always) or on failure
  const [expanded, setExpanded] = useState(results.isSubmission || !results.passed);
  const allPassed = results.passed;
  const barBg = allPassed ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)';
  const barBorder = allPassed ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)';
  const barColor = allPassed ? arena.success : arena.error;

  return (
    <div style={{ borderTop: `1px solid ${barBorder}`, background: barBg, flexShrink: 0 }}>
      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', minHeight: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: barColor, fontWeight: 700, fontSize: 13, fontFamily: mono }}>
            {allPassed ? '\u2713' : '\u2717'} {results.passedTests}/{results.totalTests} passed
          </span>
          {/* After Run Tests pass, remind about hidden tests on submit */}
          {!results.isSubmission && allPassed && hiddenTestCount != null && hiddenTestCount > 0 && (
            <span style={{ fontSize: 11, color: arena.accent, fontFamily: mono }}>
              {'\u2014'} submit to run all {results.totalTests + hiddenTestCount} tests
            </span>
          )}
          {results.isSubmission && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: barColor,
              padding: '1px 8px', borderRadius: 9999,
              border: `1px solid ${barBorder}`, background: barBg,
              fontFamily: mono,
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
              padding: '2px 8px', cursor: 'pointer', fontFamily: mono,
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
              {'\u00D7'}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded test details ── */}
      {expanded && (
        <div style={{ padding: '0 14px 10px', fontSize: 12, fontFamily: mono, maxHeight: 400, overflowY: 'auto' }}>
          {results.results.map((r, i) => {
            const statusIcon = r.passed ? '\u2713' : '\u2717';
            const statusColor = r.passed ? arena.success : arena.error;
            const label = r.hidden ? 'Hidden Test' : 'Test';

            return (
              <div key={i} style={{
                padding: '8px 0',
                borderTop: i > 0 ? `1px solid ${arena.border}` : undefined,
              }}>
                {/* Test header: status + number + input preview */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: statusColor, fontWeight: 700 }}>
                    {statusIcon} {label} {i + 1}
                  </span>
                  {r.hint && (
                    <span style={{
                      fontSize: 10, color: arena.textMuted,
                      padding: '0 5px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.05)',
                    }}>
                      {r.hint}
                    </span>
                  )}
                  {r.passed && (
                    <span style={{ color: arena.textMuted, fontSize: 11 }}>
                      {preview(r.input)}
                    </span>
                  )}
                </div>

                {/* Failed test: show full input/expected/actual in code blocks */}
                {!r.passed && (
                  <div style={{ paddingLeft: 4, marginTop: 4 }}>
                    <CodeBlock label="Input" value={r.input} color={arena.text} />
                    <CodeBlock label="Expected Output" value={r.expectedOutput} color={arena.success} />
                    <CodeBlock label="Your Output" value={r.actualOutput} color={arena.error} />
                    {r.error && (
                      <div style={{ marginTop: 4, color: arena.error, fontSize: 11 }}>
                        Error: {r.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Encouraging message + Ask AI button for failures */}
          {!allPassed && onAskAI && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px solid ${arena.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
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
                    ? `My code fails ${failCount} test${failCount > 1 ? 's' : ''}. Input: "${firstFail.input}". Expected: "${firstFail.expectedOutput}" but got "${firstFail.actualOutput || '(empty)'}".${firstFail.error ? ` Error: ${firstFail.error}` : ''} Help me fix this.`
                    : `My code fails all ${results.totalTests} tests. Help me fix it.`;
                  onAskAI(prompt);
                }}
                style={{
                  background: arena.accent, border: 'none', borderRadius: 6,
                  color: '#0d1117', padding: '5px 12px', fontSize: 11,
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: mono,
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
