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
vi.mock('@/shared/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe', bgWarm: '#faf8f5',
  }),
}));
vi.mock('@/shared/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

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
    expect(screen.getByText('Distribution')).toBeTruthy();
  });

  it('shows Generate Invite Link button when no inviteLink', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByText('Generate Invite Link')).toBeTruthy();
  });

  it('calls onGenerateInvite when Generate Invite Link is clicked', () => {
    const onGenerateInvite = vi.fn();
    render(<AssessmentInviteSection {...baseProps} onGenerateInvite={onGenerateInvite} />);
    fireEvent.click(screen.getByText('Generate Invite Link'));
    expect(onGenerateInvite).toHaveBeenCalled();
  });

  it('shows Generating... text when generatingInvite is true', () => {
    render(<AssessmentInviteSection {...baseProps} generatingInvite={true} />);
    expect(screen.getByText('Generating...')).toBeTruthy();
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
    expect(screen.getByText('https://ruwt.dev/invite/abc')).toBeTruthy();
  });

  it('shows Candidate Invite Link label', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText('Candidate Invite Link:')).toBeTruthy();
  });

  it('shows Copy to Clipboard button when invite link exists', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText('Copy to Clipboard')).toBeTruthy();
  });

  it('calls onCopyInviteLink when Copy button is clicked', () => {
    const onCopyInviteLink = vi.fn();
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" onCopyInviteLink={onCopyInviteLink} />);
    fireEvent.click(screen.getByText('Copy to Clipboard'));
    expect(onCopyInviteLink).toHaveBeenCalled();
  });

  it('shows Copied! when copied is true', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" copied={true} />);
    expect(screen.getByText('Copied!')).toBeTruthy();
  });

  it('shows share hint text when invite link exists', () => {
    render(<AssessmentInviteSection {...baseProps} inviteLink="https://ruwt.dev/invite/abc" />);
    expect(screen.getByText(/Share this link with your candidate/)).toBeTruthy();
  });

  it('renders BulkInvitePanel', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByTestId('bulk-invite')).toBeTruthy();
  });

  it('passes assessmentId and onInvitesSent to BulkInvitePanel', () => {
    const onInvitesSent = vi.fn();
    render(<AssessmentInviteSection {...baseProps} onInvitesSent={onInvitesSent} />);
    expect(mockBulkInviteProps.current.assessmentId).toBe('a1');
    expect(mockBulkInviteProps.current.onInvitesSent).toBe(onInvitesSent);
  });

  it('renders InviteManagementTable', () => {
    render(<AssessmentInviteSection {...baseProps} />);
    expect(screen.getByTestId('invite-table')).toBeTruthy();
  });

  it('passes assessmentId and refreshKey to InviteManagementTable', () => {
    render(<AssessmentInviteSection {...baseProps} inviteRefreshKey={5} />);
    expect(mockInviteTableProps.current.assessmentId).toBe('a1');
    expect(mockInviteTableProps.current.refreshKey).toBe(5);
  });
});
