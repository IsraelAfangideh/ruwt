// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockBulkInviteProps, mockInviteTableProps } = vi.hoisted(() => ({
  mockBulkInviteProps: { current: null as any },
  mockInviteTableProps: { current: null as any },
}));

vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/features/assessments/BulkInvitePanel', () => ({
  BulkInvitePanel: (props: any) => {
    mockBulkInviteProps.current = props;
    return <div data-testid="bulk-invite" />;
  },
}));
vi.mock('@/features/assessments/InviteManagementTable', () => ({
  InviteManagementTable: (props: any) => {
    mockInviteTableProps.current = props;
    return <div data-testid="invite-table" />;
  },
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AssessmentInviteSection } = await import('./AssessmentInviteSection');

const baseProps = {
  assessmentId: 'a1',
  inviteLink: null as string | null,
  copied: false,
  onCopyInviteLink: vi.fn(),
  onGenerateInvite: vi.fn(),
  generatingInvite: false,
  inviteRefreshKey: 0,
  onInvitesSent: vi.fn(),
};

describe('AssessmentInviteSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkInviteProps.current = null;
    mockInviteTableProps.current = null;
  });

  it('renders Distribution label', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByText('Distribution')).toBeInTheDocument();
  });

  it('shows Generate Invite Link button when no inviteLink', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Generate Invite Link' })).toBeInTheDocument();
  });

  it('calls onGenerateInvite when Generate Invite Link is clicked', () => {
    const onGenerateInvite = vi.fn();
    render(<AssessmentInviteSection {...baseProps} onGenerateInvite={onGenerateInvite} />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Invite Link' }));
    expect(onGenerateInvite).toHaveBeenCalled();
  });

  it('shows Generating... text when generatingInvite is true', () => {
    render(<AssessmentInviteSection {...baseProps} generatingInvite={true} />);
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('disables button when generatingInvite is true', () => {
    render(<AssessmentInviteSection {...baseProps} generatingInvite={true} />);
    const btn = screen.getByText('Generating...');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('does not show Generate Invite Link button when inviteLink exists', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    // The generate button should not appear (only one in action bar, not here)
    const buttons = screen.getAllByRole('button');
    const generateButton = buttons.find((b) => b.textContent === 'Generate Invite Link');
    expect(generateButton).toBeUndefined();
  });

  it('shows invite link when present', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText('https://ruwt.dev/invite/abc')).toBeInTheDocument();
  });

  it('shows Candidate Invite Link label', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText('Candidate Invite Link:')).toBeInTheDocument();
  });

  it('shows Copy to Clipboard button when invite link exists', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByRole('button', { name: 'Copy to Clipboard' })).toBeInTheDocument();
  });

  it('calls onCopyInviteLink when Copy button is clicked', () => {
    const onCopyInviteLink = vi.fn();
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" onCopyInviteLink={onCopyInviteLink} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard' }));
    expect(onCopyInviteLink).toHaveBeenCalled();
  });

  it('shows Copied! when copied is true', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" copied={true} />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('shows share hint text when invite link exists', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText(/Share this link with your candidate/)).toBeInTheDocument();
  });

  it('renders BulkInvitePanel', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByTestId('bulk-invite')).toBeInTheDocument();
  });

  it('passes assessmentId and onInvitesSent to BulkInvitePanel', () => {
    const onInvitesSent = vi.fn();
    render(<AssessmentInviteSection {...baseProps} onInvitesSent={onInvitesSent} />);
    expect(mockBulkInviteProps.current.assessmentId).toBe('a1');
    expect(mockBulkInviteProps.current.onInvitesSent).toBe(onInvitesSent);
  });

  it('renders InviteManagementTable', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByTestId('invite-table')).toBeInTheDocument();
  });

  it('passes assessmentId and refreshKey to InviteManagementTable', () => {
    render(<AssessmentInviteSection {...baseProps} inviteRefreshKey={5} />);
    expect(mockInviteTableProps.current.assessmentId).toBe('a1');
    expect(mockInviteTableProps.current.refreshKey).toBe(5);
  });
});
