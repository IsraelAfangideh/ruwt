import React from 'react';
import { arena } from '../../shared/theme/colors';
import type { AIMode } from './lib/system-prompts';

interface ModeSelectorProps {
  mode: AIMode;
  onModeChange: (mode: AIMode) => void;
  disabled?: boolean;
}

const MODES: { key: AIMode; label: string; subtitle: string; color: string }[] = [
  { key: 'agent', label: 'Agent', subtitle: 'Writes & tests code', color: arena.accent },
  { key: 'plan', label: 'Plan', subtitle: 'Plans before coding', color: '#38bdf8' },
  { key: 'debug', label: 'Debug', subtitle: 'Fixes failing tests', color: '#f85149' },
  { key: 'ask', label: 'Ask', subtitle: 'Answers questions', color: '#3fb950' },
];

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <div style={styles.container}>
      {MODES.map((m) => {
        const isActive = mode === m.key;
        return (
          <button
            key={m.key}
            style={{
              ...styles.pill,
              background: isActive ? `${m.color}20` : 'transparent',
              borderColor: isActive ? m.color : arena.border,
              color: isActive ? m.color : arena.textMuted,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            disabled={disabled}
            onClick={() => onModeChange(m.key)}
          >
            <span style={{ fontWeight: 600 }}>{m.label}</span>
            <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>{m.subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: 4,
    padding: '6px 12px',
  },
  pill: {
    flex: 1,
    padding: '5px 8px',
    border: '1px solid',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: '"Libre Franklin", sans-serif',
    background: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    letterSpacing: '0.02em',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 1,
  },
};
