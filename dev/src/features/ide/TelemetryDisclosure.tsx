/**
 * TelemetryDisclosure — modal overlay shown when a take-home session first loads.
 * Candidate must accept before the IDE is revealed.
 */
import { useState, useCallback } from 'react';
import { arena } from '@/shared/theme/colors';

interface TelemetryDisclosureProps {
  companyName: string;
  sessionId: string;
  onAccept: () => void;
}

export function TelemetryDisclosure({ companyName, sessionId, onAccept }: TelemetryDisclosureProps) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = useCallback(async () => {
    setAccepting(true);
    try {
      await fetch('/api/assess/takehome/disclosure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Continue even if the POST fails — don't block the candidate
    }
    onAccept();
  }, [sessionId, onAccept]);

  return (
    <div style={overlayStyle} data-testid="telemetry-disclosure">
      <div style={modalStyle}>
        <h2 style={titleStyle}>Session Recording Notice</h2>

        <p style={bodyStyle}>
          This assessment records your coding activity to help evaluate your AI fluency.
          The following will be visible to <strong>{companyName}</strong>:
        </p>

        <ul style={listStyle}>
          <li style={listItemStyle}>Code changes and file navigation</li>
          <li style={listItemStyle}>AI prompts and responses</li>
          <li style={listItemStyle}>Terminal commands and output</li>
          <li style={listItemStyle}>Time spent on each part of the assessment</li>
        </ul>

        <p style={privacyStyle}>
          Your data is private to <strong>{companyName}</strong> and will not be shared with third parties.
        </p>

        <button
          onClick={handleAccept}
          disabled={accepting}
          style={{
            ...acceptBtnStyle,
            opacity: accepting ? 0.6 : 1,
            cursor: accepting ? 'default' : 'pointer',
          }}
          data-testid="disclosure-accept-btn"
        >
          {accepting ? 'Starting...' : 'I Understand \u2014 Start Coding'}
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.75)',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: arena.surface,
  border: `1px solid ${arena.border}`,
  borderRadius: 12,
  padding: 32,
  maxWidth: 520,
  width: '90vw',
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: arena.text,
  margin: '0 0 16px 0',
};

const bodyStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: arena.text,
  margin: '0 0 12px 0',
};

const listStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  paddingLeft: 20,
};

const listItemStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.8,
  color: arena.textMuted,
};

const privacyStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: arena.textMuted,
  margin: '0 0 24px 0',
};

const acceptBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  background: arena.accent,
  color: arena.bg,
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
};
