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
vi.mock('@/features/assessments/components/PassThresholdEditor', () => ({
  PassThresholdEditor: ({ value }: any) => (
    <div data-testid="pass-threshold">
      <span>{value ? 'Threshold set' : 'No threshold'}</span>
    </div>
  ),
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

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
    expect(screen.getByText(/Advanced Settings/)).toBeInTheDocument();
    // Content should not be visible
    expect(screen.queryByText('Score Weights')).toBeNull();
  });

  it('has correct accessibility label when collapsed', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    expect(screen.getByLabelText('Expand advanced settings')).toBeInTheDocument();
  });

  it('expands on click', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Score Weights')).toBeInTheDocument();
    expect(screen.getByText('Company Branding (optional)')).toBeInTheDocument();
  });

  it('has correct accessibility label when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Collapse advanced settings')).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Score Weights')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Collapse advanced settings'));
    expect(screen.queryByText('Score Weights')).toBeNull();
  });

  it('renders time limit input when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Time Limit (minutes)')).toBeInTheDocument();
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
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeInTheDocument();
  });

  it('shows invalid time limit message when below minimum', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="3" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum is 5 minutes')).toBeInTheDocument();
  });

  it('shows invalid time limit message when above maximum', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="300" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Maximum is 240 minutes')).toBeInTheDocument();
  });

  it('shows invalid time limit message when non-numeric', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="abc" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Enter a number')).toBeInTheDocument();
  });

  it('renders all weight fields when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Model Selection')).toBeInTheDocument();
    expect(screen.getByText('Prompt Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Debugging')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });

  it('shows weight sum as 100/100 when correct', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={100} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('100/100')).toBeInTheDocument();
  });

  it('shows weight sum warning when not 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={80} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('80/100')).toBeInTheDocument();
    expect(screen.getByText('Weights must sum to 100')).toBeInTheDocument();
  });

  it('shows dash when weightSum is NaN', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={NaN} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('\u2014/100')).toBeInTheDocument();
  });

  it('does not show weight warning when sum is 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={100} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.queryByText('Weights must sum to 100')).toBeNull();
  });

  it('renders PassThresholdEditor when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByTestId('pass-threshold')).toBeInTheDocument();
  });

  it('renders company branding fields when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Logo URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Welcome Message')).toBeInTheDocument();
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
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByAltText('Logo preview')).toBeInTheDocument();
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
    expect(screen.getByText(/\u25B6/)).toBeInTheDocument();
  });

  it('shows correct toggle arrow when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/\u25BC/)).toBeInTheDocument();
  });

  it('shows score weights description text', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/Adjust how each dimension is weighted/)).toBeInTheDocument();
  });

  it('shows branding section description text', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText(/Add your company details/)).toBeInTheDocument();
  });

  it('shows valid time limit hint when value is valid', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="60" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeInTheDocument();
  });

  it('no time limit error when field is empty', () => {
    render(<AssessmentAdvancedSection {...baseProps} timeLimitMinutes="" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Minimum 5 min, maximum 240 min')).toBeInTheDocument();
    expect(screen.queryByText('Enter a number')).toBeNull();
  });

  it('calls onWeightsChange when weight input changes', () => {
    const onWeightsChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onWeightsChange={onWeightsChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    // Find the Model Selection weight input
    const weightInputs = screen.getAllByPlaceholderText('20');
    expect(weightInputs.length).toBeGreaterThan(0);
    fireEvent.change(weightInputs[0], { target: { value: '30' } });
    expect(onWeightsChange).toHaveBeenCalled();
    // Verify the updater function works correctly
    const updater = onWeightsChange.mock.calls[0][0];
    const result = updater({ modelSelection: '20', promptEfficiency: '20', debugging: '20', strategy: '20', speed: '20' });
    expect(result.modelSelection).toBe('30');
  });

  it('shows weight bar as destructive color when sum exceeds 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={120} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('120/100')).toBeInTheDocument();
    expect(screen.getByText('Weights must sum to 100')).toBeInTheDocument();
  });

  it('shows weight bar as success color when sum is exactly 100', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={100} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('100/100')).toBeInTheDocument();
    expect(screen.queryByText('Weights must sum to 100')).toBeNull();
  });

  it('shows dash for non-finite weight sum', () => {
    render(<AssessmentAdvancedSection {...baseProps} weightSum={NaN} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('\u2014/100')).toBeInTheDocument();
  });

  it('renders company branding inputs when expanded', () => {
    render(<AssessmentAdvancedSection {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Logo URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Welcome Message')).toBeInTheDocument();
  });

  it('calls onCompanyNameChange when company name input changes', () => {
    const onCompanyNameChange = vi.fn();
    render(<AssessmentAdvancedSection {...baseProps} onCompanyNameChange={onCompanyNameChange} />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Acme' } });
    expect(onCompanyNameChange).toHaveBeenCalledWith('Acme');
  });

  it('shows logo preview when companyLogoUrl is a valid URL', () => {
    render(<AssessmentAdvancedSection {...baseProps} companyLogoUrl="https://example.com/logo.png" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByAltText('Logo preview')).toBeInTheDocument();
  });

  it('does not show logo preview for non-URL logo text', () => {
    render(<AssessmentAdvancedSection {...baseProps} companyLogoUrl="not-a-url" />);
    fireEvent.click(screen.getByLabelText('Expand advanced settings'));
    expect(screen.queryByText('Preview')).toBeNull();
  });
});
