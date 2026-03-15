// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { CustomChallengeReview } from './CustomChallengeReview';

vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#aaa', bg: '#fff', card: '#fff', cardForeground: '#000',
    mutedForeground: '#555', success: '#5a8a5a', destructive: '#b06060',
    primary: '#000', primaryForeground: '#fff', secondary: '#eee',
    secondaryForeground: '#333',
  }),
}));

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
    expect(screen.getByText('Test Challenge')).toBeTruthy();
  });

  it('renders AI Generated badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('AI Generated')).toBeTruthy();
  });

  it('renders difficulty badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('EASY')).toBeTruthy();
  });

  it('renders DRAFT status badge', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('DRAFT')).toBeTruthy();
  });

  it('renders skill tested description', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Math operations')).toBeTruthy();
  });

  it('renders description section', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Build a function that adds two numbers')).toBeTruthy();
  });

  it('renders starter code', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText(/Starter Code/)).toBeTruthy();
  });

  it('renders test case counts', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText(/1 visible, 1 hidden/)).toBeTruthy();
  });

  it('renders approve and delete buttons for draft challenges', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Approve Challenge')).toBeTruthy();
    expect(screen.getByText('Delete Draft')).toBeTruthy();
  });

  it('hides approve/delete buttons for active challenges', () => {
    const activeChallenge = { ...challenge, status: 'active' };
    render(<CustomChallengeReview challenge={activeChallenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Approve Challenge')).toBeNull();
  });

  it('calls onApprove on successful approve click', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Approve Challenge'));
    await waitFor(() => expect(mockOnApprove).toHaveBeenCalledWith('c1'));
  });

  it('calls onDelete after two-step confirmation', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete Draft'));
    expect(mockOnDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm Delete')).toBeTruthy();
    fireEvent.click(screen.getByText('Confirm Delete'));
    await waitFor(() => expect(mockOnDelete).toHaveBeenCalledWith('c1'));
  });

  it('shows Expand/Collapse in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    // compact starts collapsed
    expect(screen.getByText(/Expand/)).toBeTruthy();
  });

  it('toggles expanded state in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    fireEvent.click(screen.getByText(/Expand/));
    expect(screen.getByText(/Collapse/)).toBeTruthy();
  });

  it('renders Try Challenge button when starterCode exists', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('Try Challenge')).toBeTruthy();
  });

  it('navigates to Arena when Try Challenge is clicked', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Try Challenge'));
    expect(mockNavigate).toHaveBeenCalledWith('Arena', { challengeId: 'c1' });
  });

  it('does not render Try Challenge when starterCode is null', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, starterCode: null }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.queryByText('Try Challenge')).toBeNull();
  });

  it('shows APPROVED for active status', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, status: 'active' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('APPROVED')).toBeTruthy();
  });

  it('shows ARCHIVED for archived status', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, status: 'archived' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('ARCHIVED')).toBeTruthy();
  });

  it('uses fallback color for unknown difficulty', () => {
    render(<CustomChallengeReview challenge={{ ...challenge, difficulty: 'insane' }} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    expect(screen.getByText('INSANE')).toBeTruthy();
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
    expect(screen.getByText('+2 more test cases not shown')).toBeTruthy();
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
    expect(screen.getByText('+1 more test case not shown')).toBeTruthy();
  });

  it('cancels delete confirmation when Cancel is clicked', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete Draft'));
    expect(screen.getByText('Confirm Delete')).toBeTruthy();
    // Click Cancel to dismiss
    fireEvent.click(screen.getByLabelText('Cancel delete'));
    // Should show Delete Draft again
    expect(screen.getByText('Delete Draft')).toBeTruthy();
  });

  it('handles hiddenTestCases being null', () => {
    render(<CustomChallengeReview
      challenge={{ ...challenge, hiddenTestCases: null }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    expect(screen.getByText(/1 visible, 0 hidden/)).toBeTruthy();
  });

  it('handles invalid testCases JSON gracefully', () => {
    render(<CustomChallengeReview
      challenge={{ ...challenge, testCases: 'not-json' }}
      orgId="org1"
      onApprove={mockOnApprove}
      onDelete={mockOnDelete}
    />);
    // Should still render (testCases defaults to empty array on parse error)
    expect(screen.getByText(/0 visible/)).toBeTruthy();
  });
});
