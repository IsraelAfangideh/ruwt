// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrialBanner, type TrialInfo } from './TrialBanner';

const mockNavigate = vi.fn();

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962',
    border: '#ccc', destructive: '#b06060',
  }),
}));

const activeTrial: TrialInfo = {
  isActive: true,
  daysRemaining: 20,
  assessmentsUsed: 0,
  assessmentsLimit: 1,
  invitesUsed: 1,
  invitesLimit: 3,
};

describe('TrialBanner', () => {
  it('renders active trial with days remaining and counters', () => {
    render(<TrialBanner trial={activeTrial} />);

    expect(screen.getByText(/20 days remaining/)).toBeTruthy();
    expect(screen.getByText('0/1 assessments')).toBeTruthy();
    expect(screen.getByText('1/3 invites')).toBeTruthy();
    expect(screen.getByText('Subscribe')).toBeTruthy();
  });

  it('renders singular "day" for 1 day remaining', () => {
    render(<TrialBanner trial={{ ...activeTrial, daysRemaining: 1 }} />);

    expect(screen.getByText(/1 day remaining/)).toBeTruthy();
  });

  it('renders expired state', () => {
    const expiredTrial: TrialInfo = {
      ...activeTrial,
      isActive: false,
      daysRemaining: 0,
    };

    render(<TrialBanner trial={expiredTrial} />);

    expect(screen.getByText(/Trial expired/)).toBeTruthy();
  });

  it('does not render when subscription is active', () => {
    const { container } = render(
      <TrialBanner trial={activeTrial} subscriptionStatus="active" />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('navigates to Teams on Subscribe click', () => {
    render(<TrialBanner trial={activeTrial} />);

    fireEvent.click(screen.getByText('Subscribe'));

    expect(mockNavigate).toHaveBeenCalledWith('Teams');
  });

  it('shows warning styling when 7 or fewer days remain', () => {
    render(<TrialBanner trial={{ ...activeTrial, daysRemaining: 5 }} />);

    expect(screen.getByText(/5 days remaining/)).toBeTruthy();
  });

  it('shows assessments at limit in different color', () => {
    render(
      <TrialBanner
        trial={{ ...activeTrial, assessmentsUsed: 1 }}
      />,
    );

    expect(screen.getByText('1/1 assessments')).toBeTruthy();
  });

  it('shows invites at limit in different color', () => {
    render(
      <TrialBanner
        trial={{ ...activeTrial, invitesUsed: 3 }}
      />,
    );

    expect(screen.getByText('3/3 invites')).toBeTruthy();
  });
});
