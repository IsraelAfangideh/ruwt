// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomChallengeReview } from './CustomChallengeReview';

vi.mock('@/theme', () => ({
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

  it('calls onDelete on successful delete click', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByText('Delete Draft'));
    await waitFor(() => expect(mockOnDelete).toHaveBeenCalledWith('c1'));
  });

  it('shows Expand/Collapse in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    // compact starts collapsed
    expect(screen.getByText('Expand')).toBeTruthy();
  });

  it('toggles expanded state in compact mode', () => {
    render(<CustomChallengeReview challenge={challenge} orgId="org1" onApprove={mockOnApprove} onDelete={mockOnDelete} compact />);
    fireEvent.click(screen.getByText('Expand'));
    expect(screen.getByText('Collapse')).toBeTruthy();
  });
});
