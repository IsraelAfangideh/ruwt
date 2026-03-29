import { arena } from '@/shared/theme/colors';
import { fontFamily } from '@/shared/theme/tokens';

export type SidebarTab = 'description' | 'chat' | 'discussion' | 'results';

interface CollapsedSidebarProps {
  tabs: SidebarTab[];
  hasUnreadChat: boolean;
  onExpandTab: (tab: SidebarTab) => void;
  onTogglePosition: () => void;
  sidebarPosition: 'left' | 'right';
}

const TAB_ICONS: Record<SidebarTab, string> = {
  description: '\u2630',  // ☰
  chat: '\uD83D\uDCAC',   // 💬
  discussion: '\uD83D\uDCAD', // 💭
  results: '\u2713',       // ✓
};

const TAB_LABELS: Record<SidebarTab, string> = {
  description: 'Description',
  chat: 'AI Chat',
  discussion: 'Discussion',
  results: 'Results',
};

export function CollapsedSidebar({
  tabs,
  hasUnreadChat,
  onExpandTab,
  onTogglePosition,
  sidebarPosition,
}: CollapsedSidebarProps) {
  return (
    <div
      data-testid="collapsed-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        background: arena.surface,
        borderRight: sidebarPosition === 'left' ? `1px solid ${arena.border}` : undefined,
        borderLeft: sidebarPosition === 'right' ? `1px solid ${arena.border}` : undefined,
        paddingTop: 8,
        gap: 4,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onExpandTab(tab)}
          title={TAB_LABELS[tab]}
          aria-label={`Expand ${TAB_LABELS[tab]}`}
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: `1px solid transparent`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: tab === 'results' ? 14 : 16,
            color: arena.textMuted,
            fontFamily: fontFamily.mono,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${arena.accent}15`;
            e.currentTarget.style.borderColor = arena.border;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          {TAB_ICONS[tab]}
          {tab === 'chat' && hasUnreadChat && (
            <span
              data-testid="collapsed-unread-dot"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 6,
                height: 6,
                borderRadius: 3,
                background: arena.accent,
              }}
            />
          )}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        onClick={onTogglePosition}
        title={`Move sidebar to ${sidebarPosition === 'left' ? 'right' : 'left'}`}
        aria-label={`Move sidebar to ${sidebarPosition === 'left' ? 'right' : 'left'}`}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: `1px solid transparent`,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          color: arena.textMuted,
          fontFamily: fontFamily.mono,
          marginBottom: 8,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${arena.accent}15`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {sidebarPosition === 'left' ? '\u21C0' : '\u21BC'}
      </button>
    </div>
  );
}
