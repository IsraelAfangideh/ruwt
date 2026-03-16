// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsedSidebar, type SidebarTab } from './CollapsedSidebar';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    text: '#e6edf3',
    textMuted: '#8b949e',
    border: '#30363d',
    accent: '#c9a962',
  },
}));

vi.mock('@/shared/theme/tokens', () => ({
  fontFamily: { mono: 'monospace', body: 'sans-serif', display: 'serif' },
}));

const defaultProps = {
  tabs: ['description', 'chat', 'discussion'] as SidebarTab[],
  hasUnreadChat: false,
  onExpandTab: vi.fn(),
  onTogglePosition: vi.fn(),
  sidebarPosition: 'left' as const,
};

describe('CollapsedSidebar', () => {
  it('renders collapsed sidebar container', () => {
    render(<CollapsedSidebar {...defaultProps} />);
    expect(screen.getByTestId('collapsed-sidebar')).toBeInTheDocument();
  });

  it('renders tab buttons for each tab', () => {
    render(<CollapsedSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Expand Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand AI Chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand Discussion')).toBeInTheDocument();
  });

  it('calls onExpandTab with correct tab when clicked', () => {
    const onExpandTab = vi.fn();
    render(<CollapsedSidebar {...defaultProps} onExpandTab={onExpandTab} />);
    fireEvent.click(screen.getByLabelText('Expand AI Chat'));
    expect(onExpandTab).toHaveBeenCalledWith('chat');
  });

  it('shows unread dot when hasUnreadChat is true', () => {
    render(<CollapsedSidebar {...defaultProps} hasUnreadChat={true} />);
    expect(screen.getByTestId('collapsed-unread-dot')).toBeInTheDocument();
  });

  it('does not show unread dot when hasUnreadChat is false', () => {
    render(<CollapsedSidebar {...defaultProps} hasUnreadChat={false} />);
    expect(screen.queryByTestId('collapsed-unread-dot')).toBeNull();
  });

  it('renders position toggle button', () => {
    render(<CollapsedSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Move sidebar to right')).toBeInTheDocument();
  });

  it('calls onTogglePosition when position button clicked', () => {
    const onTogglePosition = vi.fn();
    render(<CollapsedSidebar {...defaultProps} onTogglePosition={onTogglePosition} />);
    fireEvent.click(screen.getByLabelText('Move sidebar to right'));
    expect(onTogglePosition).toHaveBeenCalled();
  });

  it('shows "Move sidebar to left" when position is right', () => {
    render(<CollapsedSidebar {...defaultProps} sidebarPosition="right" />);
    expect(screen.getByLabelText('Move sidebar to left')).toBeInTheDocument();
  });

  it('renders results tab when included', () => {
    render(<CollapsedSidebar {...defaultProps} tabs={['description', 'chat', 'discussion', 'results']} />);
    expect(screen.getByLabelText('Expand Results')).toBeInTheDocument();
  });

  it('hover interactions do not crash', () => {
    render(<CollapsedSidebar {...defaultProps} />);
    const btn = screen.getByLabelText('Expand Description');
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    // No errors thrown

    const toggleBtn = screen.getByLabelText('Move sidebar to right');
    fireEvent.mouseEnter(toggleBtn);
    fireEvent.mouseLeave(toggleBtn);
    // No errors thrown
  });
});
