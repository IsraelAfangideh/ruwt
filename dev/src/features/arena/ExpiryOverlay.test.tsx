// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpiryOverlay from './ExpiryOverlay';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    text: '#e6edf3',
    textMuted: '#8b949e',
    border: '#30363d',
    accent: '#c9a962',
    error: '#f85149',
  },
}));

describe('ExpiryOverlay', () => {
  const mockOnReview = vi.fn();
  const mockOnRestart = vi.fn();

  it('renders "Time\'s Up!" heading', () => {
    render(<ExpiryOverlay totalTokens={500} totalCost={1000} isMobile={false} onReview={mockOnReview} />);
    expect(screen.getByText("Time's Up!")).toBeTruthy();
  });

  it('renders token count', () => {
    render(<ExpiryOverlay totalTokens={1500} totalCost={1000} isMobile={false} onReview={mockOnReview} />);
    expect(screen.getByText('1,500')).toBeTruthy();
    expect(screen.getByText('tokens used')).toBeTruthy();
  });

  it('renders formatted cost', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={50000} isMobile={false} onReview={mockOnReview} />);
    expect(screen.getByText('$5.00')).toBeTruthy();
    expect(screen.getByText('cost')).toBeTruthy();
  });

  it('formats small costs with more decimal places', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={50} isMobile={false} onReview={mockOnReview} />);
    expect(screen.getByText('$0.0050')).toBeTruthy();
  });

  it('renders Review Code button', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} />);
    expect(screen.getByText('Review Code')).toBeTruthy();
  });

  it('calls onReview when Review Code is clicked', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} />);
    fireEvent.click(screen.getByText('Review Code'));
    expect(mockOnReview).toHaveBeenCalled();
  });

  it('renders Start New Attempt button when onRestart provided', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} onRestart={mockOnRestart} />);
    expect(screen.getByText('Start New Attempt')).toBeTruthy();
  });

  it('does not render Start New Attempt when onRestart is not provided', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} />);
    expect(screen.queryByText('Start New Attempt')).toBeNull();
  });

  it('calls onRestart when Start New Attempt is clicked', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} onRestart={mockOnRestart} />);
    fireEvent.click(screen.getByText('Start New Attempt'));
    expect(mockOnRestart).toHaveBeenCalled();
  });

  it('renders in mobile layout', () => {
    render(<ExpiryOverlay totalTokens={100} totalCost={500} isMobile={true} onReview={mockOnReview} onRestart={mockOnRestart} />);
    expect(screen.getByText("Time's Up!")).toBeTruthy();
    expect(screen.getByText('Review Code')).toBeTruthy();
    expect(screen.getByText('Start New Attempt')).toBeTruthy();
  });

  it('renders "solved it" heading and Submit button when onSubmit is provided', () => {
    const mockOnSubmit = vi.fn();
    render(<ExpiryOverlay totalTokens={200} totalCost={300} isMobile={false} onReview={mockOnReview} onSubmit={mockOnSubmit} />);
    expect(screen.getByText("Time's Up — But You Solved It!")).toBeTruthy();
    expect(screen.getByText('All tests passed. Submit now to lock in your score.')).toBeTruthy();
    expect(screen.getByText('Submit Solution')).toBeTruthy();
  });

  it('calls onSubmit when Submit Solution is clicked', () => {
    const mockOnSubmit = vi.fn();
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} onSubmit={mockOnSubmit} />);
    fireEvent.click(screen.getByText('Submit Solution'));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('does not render Submit Solution or passed hint when onSubmit is not provided', () => {
    render(<ExpiryOverlay totalTokens={0} totalCost={0} isMobile={false} onReview={mockOnReview} />);
    expect(screen.queryByText('Submit Solution')).toBeNull();
    expect(screen.queryByText(/All tests passed/)).toBeNull();
  });

  it('renders mobile layout with onSubmit', () => {
    const mockOnSubmit = vi.fn();
    render(<ExpiryOverlay totalTokens={100} totalCost={200} isMobile={true} onReview={mockOnReview} onSubmit={mockOnSubmit} onRestart={mockOnRestart} />);
    expect(screen.getByText("Time's Up — But You Solved It!")).toBeTruthy();
    expect(screen.getByText('Submit Solution')).toBeTruthy();
    expect(screen.getByText('Review Code')).toBeTruthy();
    expect(screen.getByText('Start New Attempt')).toBeTruthy();
  });
});
