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
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    expect(screen.getByText('My Assessment')).toBeInTheDocument();
  });

  it('shows "Edit Assessment" when title is empty and isEditing is true', () => {
    render(
      <AssessmentIDEHeader title="" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('Edit Assessment')).toBeInTheDocument();
  });

  it('shows "New Assessment" when title is empty and isEditing is false', () => {
    render(
      <AssessmentIDEHeader title="" assessmentId={undefined} status="draft" isEditing={false} dirty={false} />
    );
    expect(screen.getByText('New Assessment')).toBeInTheDocument();
  });

  it('shows DRAFT badge when status is draft and assessmentId exists', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="draft" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('shows ACTIVE badge when status is active and assessmentId exists', () => {
    render(
      <AssessmentIDEHeader title="T" assessmentId="a1" status="active" isEditing={true} dirty={false} />
    );
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
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
    expect(screen.getByText('View Results')).toBeInTheDocument();
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
    expect(screen.getByText('\u2190')).toBeInTheDocument();
  });
});
