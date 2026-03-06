import React from 'react';
import { arena } from '../../theme/colors';
import { fontFamily } from '@/theme/tokens';

interface NotepadProps {
  value: string;
  onChange: (value: string) => void;
}

export function Notepad({ value, onChange }: NotepadProps) {
  return (
    <div style={styles.container}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down your approach, paste reference snippets, plan your solution..."
        aria-label="Notes – not visible to the AI"
        style={styles.textarea}
        spellCheck={false}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  textarea: {
    flex: 1,
    width: '100%',
    background: arena.bg,
    color: arena.text,
    border: 'none',
    resize: 'none',
    padding: '16px 18px',
    fontSize: 13,
    fontFamily: fontFamily.mono,
    lineHeight: '1.6',
    boxSizing: 'border-box' as const,
  },
};
