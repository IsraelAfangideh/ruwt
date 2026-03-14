// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, label, placeholder, value, ...props }: any) => (
    <input
      aria-label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e: any) => onChangeText?.(e.target.value)}
      {...props}
    />
  ),
}));
vi.mock('@/features/assessments/PassThresholdEditor', () => ({
  PassThresholdEditor: ({ value }: any) => (
    <div data-testid="pass-threshold">
      <span>{value ? 'Threshold set' : 'No threshold'}</span>
    </div>
  ),
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

const { AssessmentAdvancedSection } = await import('./AssessmentAdvancedSection');

const baseProps = {
  companyName: '',
  companyLogoUrl: '',
  welcomeMessage: '',
  onCompanyNameChange: vi.fn(),
  onCompanyLogoUrlChange: vi.fn(),
  onWelcomeMessageChange: vi.fn(),
  weights: { modelSelection: '20', promptEfficiency: '20', debugging: '20', strategy: '20', speed: '20' },
  weightSum: 100,
  onWeightsChange: vi.fn(),
  passThreshold: null,
  onPassThresholdChange: vi.fn(),
  timeLimitMinutes: '60',
  onTimeLimitChange: vi.fn(),
};

describe('AssessmentAdvancedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed by default', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    expect(screen.getByText(/Advanced Settings/)).toBeTruthy();
    // Content should not be visible
    expect(screen.queryByText('Score Weights')).toBeNull();
  });

  it('has correct accessibility label when collapsed', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    expect(screen.getByLabelText('Expand advanced settings')).toBeTruthy();
  });

  it('expands on click', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Score Weights')).toBeTruthy();
    expect(screen.getByText('Company Branding (optional)')).toBeTruthy();
  });

  it('has correct accessibility label when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Collapse advanced settings')).toBeTruthy();
  });

  it('collapses on second click', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Score Weights')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Collapse advanced settings'));
    expect(screen.queryByText('Score Weights')).toBeNull();
  });

  it('renders time limit input when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Time Limit (minutes)')).toBeTruthy();
  });

  it('calls onTimeLimitChange when time limit input changes', () => {
    const onTimeLimitChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onTimeLimitChange={onTimeLimitChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    fireEvent.change(screen.getByLabelText('Time Limit (minutes)'), { target: { value: '120' } });
    expect(onTimeLimitChange).toHaveBeenCalledWith('120');
  });

  it('shows time limit validation hint', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeTruthy();
  });

  it('shows invalid time limit message when below minimum', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="3" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum is 5 minutes')).toBeTruthy();
  });

  it('shows invalid time limit message when above maximum', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="300" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Maximum is 240 minutes')).toBeTruthy();
  });

  it('shows invalid time limit message when non-numeric', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="abc" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Enter a number')).toBeTruthy();
  });

  it('renders all weight fields when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Model Selection')).toBeTruthy();
    expect(screen.getByText('Prompt Efficiency')).toBeTruthy();
    expect(screen.getByText('Debugging')).toBeTruthy();
    expect(screen.getByText('Strategy')).toBeTruthy();
    expect(screen.getByText('Speed')).toBeTruthy();
  });

  it('shows weight sum as 100/100 when correct', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={100} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('100/100')).toBeTruthy();
  });

  it('shows weight sum warning when not 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={80} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('80/100')).toBeTruthy();
    expect(screen.getByText('Weights must sum to 100')).toBeTruthy();
  });

  it('shows dash when weightSum is NaN', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={NaN} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('\u2014/100')).toBeTruthy();
  });

  it('does not show weight warning when sum is 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={100} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.queryByText('Weights must sum to 100')).toBeNull();
  });

  it('renders PassThresholdEditor when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByTestId('pass-threshold')).toBeTruthy();
  });

  it('renders company branding fields when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Company Name')).toBeTruthy();
    expect(screen.getByLabelText('Company Logo URL')).toBeTruthy();
    expect(screen.getByLabelText('Welcome Message')).toBeTruthy();
  });

  it('calls onCompanyNameChange when company name changes', () => {
    const onCompanyNameChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onCompanyNameChange={onCompanyNameChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Acme' } });
    expect(onCompanyNameChange).toHaveBeenCalledWith('Acme');
  });

  it('calls onCompanyLogoUrlChange when logo URL changes', () => {
    const onCompanyLogoUrlChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onCompanyLogoUrlChange={onCompanyLogoUrlChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    fireEvent.change(screen.getByLabelText('Company Logo URL'), { target: { value: 'https://logo.png' } });
    expect(onCompanyLogoUrlChange).toHaveBeenCalledWith('https://logo.png');
  });

  it('calls onWelcomeMessageChange when welcome message changes', () => {
    const onWelcomeMessageChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onWelcomeMessageChange={onWelcomeMessageChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    fireEvent.change(screen.getByLabelText('Welcome Message'), { target: { value: 'Hello!' } });
    expect(onWelcomeMessageChange).toHaveBeenCalledWith('Hello!');
  });

  it('shows logo preview when valid URL is provided', () => {
    render(<AssessmentAdvancedSection {...baseProps} companyLogoUrl="https://example.com/logo.png" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByAltText('Logo preview')).toBeTruthy();
  });

  it('does not show logo preview when URL is empty', () => {
    render(<AssessmentAdvancedSection {...baseProps} companyLogoUrl="" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.queryByText('Preview')).toBeNull();
  });

  it('does not show logo preview when URL is not http(s)', () => {
    render(<AssessmentAdvancedSection {...baseProps} companyLogoUrl="ftp://bad" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.queryByText('Preview')).toBeNull();
  });

  it('shows correct toggle arrow when collapsed', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    expect(screen.getByText(/\u25B6/)).toBeTruthy();
  });

  it('shows correct toggle arrow when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/\u25BC/)).toBeTruthy();
  });

  it('shows score weights description text', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/Adjust how each dimension is weighted/)).toBeTruthy();
  });

  it('shows branding section description text', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/Add your company details/)).toBeTruthy();
  });

  it('shows valid time limit hint when value is valid', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="60" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeTruthy();
  });

  it('no time limit error when field is empty', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeTruthy();
    expect(screen.queryByText('Enter a number')).toBeNull();
  });
});
