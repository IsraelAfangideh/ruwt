// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { InviteManagementTable } from './InviteManagementTable';

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...p }: any) => <span {...p}>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => <button onClick={onPress} {...props}>{children}</button>,
}));
vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#aaa', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#333', success: '#5a8a5a',
    destructive: '#b06060',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { xs: 12, sm: 14, md: 16 },
  fontFamily: { body: 'sans-serif' },
}));

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
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows empty state when no invites', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText(/No invites generated/)).toBeTruthy());
  });

  it('renders invite rows when data is loaded', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('alice@test.com')).toBeTruthy());
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('shows Candidate Invites count in header', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('Candidate Invites (2)')).toBeTruthy());
  });

  it('shows status badges for invites', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('Completed')).toBeTruthy();
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
      expect(screen.getByText('Remind')).toBeTruthy();
    });
  });

  it('shows Remind All Pending button when pending invites exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText(/Remind All Pending/)).toBeTruthy());
  });

  it('shows table headers', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Email')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
      expect(screen.getByText('Created')).toBeTruthy();
      expect(screen.getByText('Expires')).toBeTruthy();
      expect(screen.getByText('Actions')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('(no email)')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('(no email)')).toBeTruthy());
    expect(screen.queryByText('Remind')).toBeNull();
  });

  it('does not show Remind for completed invites', async () => {
    const completedOnly = [invites[1]]; // completed
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => completedOnly,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => expect(screen.getByText('bob@test.com')).toBeTruthy());
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
      expect(screen.getByText('\u2014')).toBeTruthy();
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
      expect(screen.getByText('Copied!')).toBeTruthy();
    });
  });

  it('sends remind request when Remind is clicked', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invites,
    } as Response);

    render(<InviteManagementTable assessmentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Remind')).toBeTruthy();
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
      expect(screen.getByText(/Remind All Pending/)).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('bob@test.com')).toBeTruthy());
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
      expect(screen.getByText('Remind All Pending (1)')).toBeTruthy();
    });
  });
});
