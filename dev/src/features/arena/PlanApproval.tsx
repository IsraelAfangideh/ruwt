import React from 'react';
import { arena } from '../../shared/theme/colors';

interface PlanApprovalProps {
  planText: string;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}

function parsePlanSteps(text: string): string[] {
  const lines = text.trim().split('\n');
  return lines
    .map((line) => line.trim())
    .filter((line) => /^\d+[\.\)]/.test(line))
    .map((line) => line.replace(/^\d+[\.\)]\s*/, ''));
}

export function PlanApproval({ planText, onAccept, onReject, disabled }: PlanApprovalProps) {
  const steps = parsePlanSteps(planText);

  return (
    <div style={styles.container}>
      <div style={styles.header}>Plan</div>
      <div style={styles.steps}>
        {steps.length > 0 ? (
          steps.map((step, i) => (
            <div key={i} style={styles.step}>
              <span style={styles.stepNumber}>{i + 1}</span>
              <span style={styles.stepText}>{step}</span>
            </div>
          ))
        ) : (
          <div style={styles.rawText}>{planText}</div>
        )}
      </div>
      <div style={styles.actions}>
        <button
          style={styles.acceptBtn}
          onClick={onAccept}
          disabled={disabled}
        >
          Accept & Execute
        </button>
        <button
          style={styles.rejectBtn}
          onClick={onReject}
          disabled={disabled}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

/** Extract plan text from <plan>...</plan> tags in AI response. */
export function extractPlanBlock(text: string): string | null {
  const match = text.match(/<plan>([\s\S]*?)<\/plan>/);
  return match ? match[1].trim() : null;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: '8px 0',
    border: `1px solid rgba(56,189,248,0.3)`,
    borderRadius: 8,
    overflow: 'hidden',
    background: 'rgba(56,189,248,0.05)',
  },
  header: {
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: '#38bdf8',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(56,189,248,0.15)',
  },
  steps: {
    padding: '8px 12px',
  },
  step: {
    display: 'flex',
    gap: 8,
    padding: '4px 0',
    fontSize: 13,
    lineHeight: '1.5',
    color: arena.text,
  },
  stepNumber: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(56,189,248,0.15)',
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepText: {
    flex: 1,
  },
  rawText: {
    fontSize: 13,
    lineHeight: '1.5',
    color: arena.text,
    whiteSpace: 'pre-wrap' as const,
  },
  actions: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid rgba(56,189,248,0.15)',
  },
  acceptBtn: {
    flex: 1,
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: arena.accent,
    color: '#0d1117',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: '"Libre Franklin", sans-serif',
  },
  rejectBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: `1px solid ${arena.border}`,
    background: 'transparent',
    color: arena.textMuted,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"Libre Franklin", sans-serif',
  },
};
