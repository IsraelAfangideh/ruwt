// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, testID, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} data-testid={testID} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children, ...p }: any) => <div {...p}>{children}</div>,
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, value, testID }: any) => (
    <input
      aria-label={label}
      value={value}
      data-testid={testID}
      onChange={(e: any) => onChangeText?.(e.target.value)}
    />
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { HiringManagersScreen } = await import('./HiringManagersScreen');

const ok = (data: any) => ({ ok: true, json: () => Promise.resolve(data) });
const fail = (status: number, data: any) => ({
  ok: false, status, json: () => Promise.resolve(data),
});

describe('HiringManagersScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(ok({ ok: true, id: 'lead-1' }))));
  });

  it('renders the Cluely-framed hero', () => {
    render(<HiringManagersScreen />);
    expect(screen.getByText(/passing your screen with AI/)).toBeInTheDocument();
  });

  it('renders the For Hiring Managers badge', () => {
    render(<HiringManagersScreen />);
    expect(screen.getByText('For Hiring Managers')).toBeInTheDocument();
  });

  it('renders the four AI-fluency metrics', () => {
    render(<HiringManagersScreen />);
    expect(screen.getByText('Model selection')).toBeInTheDocument();
    expect(screen.getByText('Prompt efficiency')).toBeInTheDocument();
    expect(screen.getByText('Debugging behavior')).toBeInTheDocument();
    expect(screen.getByText('Cost per solve')).toBeInTheDocument();
  });

  it('shows the default ROI calculation', () => {
    render(<HiringManagersScreen />);
    // 150 * 12 * 20 = 36,000
    expect(screen.getByTestId('roi-annual-cost').textContent).toMatch(/\$36,000/);
  });

  it('updates the ROI when inputs change', () => {
    render(<HiringManagersScreen />);
    fireEvent.click(screen.getByTestId('roi-inc-Engineers hired per year'));
    // 150 * 12 * 21 = 37,800
    expect(screen.getByTestId('roi-annual-cost').textContent).toMatch(/\$37,800/);

    fireEvent.click(screen.getByTestId('roi-dec-Engineers hired per year'));
    fireEvent.click(screen.getByTestId('roi-dec-Hours wasted per false-positive hire'));
    // 150 * 11 * 20 = 33,000
    expect(screen.getByTestId('roi-annual-cost').textContent).toMatch(/\$33,000/);
  });

  it('clamps ROI inputs at the configured min', () => {
    render(<HiringManagersScreen />);
    const dec = screen.getByTestId('roi-dec-Engineers hired per year');
    for (let i = 0; i < 50; i++) fireEvent.click(dec);
    // hires bottoms out at 1: 150 * 12 * 1 = 1,800
    expect(screen.getByTestId('roi-annual-cost').textContent).toMatch(/\$1,800/);
  });

  it('disables the pilot submit until an email is entered', () => {
    render(<HiringManagersScreen />);
    const submit = screen.getByTestId('pilot-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('pilot-email'), { target: { value: 'cto@acme.io' } });
    expect(submit.disabled).toBe(false);
  });

  it('submits the pilot form and shows success state', async () => {
    render(<HiringManagersScreen />);
    fireEvent.change(screen.getByTestId('pilot-email'), { target: { value: 'cto@acme.io' } });
    fireEvent.change(screen.getByTestId('pilot-company'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByTestId('pilot-submit'));
    await waitFor(() => {
      expect(screen.getByText(/We'll email you within 24 hours/)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/leads/pilot',
      expect.objectContaining({ method: 'POST' }),
    );
    const payload = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(payload.email).toBe('cto@acme.io');
    expect(payload.company).toBe('Acme');
  });

  it('shows the server error when submission fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(400, { error: 'Please use your work email' })));
    render(<HiringManagersScreen />);
    fireEvent.change(screen.getByTestId('pilot-email'), { target: { value: 'cto@gmail.com' } });
    fireEvent.click(screen.getByTestId('pilot-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('pilot-error').textContent).toMatch(/work email/i);
    });
  });

  it('shows network-error fallback when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    render(<HiringManagersScreen />);
    fireEvent.change(screen.getByTestId('pilot-email'), { target: { value: 'cto@acme.io' } });
    fireEvent.click(screen.getByTestId('pilot-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('pilot-error').textContent).toMatch(/network/i);
    });
  });

  it('navigates to Hiring page when "See Pricing" CTA clicked', () => {
    render(<HiringManagersScreen />);
    fireEvent.click(screen.getByText('See Pricing'));
    expect(mockNavigate).toHaveBeenCalledWith('Hiring');
  });

  it('navigates to Register when "Run a Free Pilot" clicked', () => {
    render(<HiringManagersScreen />);
    fireEvent.click(screen.getByText('Run a Free Pilot'));
    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });
});
