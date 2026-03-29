// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { CustomChallengeReview } from './CustomChallengeReview';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

const challenge = {
  id: 'c1',
  title: 'Test Challenge',
  description: 'Build a function that adds two numbers',
  difficulty: 'easy',
  category: 'prompt_efficiency',
  skillTested: 'Math operations',
  language: 'typescript',
  starterCode: 'function add(a, b) { }',
  testCases: JSON.stringify([{ input: '1, 2', expectedOutput: '3' }]),
  hiddenTestCases: JSON.stringify([{ input: '5, 5', expectedOutput: '10' }]),
  testHarness: 'module.exports = add;',
  status: 'draft',
  aiGenerated: 1,
  tags: 'math,basic',
};

const mockOnApprove = vi.fn();
const mockOnDelete = vi.fn();

describe('CustomChallengeReview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockOnApprove.mockClear();
    mockOnDelete.mockClear();
  });

  it('renders challenge title', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Test Challenge')).toBeInTheDocument();
  });

  it('renders AI Generated badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
  });

  it('renders difficulty badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('EASY')).toBeInTheDocument();
  });

  it('renders DRAFT status badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('renders skill tested description', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Math operations')).toBeInTheDocument();
  });

  it('renders description section', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Build a function that adds two numbers')).toBeInTheDocument();
  });

  it('renders starter code', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText(/Starter Code/)).toBeInTheDocument();
  });

  it('renders test case counts', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText(/1 visible, 1 hidden/)).toBeInTheDocument();
  });

  it('renders approve and delete buttons for draft challenges', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByRole('button', { name: 'Approve Challenge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Draft' })).toBeInTheDocument();
  });

  it('hides approve/delete buttons for active challenges', () => {
    const activeChallenge = { ...challenge, status: 'active' };
    render(<CustomChallengeReview challenge={activeChallenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Approve Challenge')).toBeNull();
  });

  it('calls onApprove on successful approve click', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve Challenge' }));
    await waitFor(() => expect(mockOnApprove).toHaveBeenCalledWith('c1'));
  });

  it('calls onDelete after two-step confirmation', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft' }));
    expect(mockOnDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    await waitFor(() => expect(mockOnDelete).toHaveBeenCalledWith('c1'));
  });

  it('shows Expand/Collapse in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    // compact starts collapsed
    expect(screen.getByText(/Expand/)).toBeInTheDocument();
  });

  it('toggles expanded state in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    fireEvent.click(screen.getByText(/Expand/));
    expect(screen.getByText(/Collapse/)).toBeInTheDocument();
  });

  it('renders Try Challenge button when starterCode exists', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByRole('button', { name: 'Try Challenge' })).toBeInTheDocument();
  });

  it('navigates to Arena when Try Challenge is clicked', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try Challenge' }));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'c1' });
  });

  it('does not render Try Challenge when starterCode is null', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, starterCode: null }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Try Challenge')).toBeNull();
  });

  it('shows APPROVED for active status', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, status: 'active' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('shows ARCHIVED for archived status', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, status: 'archived' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
  });

  it('uses fallback color for unknown difficulty', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, difficulty: 'insane' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('INSANE')).toBeInTheDocument();
  });

  it('does not show skillTested when null', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, skillTested: null }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Math operations')).toBeNull();
  });

  it('does not show testHarness when null', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, testHarness: null }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Test Harness')).toBeNull();
  });

  it('does not show AI Generated badge when aiGenerated is 0', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, aiGenerated: 0 }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('AI Generated')).toBeNull();
  });

  it('shows "+N more test cases" when more than 5 test cases exist', () => {
    const manyTestCases = Array.from({ length: 7 }, (_, i) => ({
      input: `input-${i}`,
      expectedOutput: `output-${i}`,
    }));
    render(<CustomChallengeReview
      challenge={{ ...challenge, testCases: JSON.stringify(manyTestCases) }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    expect(screen.getByText('+2 more test cases not shown')).toBeInTheDocument();
  });

  it('shows singular "test case" when exactly 6 test cases', () => {
    const sixTestCases = Array.from({ length: 6 }, (_, i) => ({
      input: `input-${i}`,
      expectedOutput: `output-${i}`,
    }));
    render(<CustomChallengeReview
      challenge={{ ...challenge, testCases: JSON.stringify(sixTestCases) }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    expect(screen.getByText('+1 more test case not shown')).toBeInTheDocument();
  });

  it('cancels delete confirmation when Cancel is clicked', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft' }));
    expect(screen.getByRole('button', { name: 'Confirm Delete' })).toBeInTheDocument();
    // Click Cancel to dismiss
    fireEvent.click(screen.getByLabelText('Cancel delete'));
    // Should show Delete Draft again
    expect(screen.getByRole('button', { name: 'Delete Draft' })).toBeInTheDocument();
  });

  it('handles hiddenTestCases being null', () => {
    render(<CustomChallengeReview
      challenge={{ ...challenge, hiddenTestCases: null }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    expect(screen.getByText(/1 visible, 0 hidden/)).toBeInTheDocument();
  });

  it('handles invalid testCases JSON gracefully', () => {
    render(<CustomChallengeReview
      challenge={{ ...challenge, testCases: 'not-json' }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    // Should still render (testCases defaults to empty array on parse error)
    expect(screen.getByText(/0 visible/)).toBeInTheDocument();
  });
});
