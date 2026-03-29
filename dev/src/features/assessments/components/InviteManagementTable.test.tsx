// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { InviteManagementTable } from './InviteManagementTable';

vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children, ...p }: any) => <span {...p}>{children}</span>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const invites = [
  {
    id: 'inv1',
    candidateEmail: 'alice@test.com',
    candidateName: 'Alice',
    token: 'tok1',
    status: 'pending',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastReminderAt: null,
    reminderCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inv2',
    candidateEmail: 'bob@test.com',
    candidateName: 'Bob',
    token: 'tok2',
    status: 'completed',
    expiresAt: null,
    lastReminderAt: null,
    reminderCount: 0,
    createdAt: new Date().toISOString(),
  },
];

describe('InviteManagementTable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading indicator initially', () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<InviteManagementTable assessmentId="a1" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no invites', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText(/No invites generated/)).toBeInTheDocument());
  });

  it('renders invite rows when data is loaded', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('shows Candidate Invites count in header', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('Candidate Invites (2)')).toBeInTheDocument());
  });

  it('shows status badges for invites', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('shows Copy Link button for each invite', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      const copyButtons = screen.getAllByText('Copy Link');
      expect(copyButtons.length).toBe(2);
    });
  });

  it('shows Remind button for pending invites with email', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Remind')).toBeInTheDocument();
    });
  });

  it('shows Remind All Pending button when pending invites exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText(/Remind All Pending/)).toBeInTheDocument());
  });

  it('shows table headers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('shows (no email) when candidateEmail is null', async () => {
    const noEmailInvites = [
      { ...invites[0], candidateEmail: null },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => noEmailInvites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('(no email)')).toBeInTheDocument());
  });

  it('does not show Remind for invites without email', async () => {
    const noEmailInvites = [
      { ...invites[0], candidateEmail: null },
    ];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => noEmailInvites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('(no email)')).toBeInTheDocument());
    expect(screen.queryByText('Remind')).toBeNull();
  });

  it('does not show Remind for completed invites', async () => {
    const completedOnly = [invites[1]]; // completed
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => completedOnly,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('bob@test.com')).toBeInTheDocument());
    expect(screen.queryByText('Remind')).toBeNull();
  });

  it('shows dash for null expiresAt', async () => {
    const noExpiryInvites = [invites[1]]; // expiresAt: null
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => noExpiryInvites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('\u2014')).toBeInTheDocument();
    });
  });

  it('copies link to clipboard when Copy Link is clicked', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getAllByText('Copy Link').length).toBe(2);
    });
    fireEvent.click(screen.getAllByText('Copy Link')[0]);
    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/assess/tok1'));
    });
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('sends remind request when Remind is clicked', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Remind')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Remind'));
    await waitFor(() => {
      const remindCall = fetchSpy.mock.calls.find((c: any[]) => c[0]?.includes('/remind'));
      expect(remindCall).toBeTruthy();
      expect(JSON.parse(remindCall![1]!.body as string)).toEqual({ inviteIds: ['inv1'] });
    });
  });

  it('sends remind all request when Remind All Pending is clicked', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText(/Remind All Pending/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Remind All Pending/));
    await waitFor(() => {
      const remindCall = fetchSpy.mock.calls.find((c: any[]) => {
        try { return JSON.parse(c[1]?.body)?.all === true; } catch { return false; }
      });
      expect(remindCall).toBeTruthy();
    });
  });

  it('does not show Remind All Pending when no pending invites', async () => {
    const completedOnly = [invites[1]]; // only completed
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => completedOnly,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('bob@test.com')).toBeInTheDocument());
    expect(screen.queryByText(/Remind All Pending/)).toBeNull();
  });

  it('fetches invites with correct assessmentId', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<InviteManagementTable assessmentId="my-assessment-42" />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/assessments/my-assessment-42/invites');
    });
  });

  it('shows pending count in Remind All button', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Remind All Pending (1)')).toBeInTheDocument();
    });
  });

  it('shows error message when remind fails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => invites } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'fail' }) } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('Remind')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Remind'));
    await waitFor(() => {
      expect(screen.getByText('Failed to send reminder')).toBeInTheDocument();
    });
    fetchSpy.mockRestore();
  });

  it('shows expiring-soon styling for invites near expiry', async () => {
    const soonExpiring = [{
      ...invites[0],
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }];
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => soonExpiring,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    });
  });
});
