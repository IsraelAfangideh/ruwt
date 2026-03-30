/**
 * Shared styles for IDE screens (IDEScreen, TakeHomeScreen).
 * Extracted to avoid ~200 lines of duplication between the two screens.
 */
import { arena } from '@/shared/theme/colors';

export const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  background: arena.bg,
  color: arena.text,
  overflow: 'hidden',
};

export const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  padding: '0 12px',
  background: arena.surface,
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

export const topBarLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

export const backBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 13,
  padding: '4px 8px',
  borderRadius: 4,
};

export const projectNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: arena.text,
};

export const saveStatusStyle: React.CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
};

export const topBarRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const cloneRepoBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${arena.border}`,
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 12,
  padding: '4px 10px',
  borderRadius: 4,
};

export const saveBtnStyle: React.CSSProperties = {
  background: arena.accent,
  border: 'none',
  color: arena.bg,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: 6,
};

export const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

export const sidebarStyle: React.CSSProperties = {
  width: 200,
  background: arena.surface,
  borderRight: `1px solid ${arena.border}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  flexShrink: 0,
};

export const sidebarTabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

export const sidebarTabBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '6px 8px',
  textAlign: 'center' as const,
};

export const statusDivStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 16,
};

export const mutedTextStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 13,
};

export const errorTextStyle: React.CSSProperties = {
  color: arena.error,
  fontSize: 13,
};

export const editorAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

export const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  background: arena.surface,
  borderBottom: `1px solid ${arena.border}`,
  overflow: 'auto',
  flexShrink: 0,
};

export const tabStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '0 4px 0 0',
  flexShrink: 0,
};

export const tabLabelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.text,
  cursor: 'pointer',
  fontSize: 12,
  padding: '6px 8px',
  whiteSpace: 'nowrap',
};

export const tabCloseBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: arena.textMuted,
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 4px',
  lineHeight: 1,
  borderRadius: 3,
};

export const editorWrapperStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};

export const editorFallbackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: arena.textMuted,
  fontSize: 14,
};

export const terminalWrapperStyle: React.CSSProperties = {
  height: 180,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

export const terminalPlaceholderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: arena.bg,
};

export const terminalHeaderPlaceholderStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: `1px solid ${arena.border}`,
  background: arena.surface,
};

export const terminalTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: arena.textMuted,
};

export const terminalBodyPlaceholderStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const hDividerStyle: React.CSSProperties = {
  width: 4,
  cursor: 'col-resize',
  background: arena.surface,
  borderLeft: `1px solid ${arena.border}`,
  borderRight: `1px solid ${arena.border}`,
  flexShrink: 0,
};

export const vDividerStyle: React.CSSProperties = {
  height: 4,
  cursor: 'row-resize',
  background: arena.surface,
  borderTop: `1px solid ${arena.border}`,
  borderBottom: `1px solid ${arena.border}`,
  flexShrink: 0,
};

export const bootScreenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: arena.bg,
  gap: 16,
};

export const bootSpinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: `3px solid ${arena.border}`,
  borderTopColor: arena.accent,
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

export const bootTextStyle: React.CSSProperties = {
  color: arena.textMuted,
  fontSize: 14,
};
