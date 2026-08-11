import React, { useEffect } from 'react';
import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

/**
 * The backdrop and card that the dark-palette modals sit in.
 *
 * The arena expiry, submit-guard, and guest-signup overlays, plus the
 * take-home submit guard, each held a private copy of these styles. One shell
 * keeps them in step.
 *
 * The overlay covers its nearest positioned ancestor, not the viewport, which
 * is how these have always been framed — the header stays reachable.
 */
interface ModalOverlayProps {
  children: React.ReactNode;
  /** Names the dialog for screen readers. Required: every overlay is modal. */
  label: string;
  /**
   * Called when the user presses Escape. Owned here so no consumer has to
   * re-implement it. Map it to the safe choice — cancel, never confirm.
   */
  onDismiss?: () => void;
  /** Tightens the card padding for narrow screens. */
  isMobile?: boolean;
  /** Defaults to 50. The guest signup overlay sits above the IDE chrome. */
  zIndex?: number;
  /**
   * Merged over the card, so a `padding` here beats the `isMobile` padding.
   * For per-site layout only — sizing and chrome belong in the shell.
   */
  cardStyle?: React.CSSProperties;
}

function ModalOverlay({ children, label, onDismiss, isMobile, zIndex = 50, cardStyle }: ModalOverlayProps) {
  useEffect(() => {
    if (!onDismiss) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div style={{ ...s.backdrop, zIndex }}>
      <div
        style={{ ...s.card, ...(isMobile ? { padding: '24px 20px' } : null), ...cardStyle }}
        role="dialog"
        aria-modal
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export default ModalOverlay;

/** Display-face heading used by every arena overlay. */
export const OVERLAY_TITLE: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: arena.text,
  margin: '0 0 12px',
  fontFamily: fontFamily.display,
};

/** The button row at the foot of an overlay. Stacks on narrow screens. */
export function overlayActions(isMobile?: boolean): React.CSSProperties {
  return {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    ...(isMobile ? { flexDirection: 'column' } : null),
  };
}

/**
 * Overlay buttons. 'primary' is the accent fill and 'secondary' the outline.
 * Pick the variant by what you want the user to do, not by which reads louder.
 * Weight follows the variant, not the size, so no caller has to patch it.
 */
export function overlayButton(
  variant: 'primary' | 'secondary',
  size: 'lg' | 'md' | 'sm' = 'lg'
): React.CSSProperties {
  const padding = { lg: '10px 24px', md: '10px 20px', sm: '8px 20px' }[size];
  return {
    ...(variant === 'primary'
      ? { background: arena.accent, border: 'none', color: '#0d1117', fontWeight: 600 }
      : { background: 'transparent', border: `1px solid ${arena.border}`, color: arena.text, fontWeight: 500 }),
    borderRadius: 8,
    padding,
    fontSize: size === 'sm' ? 13 : 14,
    cursor: 'pointer',
  };
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(13,17,23,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: arena.surface,
    border: `1px solid ${arena.border}`,
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 420,
    width: '90%',
    textAlign: 'center',
  },
};
