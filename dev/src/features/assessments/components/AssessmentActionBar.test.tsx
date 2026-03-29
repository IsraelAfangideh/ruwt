// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AssessmentActionBar } = await import('./AssessmentActionBar');

const baseProps = {
  assessmentId: 'a1' as string | undefined,
  status: 'draft',
  title: 'My Assessment',
  saving: false,
  saveSuccess: false,
  saveError: null as string | null,
  activating: false,
  activateError: null as string | null,
  confirmActivate: false,
  weightSum: 100,
  inviteError: null as string | null,
  onSave: vi.fn(),
  onActivate: vi.fn(),
  onSetConfirmActivate: vi.fn(),
};

describe('AssessmentActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Save Draft button', () => {
    render(<AssessmentActionBar {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
  });

  it('shows Saving... text when saving', () => {
    render(<AssessmentActionBar {...baseProps} saving={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows Saved text on save success', () => {
    render(<AssessmentActionBar {...baseProps} saveSuccess={true} />);
    expect(screen.getByText('\u2713 Saved')).toBeInTheDocument();
  });

  it('shows Error text on save error', () => {
    render(<AssessmentActionBar {...baseProps} saveError="Something went wrong" />);
    expect(screen.getByText('\u2717 Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('disables Save Draft when title is empty', () => {
    render(<AssessmentActionBar {...baseProps} title="" />);
    const btn = screen.getByRole('button', { name: 'Save Draft' });
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('does not show "Title required" in action bar (moved to document panel)', () => {
    render(<AssessmentActionBar {...baseProps} title="" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('disables Save Draft when weightSum is not 100', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={80} />);
    const btn = screen.getByRole('button', { name: 'Save Draft' });
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('shows "Weights must = 100" when weights are wrong and title exists', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={80} />);
    expect(screen.getByText('Weights must = 100')).toBeInTheDocument();
  });

  it('disables Save Draft when weightSum is NaN', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={NaN} />);
    const btn = screen.getByRole('button', { name: 'Save Draft' });
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('calls onSave when Save Draft is clicked', () => {
    const onSave = vi.fn();
    render(<AssessmentActionBar {...baseProps} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows Activate button for draft with assessmentId', () => {
    render(<AssessmentActionBar {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('does not show Activate button when no assessmentId', () => {
    render(<AssessmentActionBar {...baseProps} assessmentId={undefined} />);
    expect(screen.queryByText('Activate')).toBeNull();
  });

  it('does not show Activate button when status is active', () => {
    render(<AssessmentActionBar {...baseProps} status="active" />);
    expect(screen.queryByText('Activate')).toBeNull();
  });

  it('sets confirmActivate on Activate click', () => {
    const onSetConfirmActivate = vi.fn();
    render(<AssessmentActionBar {...baseProps} onSetConfirmActivate={onSetConfirmActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(true);
  });

  it('shows Confirm Activate and Cancel when confirmActivate is true', () => {
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} />);
    expect(screen.getByRole('button', { name: 'Confirm Activate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onActivate and resets confirm on Confirm Activate click', () => {
    const onActivate = vi.fn();
    const onSetConfirmActivate = vi.fn();
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} onActivate={onActivate} onSetConfirmActivate={onSetConfirmActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Activate' }));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(false);
    expect(onActivate).toHaveBeenCalled();
  });

  it('cancels confirm on Cancel click', () => {
    const onSetConfirmActivate = vi.fn();
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} onSetConfirmActivate={onSetConfirmActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(false);
  });

  it('shows Activating... when activating', () => {
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} activating={true} />);
    expect(screen.getByText('Activating...')).toBeInTheDocument();
  });

  it('shows activateError when present', () => {
    render(<AssessmentActionBar {...baseProps} activateError="Activation failed" />);
    expect(screen.getByText('Activation failed')).toBeInTheDocument();
  });

  it('shows inviteError when present', () => {
    render(<AssessmentActionBar {...baseProps} inviteError="Invite generation failed" />);
    expect(screen.getByText('Invite generation failed')).toBeInTheDocument();
  });

  it('does not show validation message when saving', () => {
    render(<AssessmentActionBar {...baseProps} saving={true} title="" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('does not show validation message on save success', () => {
    render(<AssessmentActionBar {...baseProps} saveSuccess={true} title="" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('does not show validation message on save error', () => {
    render(<AssessmentActionBar {...baseProps} saveError="err" title="" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });
});
