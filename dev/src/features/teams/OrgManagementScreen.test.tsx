// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));

let mockAuthReturn = { user: { id: 'u1' } as any, loading: false };
vi.mock('@/shared/hooks/useAuthGuard', () => ({
  useAuthGuard: () => mockAuthReturn,
}));
vi.mock('@/shared/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
const mockShowToast = vi.fn();
vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (data: any) => ({ ok: false, json: () => Promise.resolve(data) });

function setupFetch(map: Record<string, any> = {}) {
  const entries = Object.entries(map).sort(([a], [b]) => b.length - a.length);
  const fn = vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of entries) {
      if (url.includes(pattern)) return Promise.resolve(response);
    }
    return Promise.resolve(ok([]));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const mockOrg = {
  id: 'org1', name: 'Acme Corp', logoUrl: 'https://acme.com/logo.png',
  domain: 'acme.com', assessmentCredits: 10, subscriptionStatus: 'active',
  subscriptionPlan: 'monthly', subscriptionEndsAt: '2026-06-01T00:00:00Z',
  role: 'owner',
};

const mockMembers = [
  { id: 'm1', userId: 'u1', role: 'owner', joinedAt: '2026-01-01', name: 'Owner User', email: 'owner@acme.com', avatarUrl: null },
  { id: 'm2', userId: 'u2', role: 'admin', joinedAt: '2026-01-02', name: 'Admin User', email: 'admin@acme.com', avatarUrl: null },
  { id: 'm3', userId: 'u3', role: 'member', joinedAt: '2026-01-03', name: null, email: 'member@acme.com', avatarUrl: null },
];

const mockInvitations = [
  { id: 'inv1', email: 'invited@acme.com', role: 'member', status: 'pending', expiresAt: '2026-04-01T00:00:00Z', createdAt: '2026-02-01' },
];

setupFetch();
const { OrgManagementScreen } = await import('./OrgManagementScreen');

describe('OrgManagementScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    setupFetch();
  });

  it('renders nothing while auth is loading', () => {
    mockAuthReturn = { user: null, loading: true };
    const { container } = render(<OrgManagementScreen />);
    expect(container.innerHTML).toBe('');
  });

  it('renders skeleton while data is loading', () => {
    mockAuthReturn = { user: { id: 'u1' }, loading: false };
    // No fetch responses set up, so dataLoading stays true
    const { container } = render(<OrgManagementScreen />);
    expect(container.querySelector('[data-testid="skeleton-table"]')).toBeInTheDocument();
  });

  it('renders nothing when user is not authenticated', () => {
    mockAuthReturn = { user: null, loading: false };
    const { container } = render(<OrgManagementScreen />);
    // useAuthGuard handles redirect; component renders null for no user
    expect(container.innerHTML).toBe('');
  });

  it('shows create org form when user has no organization', async () => {
    setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Create Your Team')).toBeInTheDocument();
      expect(screen.getByText(/Set up an organization/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
    });
  });

  it('creates organization when form is submitted', async () => {
    const fn = setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument());
    const input = screen.getByDisplayValue('');
    fireEvent.change(input, { target: { value: 'New Org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Org' }),
      }));
    });
  });

  it('renders org name and subscription status when org exists', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText(/Active/)).toBeInTheDocument();
      expect(screen.getByText(/Monthly/)).toBeInTheDocument();
    });
  });

  it('shows Manage Billing button for active subscription', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument());
  });

  it('shows Resubscribe button for canceled subscription', async () => {
    const canceledOrg = { ...mockOrg, subscriptionStatus: 'canceled', subscriptionEndsAt: '2026-06-01T00:00:00Z' };
    setupFetch({
      '/api/orgs': ok([canceledOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Canceled')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeInTheDocument();
    });
  });

  it('shows Update Payment button for past_due subscription', async () => {
    const pastDueOrg = { ...mockOrg, subscriptionStatus: 'past_due' };
    setupFetch({
      '/api/orgs': ok([pastDueOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Payment Past Due')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update Payment' })).toBeInTheDocument();
    });
  });

  it('shows Subscribe button when no active subscription', async () => {
    const noSubOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([noSubOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument());
  });

  it('renders team members with roles', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Owner User')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('member@acme.com')).toBeInTheDocument();
      expect(screen.getByText('OWNER')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('MEMBER')).toBeInTheDocument();
      expect(screen.getByText(/Team Members \(3\)/)).toBeInTheDocument();
    });
  });

  it('shows member management actions for admin (Make Admin, Demote, Remove)', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      // For admin member (u2): shows Demote and Remove
      expect(screen.getByText('Demote')).toBeInTheDocument();
      // For regular member (u3): shows Make Admin and Remove
      expect(screen.getByText('Make Admin')).toBeInTheDocument();
      // Remove should exist for non-owner members
      expect(screen.getAllByText('Remove').length).toBe(2);
    });
  });

  it('shows Organization Settings section for admin users', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Organization Settings')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
    });
  });

  it('hides settings and invite sections for viewer role', async () => {
    const viewerOrg = { ...mockOrg, role: 'viewer' };
    setupFetch({
      '/api/orgs': ok([viewerOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.queryByText('Organization Settings')).toBeNull();
    expect(screen.queryByText('Invite Team Member')).toBeNull();
  });

  it('renders invite team member form for admin', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument();
      expect(screen.getByText('Member')).toBeInTheDocument();
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });
  });

  it('sends invitation when invite form is submitted', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/invitations', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'new@acme.com', role: 'member' }),
      }));
    });
  });

  it('shows invite success message after successful invitation', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => expect(screen.getByText('Invitation sent!')).toBeInTheDocument());
  });

  it('shows invite error when invitation fails', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': fail({ error: 'Already invited' }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'dup@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => expect(screen.getByText('Already invited')).toBeInTheDocument());
  });

  it('renders pending invitations when they exist', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok(mockInvitations),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
      expect(screen.getByText('invited@acme.com')).toBeInTheDocument();
      expect(screen.getByText('Revoke')).toBeInTheDocument();
    });
  });

  it('revokes invitation when Revoke is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok(mockInvitations),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Revoke')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Revoke'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/invitations', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ invitationId: 'inv1' }),
      }));
    });
  });

  it('saves org settings when Save Settings is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1', expect.objectContaining({ method: 'PUT' }));
    });
  });

  it('calls handleChangeRole when Make Admin is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Make Admin')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Make Admin'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/members', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ userId: 'u3', role: 'admin' }),
      }));
    });
  });

  it('demotes admin to member when Demote button is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Demote')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Demote'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/members', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ userId: 'u2', role: 'member' }),
      }));
    });
  });

  it('calls handleRemoveMember when Remove is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getAllByText('Remove').length).toBe(2));
    // Click the first Remove (admin user u2)
    fireEvent.click(screen.getAllByText('Remove')[0]);
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/members', expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });

  it('selects invite role when role option is clicked', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Viewer')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Viewer'));
    // Now send an invite to verify the role was changed
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'test@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => {
      const calls = (globalThis.fetch as any).mock.calls;
      const inviteCall = calls.find((c: any) => c[0]?.includes('/invitations') && c[1]?.method === 'POST');
      expect(inviteCall).toBeTruthy();
      expect(JSON.parse(inviteCall[1].body)).toEqual({ email: 'test@acme.com', role: 'viewer' });
    });
  });

  it('shows renewal date for active subscription', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Renews/)).toBeInTheDocument();
    });
  });

  it('shows access until date for canceled subscription with future end date', async () => {
    const canceledOrg = { ...mockOrg, subscriptionStatus: 'canceled', subscriptionEndsAt: '2030-06-01T00:00:00Z' };
    setupFetch({
      '/api/orgs': ok([canceledOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Access until/)).toBeInTheDocument();
    });
  });

  it('shows Network error when invite fetch throws', async () => {
    // Set up initial fetch that works, then make the POST /invitations throw
    const fn = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/orgs') && !url.includes('/members') && !url.includes('/invitations') && (!opts || opts.method !== 'POST')) {
        return Promise.resolve(ok([mockOrg]));
      }
      if (url.includes('/members')) return Promise.resolve(ok(mockMembers));
      if (url.includes('/invitations') && opts?.method === 'POST') {
        return Promise.reject(new Error('Network failure'));
      }
      if (url.includes('/invitations')) return Promise.resolve(ok([]));
      return Promise.resolve(ok([]));
    });
    vi.stubGlobal('fetch', fn);
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeInTheDocument());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('opens billing portal when Manage Billing is clicked for active subscription', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/billing/portal': ok({ url: 'https://billing.stripe.com/portal' }),
    });
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => {
      expect(window.location.href).toBe('https://billing.stripe.com/portal');
    });
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('opens billing portal when Update Payment is clicked for past_due subscription', async () => {
    const pastDueOrg = { ...mockOrg, subscriptionStatus: 'past_due' };
    setupFetch({
      '/api/orgs': ok([pastDueOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/billing/portal': ok({ url: 'https://billing.stripe.com/portal' }),
    });
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Payment' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => {
      expect(window.location.href).toBe('https://billing.stripe.com/portal');
    });
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('navigates to Teams when Subscribe is clicked for no-sub org', async () => {
    const noSubOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([noSubOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('navigates to Teams when Resubscribe is clicked for canceled subscription', async () => {
    const canceledOrg = { ...mockOrg, subscriptionStatus: 'canceled', subscriptionEndsAt: '2030-06-01T00:00:00Z' };
    setupFetch({
      '/api/orgs': ok([canceledOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Resubscribe' }));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('handles save settings network failure gracefully', async () => {
    const fn = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'PUT') {
        return Promise.reject(new Error('Network failure'));
      }
      if (url.includes('/api/orgs') && !url.includes('/members') && !url.includes('/invitations')) {
        return Promise.resolve(ok([mockOrg]));
      }
      if (url.includes('/members')) return Promise.resolve(ok(mockMembers));
      if (url.includes('/invitations')) return Promise.resolve(ok([]));
      return Promise.resolve(ok([]));
    });
    vi.stubGlobal('fetch', fn);
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
    });
  });

  it('prevents org creation when name field is empty', async () => {
    const fn = setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));
    const postCalls = fn.mock.calls.filter((c: any) => c[1]?.method === 'POST');
    expect(postCalls.length).toBe(0);
  });

  it('shows active trial badge with days remaining and usage stats', async () => {
    const trialOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([trialOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/trial/status': ok({
        trial: {
          isActive: true, daysRemaining: 14,
          assessmentsUsed: 1, assessmentsLimit: 3,
          invitesUsed: 2, invitesLimit: 5,
        },
      }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Free Trial/)).toBeInTheDocument();
      expect(screen.getByText(/14 days left/)).toBeInTheDocument();
      expect(screen.getByText(/1\/3 assessments/)).toBeInTheDocument();
      expect(screen.getByText(/2\/5 invites/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    });
  });

  it('navigates to Hiring when Subscribe is clicked during active trial', async () => {
    const trialOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([trialOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/trial/status': ok({
        trial: {
          isActive: true, daysRemaining: 14,
          assessmentsUsed: 0, assessmentsLimit: 3,
          invitesUsed: 0, invitesLimit: 5,
        },
      }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('shows Trial Expired badge and Subscribe button for expired trial', async () => {
    const trialOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([trialOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/trial/status': ok({
        trial: {
          isActive: false, daysRemaining: 0,
          assessmentsUsed: 1, assessmentsLimit: 1,
          invitesUsed: 3, invitesLimit: 3,
        },
      }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Trial Expired')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    });
  });

  it('navigates to Hiring when Subscribe is clicked for expired trial', async () => {
    const trialOrg = { ...mockOrg, subscriptionStatus: 'none' };
    setupFetch({
      '/api/orgs': ok([trialOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/trial/status': ok({
        trial: {
          isActive: false, daysRemaining: 0,
          assessmentsUsed: 1, assessmentsLimit: 1,
          invitesUsed: 3, invitesLimit: 3,
        },
      }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('shows toast when billing portal returns error instead of URL', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/billing/portal': ok({ error: 'No subscription' }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('No subscription', 'error');
    });
  });

  it('shows toast when billing portal fetch throws', async () => {
    const fn = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/billing/portal') && opts?.method === 'POST') {
        return Promise.reject(new Error('Network'));
      }
      if (url.includes('/api/orgs') && !url.includes('/members') && !url.includes('/invitations')) {
        return Promise.resolve(ok([mockOrg]));
      }
      if (url.includes('/members')) return Promise.resolve(ok(mockMembers));
      if (url.includes('/invitations')) return Promise.resolve(ok([]));
      return Promise.resolve(ok([]));
    });
    vi.stubGlobal('fetch', fn);
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to open billing portal', 'error');
    });
  });

  it('shows toast when past_due billing portal fetch throws', async () => {
    const pastDueOrg = { ...mockOrg, subscriptionStatus: 'past_due' };
    const fn = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/billing/portal') && opts?.method === 'POST') {
        return Promise.reject(new Error('Network'));
      }
      if (url.includes('/api/orgs') && !url.includes('/members') && !url.includes('/invitations')) {
        return Promise.resolve(ok([pastDueOrg]));
      }
      if (url.includes('/members')) return Promise.resolve(ok(mockMembers));
      if (url.includes('/invitations')) return Promise.resolve(ok([]));
      return Promise.resolve(ok([]));
    });
    vi.stubGlobal('fetch', fn);
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Payment' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Failed to open billing portal', 'error');
    });
  });

  it('shows toast when past_due billing portal returns error', async () => {
    const pastDueOrg = { ...mockOrg, subscriptionStatus: 'past_due' };
    setupFetch({
      '/api/orgs': ok([pastDueOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
      '/api/billing/portal': ok({ error: 'Billing error' }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Payment' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Billing error', 'error');
    });
  });

  it('shows create org form when orgs API returns error', async () => {
    setupFetch({ '/api/orgs': fail({ error: 'Server error' }) });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      // When fetchOrg returns early on !res.ok, org stays null, shows create form
      expect(screen.getByText('Create Your Team')).toBeInTheDocument();
    });
  });

  it('handles create org network failure gracefully', async () => {
    const fn = vi.fn().mockImplementation((_url: string, opts?: any) => {
      if (opts?.method === 'POST') return Promise.reject(new Error('Network'));
      return Promise.resolve(ok([]));
    });
    vi.stubGlobal('fetch', fn);
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument());
    const input = screen.getByDisplayValue('');
    fireEvent.change(input, { target: { value: 'Test Org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));
    // Should not crash
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
    });
  });

  it('shows Team AI Fluency section with avg AFI and top performers when members have AFI scores', async () => {
    const membersWithAfi = [
      { id: 'm1', userId: 'u1', role: 'owner', joinedAt: '2026-01-01', name: 'Owner User', email: 'owner@acme.com', avatarUrl: null, afiScore: 700, afiTier: 'exceptional' },
      { id: 'm2', userId: 'u2', role: 'admin', joinedAt: '2026-01-02', name: null, email: 'admin@acme.com', avatarUrl: null, afiScore: 500, afiTier: null },
      { id: 'm3', userId: 'u3', role: 'member', joinedAt: '2026-01-03', name: null, email: 'member@acme.com', avatarUrl: null, afiScore: 0, afiTier: null },
    ];
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(membersWithAfi),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Team AI Fluency')).toBeInTheDocument();
    });
    // Avg AFI of members with score > 0: (700+500)/2 = 600
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('Team Average AFI')).toBeInTheDocument();
    expect(screen.getByText('Top Performers')).toBeInTheDocument();
    // 2 of 3 members scored
    expect(screen.getByText('2 of 3 members scored')).toBeInTheDocument();
    // Top performers list (names appear in members table AND top performers)
    expect(screen.getAllByText('Owner User').length).toBeGreaterThanOrEqual(2);
    // Admin User has null name, so falls back to email in top performers
    expect(screen.getAllByText('admin@acme.com').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('700')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('shows "no AFI scores yet" message when all members have zero AFI', async () => {
    const membersNoAfi = [
      { id: 'm1', userId: 'u1', role: 'owner', joinedAt: '2026-01-01', name: 'Owner User', email: 'owner@acme.com', avatarUrl: null, afiScore: 0, afiTier: null },
      { id: 'm2', userId: 'u2', role: 'admin', joinedAt: '2026-01-02', name: 'Admin User', email: 'admin@acme.com', avatarUrl: null },
    ];
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(membersNoAfi),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Team AI Fluency')).toBeInTheDocument();
    });
    expect(screen.getByText(/No team members have AFI scores yet/)).toBeInTheDocument();
  });

  it('shows annual plan label for active annual subscription', async () => {
    const annualOrg = { ...mockOrg, subscriptionPlan: 'annual' };
    setupFetch({
      '/api/orgs': ok([annualOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Annual/)).toBeInTheDocument();
    });
  });

  it('renders fallback border color for unknown member roles', async () => {
    const unknownRoleMembers = [
      { id: 'm1', userId: 'u1', role: 'owner', joinedAt: '2026-01-01', name: 'Owner User', email: 'owner@acme.com', avatarUrl: null },
      { id: 'm4', userId: 'u4', role: 'custom_role', joinedAt: '2026-01-04', name: 'Custom User', email: 'custom@acme.com', avatarUrl: null },
    ];
    const unknownRoleInvites = [
      { id: 'inv2', email: 'unknown@acme.com', role: 'custom_role', status: 'pending', expiresAt: '2026-04-01T00:00:00Z', createdAt: '2026-02-01' },
    ];
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(unknownRoleMembers),
      '/api/orgs/org1/invitations': ok(unknownRoleInvites),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('custom@acme.com')).toBeInTheDocument();
    });
  });
});
