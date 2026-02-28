// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanApproval, extractPlanBlock } from './PlanApproval';

vi.mock('../../theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
    textMuted: '#8b949e',
    border: '#30363d',
    accent: '#c9a962',
  },
}));

describe('PlanApproval', () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();

  const threeSteps = `1. Step one
2. Step two
3. Step three`;

  it('renders Plan header', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Plan')).toBeTruthy();
  });

  it('renders parsed numbered steps', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Step one')).toBeTruthy();
    expect(screen.getByText('Step two')).toBeTruthy();
    expect(screen.getByText('Step three')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders raw text when no numbered steps are found', () => {
    render(<PlanApproval planText="Just some plain text without numbers" onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Just some plain text without numbers')).toBeTruthy();
  });

  it('renders Accept & Execute button', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Accept & Execute')).toBeTruthy();
  });

  it('renders Reject button', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('calls onAccept when Accept is clicked', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    fireEvent.click(screen.getByText('Accept & Execute'));
    expect(mockOnAccept).toHaveBeenCalled();
  });

  it('calls onReject when Reject is clicked', () => {
    render(<PlanApproval planText={threeSteps} onAccept={mockOnAccept} onReject={mockOnReject} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(mockOnReject).toHaveBeenCalled();
  });

  it('disables buttons when disabled prop is true', () => {
    render(<PlanApproval planText="1. Do" onAccept={mockOnAccept} onReject={mockOnReject} disabled />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toHaveProperty('disabled', true);
    });
  });

  it('parses steps with both . and ) separators', () => {
    const mixed = `1) Do first
2. Do second`;
    render(<PlanApproval planText={mixed} onAccept={mockOnAccept} onReject={mockOnReject} />);
    expect(screen.getByText('Do first')).toBeTruthy();
    expect(screen.getByText('Do second')).toBeTruthy();
  });
});

describe('extractPlanBlock', () => {
  it('extracts text from <plan> tags', () => {
    const input = `Some text <plan>1. Step one
2. Step two</plan> more text`;
    const result = extractPlanBlock(input);
    expect(result).toBe(`1. Step one
2. Step two`);
  });

  it('returns null when no plan tags found', () => {
    expect(extractPlanBlock('No plan here')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(extractPlanBlock('')).toBe(null);
  });

  it('trims whitespace from extracted plan', () => {
    const input = `<plan>
  1. Step
  </plan>`;
    const result = extractPlanBlock(input);
    expect(result).toBe('1. Step');
  });
});
