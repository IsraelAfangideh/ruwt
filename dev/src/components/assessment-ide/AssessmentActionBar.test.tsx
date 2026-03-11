// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/theme', () => ({
  useColors: () => ({
    bg: '#fff', text: '#000', textMuted: '#888', accent: '#c9a962', border: '#ccc',
    borderStrong: '#999', card: '#fff', muted: '#f5f5f5', error: '#f00', errorBg: '#fee',
    success: '#0a0', successBg: '#efe', primary: '#000', primaryForeground: '#fff',
    secondary: '#eee', secondaryForeground: '#000', destructive: '#f00',
    textSubtle: '#aaa', bgElevated: '#fafafa', accentBg: '#ffe', bgWarm: '#faf8f5',
  }),
}));
vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

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
    expect(screen.getByText('Save Draft')).toBeTruthy();
  });

  it('shows Saving... text when saving', () => {
    render(<AssessmentActionBar {...baseProps} saving={true} />);
    expect(screen.getByText('Saving...')).toBeTruthy();
  });

  it('shows Saved text on save success', () => {
    render(<AssessmentActionBar {...baseProps} saveSuccess={true} />);
    expect(screen.getByText('\u2713 Saved')).toBeTruthy();
  });

  it('shows Error text on save error', () => {
    render(<AssessmentActionBar {...baseProps} saveError="Something went wrong" />);
    expect(screen.getByText('\u2717 Error')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('disables Save Draft when title is empty', () => {
    render(<AssessmentActionBar {...baseProps} title="" />);
    const btn = screen.getByText('Save Draft');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('does not show "Title required" in action bar (moved to document panel)', () => {
    render(<AssessmentActionBar {...baseProps} title="" />);
    expect(screen.queryByText('Title required')).toBeNull();
  });

  it('disables Save Draft when weightSum is not 100', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={80} />);
    const btn = screen.getByText('Save Draft');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('shows "Weights must = 100" when weights are wrong and title exists', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={80} />);
    expect(screen.getByText('Weights must = 100')).toBeTruthy();
  });

  it('disables Save Draft when weightSum is NaN', () => {
    render(<AssessmentActionBar {...baseProps} weightSum={NaN} />);
    const btn = screen.getByText('Save Draft');
    expect(btn.closest('button')?.disabled).toBe(true);
  });

  it('calls onSave when Save Draft is clicked', () => {
    const onSave = vi.fn();
    render(<AssessmentActionBar {...baseProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save Draft'));
    expect(onSave).toHaveBeenCalled();
  });

  it('shows Activate button for draft with assessmentId', () => {
    render(<AssessmentActionBar {...baseProps} />);
    expect(screen.getByText('Activate')).toBeTruthy();
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
    fireEvent.click(screen.getByText('Activate'));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(true);
  });

  it('shows Confirm Activate and Cancel when confirmActivate is true', () => {
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} />);
    expect(screen.getByText('Confirm Activate')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onActivate and resets confirm on Confirm Activate click', () => {
    const onActivate = vi.fn();
    const onSetConfirmActivate = vi.fn();
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} onActivate={onActivate} onSetConfirmActivate={onSetConfirmActivate} />);
    fireEvent.click(screen.getByText('Confirm Activate'));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(false);
    expect(onActivate).toHaveBeenCalled();
  });

  it('cancels confirm on Cancel click', () => {
    const onSetConfirmActivate = vi.fn();
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} onSetConfirmActivate={onSetConfirmActivate} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSetConfirmActivate).toHaveBeenCalledWith(false);
  });

  it('shows Activating... when activating', () => {
    render(<AssessmentActionBar {...baseProps} confirmActivate={true} activating={true} />);
    expect(screen.getByText('Activating...')).toBeTruthy();
  });

  it('shows activateError when present', () => {
    render(<AssessmentActionBar {...baseProps} activateError="Activation failed" />);
    expect(screen.getByText('Activation failed')).toBeTruthy();
  });

  it('shows inviteError when present', () => {
    render(<AssessmentActionBar {...baseProps} inviteError="Invite generation failed" />);
    expect(screen.getByText('Invite generation failed')).toBeTruthy();
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
