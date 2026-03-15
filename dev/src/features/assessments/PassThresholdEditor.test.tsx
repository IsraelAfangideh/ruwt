// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PassThresholdEditor } from './PassThresholdEditor';

vi.mock('react-native', () => ({
  View: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  Text: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  Pressable: ({ children, onPress, ...p }: any) => (
    <button onClick={onPress} {...p}>
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  StyleSheet: { create: (s: any) => s },
}));

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

vi.mock('@/shared/ui/Input', () => ({
  Input: ({ value, onChangeText, placeholder }: any) => (
    <input
      value={value}
      onChange={(e: any) => onChangeText?.(e.target.value)}
      placeholder={placeholder}
      data-testid={`input-${placeholder}`}
    />
  ),
}));

type PassThreshold = {
  enabled: boolean;
  mode: 'all_dimensions' | 'weighted_average';
  minOverall?: number;
  dimensions: Record<string, number>;
};

describe('PassThresholdEditor', () => {
  let mockOnChange: ReturnType<typeof vi.fn<(threshold: PassThreshold | null) => void>>;

  beforeEach(() => {
    mockOnChange = vi.fn<(threshold: PassThreshold | null) => void>();
  });

  it('renders the section label and hint', () => {
    render(<PassThresholdEditor value={null} onChange={mockOnChange} />);
    expect(screen.getByText('Auto-Grading Thresholds (optional)')).toBeInTheDocument();
    expect(screen.getByText(/Automatically classify candidates/)).toBeInTheDocument();
  });

  it('shows enabled state with default threshold when value is null', () => {
    render(<PassThresholdEditor value={null} onChange={mockOnChange} />);
    expect(screen.getByText('Auto-grading enabled')).toBeInTheDocument();
  });

  it('calls onChange(null) to disable when toggle is clicked on enabled state', () => {
    render(<PassThresholdEditor value={null} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Auto-grading enabled'));
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with DEFAULT_THRESHOLD when enabling from disabled state', () => {
    const disabled = { enabled: false, mode: 'all_dimensions' as const, dimensions: {} };
    render(<PassThresholdEditor value={disabled} onChange={mockOnChange} />);
    expect(screen.getByText('Auto-grading disabled')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Auto-grading disabled'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, mode: 'all_dimensions' })
    );
  });

  it('renders dimension threshold inputs when enabled', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.getByText('Model Selection')).toBeInTheDocument();
    expect(screen.getByText('Prompt Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Debugging')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('renders mode selector buttons', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.getByText('All dimensions above threshold')).toBeInTheDocument();
    expect(screen.getByText('Weighted average above minimum')).toBeInTheDocument();
  });

  it('switches mode to weighted_average when clicked', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Weighted average above minimum'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'weighted_average' })
    );
  });

  it('switches mode back to all_dimensions when clicked', () => {
    const threshold = {
      enabled: true,
      mode: 'weighted_average' as const,
      minOverall: 60,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('All dimensions above threshold'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'all_dimensions' })
    );
  });

  it('shows Minimum Overall Score input in weighted_average mode', () => {
    const threshold = {
      enabled: true,
      mode: 'weighted_average' as const,
      minOverall: 60,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.getByText('Minimum Overall Score')).toBeInTheDocument();
  });

  it('does not show Minimum Overall Score in all_dimensions mode', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.queryByText('Minimum Overall Score')).toBeNull();
  });

  it('calls onChange when a dimension value is changed', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    const input = document.querySelector('[data-testid="input-50"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '70' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensions: expect.objectContaining({ modelSelection: 70 }),
      })
    );
  });

  it('clamps dimension value to 0-100 range', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    const input = document.querySelector('[data-testid="input-50"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensions: expect.objectContaining({ modelSelection: 100 }),
      })
    );
  });

  it('calls onChange when minOverall is changed', () => {
    const threshold = {
      enabled: true,
      mode: 'weighted_average' as const,
      minOverall: 60,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    const input = document.querySelector('[data-testid="input-60"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '75' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ minOverall: 75 })
    );
  });

  it('renders explainer text for all_dimensions mode', () => {
    const threshold = {
      enabled: true,
      mode: 'all_dimensions' as const,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.getByText(/PASS/)).toBeInTheDocument();
    expect(screen.getByText(/every dimension meets or exceeds/)).toBeInTheDocument();
    expect(screen.getByText(/FAIL/)).toBeInTheDocument();
    expect(screen.getByText(/20\+ points below/)).toBeInTheDocument();
  });

  it('renders explainer text for weighted_average mode', () => {
    const threshold = {
      enabled: true,
      mode: 'weighted_average' as const,
      minOverall: 60,
      dimensions: { modelSelection: 50, promptEfficiency: 50, debugging: 50, strategy: 50, speed: 50 },
    };
    render(<PassThresholdEditor value={threshold} onChange={mockOnChange} />);
    expect(screen.getAllByText(/weighted average/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/How scoring works/)).toBeInTheDocument();
    expect(screen.getByText(/< 40/)).toBeInTheDocument();
  });

  it('does not render dimension inputs when disabled', () => {
    const disabled = { enabled: false, mode: 'all_dimensions' as const, dimensions: {} };
    render(<PassThresholdEditor value={disabled} onChange={mockOnChange} />);
    expect(screen.queryByText('Model Selection')).toBeNull();
    expect(screen.queryByText('All dimensions above threshold')).toBeNull();
  });

  it('does not render mode selector when disabled', () => {
    const disabled = { enabled: false, mode: 'all_dimensions' as const, dimensions: {} };
    render(<PassThresholdEditor value={disabled} onChange={mockOnChange} />);
    expect(screen.queryByText('Weighted average above minimum')).toBeNull();
  });
});
