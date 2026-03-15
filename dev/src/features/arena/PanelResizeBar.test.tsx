// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelResizeBar } from './PanelResizeBar';

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

// Mock react-resizable-panels
vi.mock('react-resizable-panels', () => ({
  Separator: ({ children, style, onMouseEnter, onMouseLeave, onDoubleClick, ...props }: any) => (
    <div
      {...props}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  ),
}));

describe('PanelResizeBar', () => {
  it('renders horizontal resize handle', () => {
    render(<PanelResizeBar direction="horizontal" />);
    const handle = screen.getByTestId('resize-handle-horizontal');
    expect(handle).toBeTruthy();
    expect(handle.style.cursor).toBe('col-resize');
  });

  it('renders vertical resize handle', () => {
    render(<PanelResizeBar direction="vertical" />);
    const handle = screen.getByTestId('resize-handle-vertical');
    expect(handle).toBeTruthy();
    expect(handle.style.cursor).toBe('row-resize');
  });

  it('shows indicator on hover', () => {
    render(<PanelResizeBar direction="horizontal" />);
    const handle = screen.getByTestId('resize-handle-horizontal');
    expect(screen.queryByTestId('resize-indicator')).toBeNull();
    fireEvent.mouseEnter(handle);
    expect(screen.getByTestId('resize-indicator')).toBeInTheDocument();
  });

  it('hides indicator on mouse leave', () => {
    render(<PanelResizeBar direction="horizontal" />);
    const handle = screen.getByTestId('resize-handle-horizontal');
    fireEvent.mouseEnter(handle);
    expect(screen.getByTestId('resize-indicator')).toBeInTheDocument();
    fireEvent.mouseLeave(handle);
    expect(screen.queryByTestId('resize-indicator')).toBeNull();
  });

  it('widens on hover for horizontal', () => {
    render(<PanelResizeBar direction="horizontal" />);
    const handle = screen.getByTestId('resize-handle-horizontal');
    expect(handle.style.width).toBe('4px');
    fireEvent.mouseEnter(handle);
    expect(handle.style.width).toBe('6px');
  });

  it('grows taller on hover for vertical', () => {
    render(<PanelResizeBar direction="vertical" />);
    const handle = screen.getByTestId('resize-handle-vertical');
    expect(handle.style.height).toBe('4px');
    fireEvent.mouseEnter(handle);
    expect(handle.style.height).toBe('6px');
  });

  it('calls onDoubleClick handler', () => {
    const onDoubleClick = vi.fn();
    render(<PanelResizeBar direction="horizontal" onDoubleClick={onDoubleClick} />);
    fireEvent.doubleClick(screen.getByTestId('resize-handle-horizontal'));
    expect(onDoubleClick).toHaveBeenCalled();
  });

  it('indicator has correct dimensions for horizontal', () => {
    render(<PanelResizeBar direction="horizontal" />);
    fireEvent.mouseEnter(screen.getByTestId('resize-handle-horizontal'));
    const indicator = screen.getByTestId('resize-indicator');
    expect(indicator.style.width).toBe('2px');
    expect(indicator.style.height).toBe('16px');
  });

  it('indicator has correct dimensions for vertical', () => {
    render(<PanelResizeBar direction="vertical" />);
    fireEvent.mouseEnter(screen.getByTestId('resize-handle-vertical'));
    const indicator = screen.getByTestId('resize-indicator');
    expect(indicator.style.width).toBe('16px');
    expect(indicator.style.height).toBe('2px');
  });
});
