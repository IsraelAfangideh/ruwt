import { useState } from 'react';
import { Separator } from 'react-resizable-panels';
import { arena } from '@/theme/colors';

interface PanelResizeBarProps {
  direction: 'horizontal' | 'vertical';
  onDoubleClick?: () => void;
}

export function PanelResizeBar({ direction, onDoubleClick }: PanelResizeBarProps) {
  const [hovered, setHovered] = useState(false);

  const isHorizontal = direction === 'horizontal';

  return (
    <Separator
      data-testid={`resize-handle-${direction}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onDoubleClick}
      style={isHorizontal ? {
        width: hovered ? 6 : 4,
        background: hovered ? arena.surfaceHover ?? arena.surface : arena.surface,
        borderLeft: `1px solid ${arena.border}`,
        borderRight: `1px solid ${arena.border}`,
        cursor: 'col-resize',
        transition: 'width 0.15s, background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      } : {
        height: hovered ? 6 : 4,
        background: hovered ? arena.surfaceHover ?? arena.surface : arena.surface,
        borderTop: `1px solid ${arena.border}`,
        borderBottom: `1px solid ${arena.border}`,
        cursor: 'row-resize',
        transition: 'height 0.15s, background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {hovered && (
        <div
          data-testid="resize-indicator"
          style={{
            width: isHorizontal ? 2 : 16,
            height: isHorizontal ? 16 : 2,
            borderRadius: 1,
            background: arena.textMuted,
            opacity: 0.5,
          }}
        />
      )}
    </Separator>
  );
}
