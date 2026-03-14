// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
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

const { AssessmentIDEHeader } = await import('./AssessmentIDEHeader');

describe('AssessmentIDEHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders the given title', () => {
    render(
      <AssessmentIDEHeader title="My Assessment" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('My Assessment')).toBeTruthy();
  });

  it('shows "Edit Assessment" when title is empty and isEditing is true', () => {
    render(
      <AssessmentIDEHeader title="" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('Edit Assessment')).toBeTruthy();
  });

  it('shows "New Assessment" when title is empty and isEditing is false', () => {
    render(
      <AssessmentIDEHeader title="" assessmentId={undefined} status="draft" isEditing={false} dirty={false} />
    );
    expect(screen.getByText('New Assessment')).toBeTruthy();
  });

  it('shows DRAFT badge when status is draft and assessmentId exists', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('DRAFT')).toBeTruthy();
  });

  it('shows ACTIVE badge when status is active and assessmentId exists', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="active" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('does not show badge when assessmentId is undefined', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId={undefined} status="draft" isEditing={false} dirty={false} />
    );
    expect(screen.queryByText('DRAFT')).toBeNull();
    expect(screen.queryByText('ACTIVE')).toBeNull();
  });

  it('shows View Results button when status is active', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="active" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('View Results')).toBeTruthy();
  });

  it('does not show View Results button when status is draft', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.queryByText('View Results')).toBeNull();
  });

  it('navigates to AssessmentResultsDashboard when clicking View Results', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="active" isEditing={true} dirty={false} />
    );
    fireEvent.click(screen.getByText('View Results'));
    expect(mockNavigate).toHaveBeenCalledWith('AssessmentResultsDashboard', { assessmentId: 'a1' });
  });

  it('navigates back when clicking back button without dirty', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    fireEvent.click(screen.getByLabelText('Back to Assessments'));
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('shows confirm dialog when dirty and navigates on confirm', () => {
    const confirmFn = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmFn);
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={true} />
    );
    fireEvent.click(screen.getByLabelText('Back to Assessments'));
    expect(confirmFn).toHaveBeenCalledWith('You have unsaved changes. Leave anyway?');
    expect(mockNavigate).toHaveBeenCalledWith('Assessments');
  });

  it('does not navigate when dirty and confirm is canceled', () => {
    const confirmFn = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmFn);
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={true} />
    );
    fireEvent.click(screen.getByLabelText('Back to Assessments'));
    expect(confirmFn).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the back button arrow', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId={undefined} status="draft" isEditing={false} dirty={false} />
    );
    expect(screen.getByText('\u2190')).toBeTruthy();
  });
});
