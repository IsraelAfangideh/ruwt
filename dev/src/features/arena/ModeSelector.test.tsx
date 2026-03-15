// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector } from './ModeSelector';

vi.mock('../../shared/theme/colors', () => ({
  arena: {
    accent: '#c9a962',
    border: '#30363d',
    textMuted: '#8b949e',
  },
}));

describe('ModeSelector', () => {
  const mockOnModeChange = vi.fn();

  it('renders all 4 mode buttons', () => {
    render(<ModeSelector mode="agent" onModeChange={mockOnModeChange} />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('renders subtitles for each mode', () => {
    render(<ModeSelector mode="agent" onModeChange={mockOnModeChange} />);
    expect(screen.getByText('Writes & tests code')).toBeInTheDocument();
    expect(screen.getByText('Plans before coding')).toBeInTheDocument();
    expect(screen.getByText('Fixes failing tests')).toBeInTheDocument();
    expect(screen.getByText('Answers questions')).toBeInTheDocument();
  });

  it('calls onModeChange when a mode button is clicked', () => {
    render(<ModeSelector mode="agent" onModeChange={mockOnModeChange} />);
    fireEvent.click(screen.getByText('Plan'));
    expect(mockOnModeChange).toHaveBeenCalledWith('plan');
  });

  it('calls onModeChange with debug when Debug is clicked', () => {
    mockOnModeChange.mockClear();
    render(<ModeSelector mode="agent" onModeChange={mockOnModeChange} />);
    fireEvent.click(screen.getByText('Debug'));
    expect(mockOnModeChange).toHaveBeenCalledWith('debug');
  });

  it('disables buttons when disabled prop is true', () => {
    render(<ModeSelector mode="agent" onModeChange={mockOnModeChange} disabled />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toHaveProperty('disabled', true);
    });
  });
});
