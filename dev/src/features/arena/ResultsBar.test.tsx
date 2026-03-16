// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsBar, type TestResults } from './ResultsBar';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    text: '#e6edf3',
    textMuted: '#8b949e',
    border: '#30363d',
    accent: '#c9a962',
    success: '#3fb950',
    error: '#f85149',
  },
}));

const passingResults: TestResults = {
  passed: true,
  passedTests: 3,
  totalTests: 3,
  results: [
    { passed: true, input: '1', expectedOutput: '1', actualOutput: '1' },
    { passed: true, input: '2', expectedOutput: '2', actualOutput: '2' },
    { passed: true, input: '3', expectedOutput: '3', actualOutput: '3' },
  ],
  isSubmission: false,
};

const failingResults: TestResults = {
  passed: false,
  passedTests: 1,
  totalTests: 3,
  results: [
    { passed: true, input: '1', expectedOutput: '1', actualOutput: '1' },
    { passed: false, input: '2', expectedOutput: '4', actualOutput: '3', error: 'Wrong answer' },
    { passed: false, input: '3', expectedOutput: '9', actualOutput: '6' },
  ],
  isSubmission: false,
};

describe('ResultsBar', () => {
  it('renders pass count for passing results', () => {
    render(<ResultsBar results={passingResults} />);
    expect(screen.getByText(/3\/3 passed/)).toBeInTheDocument();
  });

  it('renders pass count for failing results', () => {
    render(<ResultsBar results={failingResults} />);
    expect(screen.getByText(/1\/3 passed/)).toBeInTheDocument();
  });

  it('renders checkmark for passing results', () => {
    render(<ResultsBar results={passingResults} />);
    expect(screen.getByText(/\u2713/)).toBeInTheDocument();
  });

  it('renders X mark for failing results', () => {
    render(<ResultsBar results={failingResults} />);
    expect(screen.getByText(/\u2717 1\/3/)).toBeInTheDocument();
  });

  it('shows submission badge when isSubmission is true', () => {
    const submissionResults = { ...passingResults, isSubmission: true };
    render(<ResultsBar results={submissionResults} />);
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  it('shows hidden test count hint after run tests pass', () => {
    render(<ResultsBar results={passingResults} hiddenTestCount={5} />);
    expect(screen.getByText(/submit to run all 8 tests/)).toBeInTheDocument();
  });

  it('toggles details expansion', () => {
    render(<ResultsBar results={passingResults} />);
    // Passing non-submission starts collapsed
    const toggleBtn = screen.getByText(/Details/);
    fireEvent.click(toggleBtn);
    // Now should show Hide
    expect(screen.getByText(/Hide/)).toBeInTheDocument();
  });

  it('auto-expands on failure', () => {
    render(<ResultsBar results={failingResults} />);
    // Should show test details automatically for failures (multiple failed tests)
    expect(screen.getAllByText('Input').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expected Output').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Your Output').length).toBeGreaterThan(0);
  });

  it('shows error message for failed tests', () => {
    render(<ResultsBar results={failingResults} />);
    expect(screen.getByText(/Wrong answer/)).toBeInTheDocument();
  });

  it('renders dismiss button when onDismiss is provided', () => {
    const mockDismiss = vi.fn();
    render(<ResultsBar results={passingResults} onDismiss={mockDismiss} />);
    const closeBtn = screen.getByText('\u00D7');
    fireEvent.click(closeBtn);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('renders Ask AI for Help button on failure when onAskAI provided', () => {
    const mockAskAI = vi.fn();
    render(<ResultsBar results={failingResults} onAskAI={mockAskAI} />);
    expect(screen.getByRole('button', { name: 'Ask AI for Help' })).toBeInTheDocument();
  });

  it('calls onAskAI with debug prompt when Ask AI is clicked', () => {
    const mockAskAI = vi.fn();
    render(<ResultsBar results={failingResults} onAskAI={mockAskAI} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI for Help' }));
    expect(mockAskAI).toHaveBeenCalled();
    const prompt = mockAskAI.mock.calls[0][0];
    expect(prompt).toContain('fails 2 test');
  });

  it('shows encouraging message for partial pass', () => {
    const mockAskAI = vi.fn();
    render(<ResultsBar results={failingResults} onAskAI={mockAskAI} />);
    expect(screen.getByText(/1 of 3 tests passing/)).toBeInTheDocument();
  });

  it('shows "no tests passing" message when all fail', () => {
    const allFail: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 2,
      results: [
        { passed: false, input: '1', expectedOutput: '1', actualOutput: '0' },
        { passed: false, input: '2', expectedOutput: '2', actualOutput: '0' },
      ],
      isSubmission: false,
    };
    const mockAskAI = vi.fn();
    render(<ResultsBar results={allFail} onAskAI={mockAskAI} />);
    expect(screen.getByText(/No tests passing yet/)).toBeInTheDocument();
  });

  it('shows hint text when provided on test results', () => {
    const withHint: TestResults = {
      passed: false,
      passedTests: 0,
      totalTests: 1,
      results: [
        { passed: false, input: '1', expectedOutput: '1', actualOutput: '0', hint: 'Check addition' },
      ],
      isSubmission: false,
    };
    render(<ResultsBar results={withHint} />);
    expect(screen.getByText('Check addition')).toBeInTheDocument();
  });
});
