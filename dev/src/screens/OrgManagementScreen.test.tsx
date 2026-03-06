// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockReset = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } });

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: mockReset }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));
vi.mock('@/components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/Input', () => ({
  Input: ({ onChangeText, label, ...props }: any) => (
    <input aria-label={label} onChange={(e: any) => onChangeText?.(e.target.value)} {...props} />
  ),
}));
vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe',
  }),
}));
const mockShowToast = vi.fn();
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

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
  orgId: 'org1', orgName: 'Acme Corp', role: 'owner',
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
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    setupFetch();
  });

  it('renders loading state initially', () => {
    const { container } = render(<OrgManagementScreen />);
    expect(container.querySelector('svg') || container.textContent).toBeTruthy();
  });

  it('redirects to Login when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
    });
  });

  it('shows create org form when user has no organization', async () => {
    setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Create Your Team')).toBeTruthy();
      expect(screen.getByText(/Set up an organization/)).toBeTruthy();
      expect(screen.getByText('Create Organization')).toBeTruthy();
    });
  });

  it('creates organization when form is submitted', async () => {
    const fn = setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Create Organization')).toBeTruthy());
    const input = screen.getByDisplayValue('');
    fireEvent.change(input, { target: { value: 'New Org' } });
    fireEvent.click(screen.getByText('Create Organization'));
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
      expect(screen.getByText('Acme Corp')).toBeTruthy();
      expect(screen.getByText(/Active/)).toBeTruthy();
      expect(screen.getByText(/Monthly/)).toBeTruthy();
    });
  });

  it('shows Manage Billing button for active subscription', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Manage Billing')).toBeTruthy());
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
      expect(screen.getByText('Canceled')).toBeTruthy();
      expect(screen.getByText('Resubscribe')).toBeTruthy();
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
      expect(screen.getByText('Payment Past Due')).toBeTruthy();
      expect(screen.getByText('Update Payment')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('Subscribe')).toBeTruthy());
  });

  it('renders team members with roles', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Owner User')).toBeTruthy();
      expect(screen.getByText('Admin User')).toBeTruthy();
      expect(screen.getByText('member@acme.com')).toBeTruthy();
      expect(screen.getByText('OWNER')).toBeTruthy();
      expect(screen.getByText('ADMIN')).toBeTruthy();
      expect(screen.getByText('MEMBER')).toBeTruthy();
      expect(screen.getByText(/Team Members \(3\)/)).toBeTruthy();
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
      expect(screen.getByText('Demote')).toBeTruthy();
      // For regular member (u3): shows Make Admin and Remove
      expect(screen.getByText('Make Admin')).toBeTruthy();
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
      expect(screen.getByText('Organization Settings')).toBeTruthy();
      expect(screen.getByText('Save Settings')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeTruthy());
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
      expect(screen.getByText('Invite Team Member')).toBeTruthy();
      expect(screen.getByText('Send Invite')).toBeTruthy();
      expect(screen.getByText('Member')).toBeTruthy();
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Viewer')).toBeTruthy();
    });
  });

  it('sends invitation when invite form is submitted', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Send Invite')).toBeTruthy());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByText('Send Invite'));
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
    await waitFor(() => expect(screen.getByText('Send Invite')).toBeTruthy());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByText('Send Invite'));
    await waitFor(() => expect(screen.getByText('Invitation sent!')).toBeTruthy());
  });

  it('shows invite error when invitation fails', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': fail({ error: 'Already invited' }),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Send Invite')).toBeTruthy());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'dup@acme.com' } });
    fireEvent.click(screen.getByText('Send Invite'));
    await waitFor(() => expect(screen.getByText('Already invited')).toBeTruthy());
  });

  it('renders pending invitations when they exist', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok(mockInvitations),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeTruthy();
      expect(screen.getByText('invited@acme.com')).toBeTruthy();
      expect(screen.getByText('Revoke')).toBeTruthy();
    });
  });

  it('revokes invitation when Revoke is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok(mockInvitations),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Revoke')).toBeTruthy());
    fireEvent.click(screen.getByText('Revoke'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/invitations', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ invitationId: 'inv1' }),
      }));
    });
  });

  it('navigates back to Assessments when Back button is clicked', async () => {
    setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText(/Back to Assessments/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Back to Assessments/));
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('saves org settings when Save Settings is clicked', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeTruthy());
    fireEvent.click(screen.getByText('Save Settings'));
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
    await waitFor(() => expect(screen.getByText('Make Admin')).toBeTruthy());
    fireEvent.click(screen.getByText('Make Admin'));
    await waitFor(() => {
      expect(fn).toHaveBeenCalledWith('/api/orgs/org1/members', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ userId: 'u3', role: 'admin' }),
      }));
    });
  });

  it('calls handleChangeRole to demote admin when Demote is clicked (line 392)', async () => {
    const fn = setupFetch({
      '/api/orgs': ok([mockOrg]),
      '/api/orgs/org1/members': ok(mockMembers),
      '/api/orgs/org1/invitations': ok([]),
    });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Demote')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('Viewer')).toBeTruthy());
    fireEvent.click(screen.getByText('Viewer'));
    // Now send an invite to verify the role was changed
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'test@acme.com' } });
    fireEvent.click(screen.getByText('Send Invite'));
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
      expect(screen.getByText(/Renews/)).toBeTruthy();
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
      expect(screen.getByText(/Access until/)).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText('Send Invite')).toBeTruthy());
    const emailInput = screen.getByPlaceholderText('colleague@company.com');
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByText('Send Invite'));
    await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('Manage Billing')).toBeTruthy());
    fireEvent.click(screen.getByText('Manage Billing'));
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
    await waitFor(() => expect(screen.getByText('Update Payment')).toBeTruthy());
    fireEvent.click(screen.getByText('Update Payment'));
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
    await waitFor(() => expect(screen.getByText('Subscribe')).toBeTruthy());
    fireEvent.click(screen.getByText('Subscribe'));
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
    await waitFor(() => expect(screen.getByText('Resubscribe')).toBeTruthy());
    fireEvent.click(screen.getByText('Resubscribe'));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('handleSaveSettings catches fetch exception gracefully (line 133/140)', async () => {
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
    await waitFor(() => expect(screen.getByText('Save Settings')).toBeTruthy());
    fireEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeTruthy();
    });
  });

  it('handleCreateOrg does not submit when name is empty (line 114)', async () => {
    const fn = setupFetch({ '/api/orgs': ok([]) });
    render(<OrgManagementScreen />);
    await waitFor(() => expect(screen.getByText('Create Organization')).toBeTruthy());
    fireEvent.click(screen.getByText('Create Organization'));
    const postCalls = fn.mock.calls.filter((c: any) => c[1]?.method === 'POST');
    expect(postCalls.length).toBe(0);
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
      expect(screen.getByText(/Annual/)).toBeTruthy();
    });
  });
});
