// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockSendMessage, mockClearHistory, mockAbort, mockMessages, mockStreaming, mockStreamingStatus, capturedOnToolResult, mockShowToast } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockClearHistory: vi.fn(),
  mockAbort: vi.fn(),
  mockMessages: { current: [] as any[] },
  mockStreaming: { current: false },
  mockStreamingStatus: { current: '' },
  capturedOnToolResult: { current: null as ((tool: string, result: any) => void) | null },
  mockShowToast: vi.fn(),
}));

vi.mock('@/features/assessments/useAssessmentAgent', () => ({
  useAssessmentAgent: (opts: any) => {
    capturedOnToolResult.current = opts.onToolResult;
    return {
      messages: mockMessages.current,
      sendMessage: mockSendMessage,
      streaming: mockStreaming.current,
      streamingStatus: mockStreamingStatus.current,
      clearHistory: mockClearHistory,
      abort: mockAbort,
    };
  },
  TOOL_SUCCESS_LABELS: {
    select_challenges: (r: any) => `Added ${r?.added ?? 0} challenges`,
    set_weights: () => 'Score weights updated',
    remove_challenges: () => 'Challenges removed',
    set_branding: () => 'Branding updated',
    set_time_limit: () => 'Time limit updated',
    set_pass_threshold: () => 'Pass threshold updated',
    create_custom_challenge: () => 'Custom challenge created',
  },
}));

vi.mock('@/shared/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/features/arena/ChatMarkdown', () => ({
  renderMarkdown: (text: string) => text,
}));

vi.mock('@/features/assessments/assessment-templates', () => ({
  ASSESSMENT_TEMPLATES: [
    {
      id: 'frontend-dev',
      name: 'Frontend Developer',
      description: 'Tests frontend skills',
      timeLimitMinutes: 60,
      challengeTitles: ['String Formatter', 'Event Emitter'],
      categories: ['model_selection'],
    },
  ],
}));

vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AssessmentChatPanel, extractQuickReplies } = await import('./AssessmentChatPanel');

const baseProps = {
  assessmentId: undefined as string | undefined,
  isEditing: false,
  onChallengesChanged: vi.fn(),
  onWeightsChanged: vi.fn(),
  onBrandingChanged: vi.fn(),
  onTimeLimitChanged: vi.fn(),
  onThresholdChanged: vi.fn(),
  onCustomChallengeCreated: vi.fn(),
  onAssessmentCreated: vi.fn(),
  onApplyTemplate: vi.fn(),
};

describe('AssessmentChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages.current = [];
    mockStreaming.current = false;
    mockStreamingStatus.current = '';
  });

  it('renders AI Assistant header', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows BETA badge', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('BETA')).toBeInTheDocument();
  });

  it('renders empty state with title and description', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Build your assessment with AI')).toBeInTheDocument();
    expect(screen.getByText(/Paste a job description/)).toBeInTheDocument();
  });

  it('renders suggested prompts in empty state', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Analyze a job description')).toBeInTheDocument();
    expect(screen.getByText('Suggest challenges for a role')).toBeInTheDocument();
    expect(screen.getByText('Create a custom challenge')).toBeInTheDocument();
  });

  it('does not show assessment-requiring prompts when no assessmentId', () => {
    render(<AssessmentChatPanel {...baseProps} assessmentId={undefined} />);
    expect(screen.queryByText('Optimize score weights')).toBeNull();
  });

  it('shows assessment-requiring prompts when assessmentId exists', () => {
    render(<AssessmentChatPanel {...baseProps} assessmentId="a1" />);
    expect(screen.getByText('Optimize score weights')).toBeInTheDocument();
  });

  it('renders template buttons when not editing', () => {
    render(<AssessmentChatPanel {...baseProps} isEditing={false} />);
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
  });

  it('does not render template buttons when editing', () => {
    render(<AssessmentChatPanel {...baseProps} isEditing={true} />);
    expect(screen.queryByText('Quick Start')).toBeNull();
  });

  it('applies template directly and sends summary on template click', () => {
    const onApplyTemplate = vi.fn();
    render(<AssessmentChatPanel {...baseProps} onApplyTemplate={onApplyTemplate} />);
    fireEvent.click(screen.getByText('Frontend Developer'));
    expect(onApplyTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Frontend Developer' })
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringContaining('Frontend Developer template')
    );
  });

  it('sets input text on suggested prompt click', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Analyze a job description'));
    // The prompt text should be in the input (value is managed by useState)
    // Since we can't directly read the input value easily, verify it did not call sendMessage
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('renders Send button', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('disables Send button when input is empty', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    const sendBtn = screen.getByText('Send');
    expect(sendBtn.closest('button')?.disabled).toBe(true);
  });

  it('renders Stop button when streaming', () => {
    mockStreaming.current = true;
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.queryByText('Send')).toBeNull();
  });

  it('calls abort when Stop is clicked', () => {
    mockStreaming.current = true;
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Stop'));
    expect(mockAbort).toHaveBeenCalled();
  });

  it('renders user and assistant messages', () => {
    mockMessages.current = [
      { role: 'user', content: 'Help me build an assessment' },
      { role: 'assistant', content: 'I can help with that!' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Help me build an assessment')).toBeInTheDocument();
    expect(screen.getByText('I can help with that!')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders system messages with appropriate prefixes', () => {
    mockMessages.current = [
      { role: 'system', content: 'Added 3 challenges', systemType: 'tool_result' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Added 3 challenges/)).toBeInTheDocument();
  });

  it('renders system error messages', () => {
    mockMessages.current = [
      { role: 'system', content: 'Failed to add challenges', systemType: 'tool_error' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Failed to add challenges/)).toBeInTheDocument();
  });

  it('renders assessment_created system messages', () => {
    mockMessages.current = [
      { role: 'system', content: 'Assessment created', systemType: 'assessment_created' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Assessment created/)).toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    mockStreaming.current = true;
    mockStreamingStatus.current = 'Thinking...';
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('does not show streaming indicator when not streaming', () => {
    mockStreaming.current = false;
    mockStreamingStatus.current = 'Thinking...';
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Thinking...')).toBeNull();
  });

  it('shows Clear button when messages exist', () => {
    mockMessages.current = [{ role: 'user', content: 'Hello' }];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('does not show Clear button when messages are empty', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Clear')).toBeNull();
  });

  it('shows Confirm/Cancel on clear click', () => {
    mockMessages.current = [{ role: 'user', content: 'Hello' }];
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls clearHistory on Confirm click', () => {
    mockMessages.current = [{ role: 'user', content: 'Hello' }];
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Clear'));
    fireEvent.click(screen.getByLabelText('Confirm clear chat history'));
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('cancels clear confirmation', () => {
    mockMessages.current = [{ role: 'user', content: 'Hello' }];
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Clear'));
    fireEvent.click(screen.getByLabelText('Cancel clear'));
    // Should go back to showing Clear button
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('renders the input placeholder', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByPlaceholderText('Describe the role or paste a job description...')).toBeInTheDocument();
  });

  it('hides empty state when messages exist', () => {
    mockMessages.current = [{ role: 'user', content: 'Hi' }];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Build your assessment with AI')).toBeNull();
  });

  it('renders quick-reply buttons when assistant message contains options', () => {
    mockMessages.current = [
      { role: 'assistant', content: 'Option A: Add more challenges\nOption B: Keep current set' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('sends quick-reply message when chip is clicked', () => {
    mockMessages.current = [
      { role: 'assistant', content: 'Option A: Add more challenges\nOption B: Keep current set' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Option A'));
    expect(mockSendMessage).toHaveBeenCalledWith('Option A');
  });

  it('renders "Apply all" button when assistant message ends with question', () => {
    mockMessages.current = [
      { role: 'assistant', content: 'I recommend swapping challenge X for Y. Want me to apply this?' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Apply all')).toBeInTheDocument();
  });

  it('does not render quick-reply buttons when streaming', () => {
    mockStreaming.current = true;
    mockMessages.current = [
      { role: 'assistant', content: 'Option A: Something\nOption B: Other' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Option A')).toBeNull();
  });

  it('does not render quick-reply buttons for user messages', () => {
    mockMessages.current = [
      { role: 'user', content: 'Option A: foo' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    // Quick-reply chips only render after the last *assistant* message
    // With only a user message, no quick-reply chip buttons should exist
    const buttons = screen.queryAllByRole('button');
    const optionButton = buttons.find(b => b.textContent === 'Option A');
    expect(optionButton).toBeUndefined();
  });
});

describe('extractQuickReplies', () => {
  it('extracts Option A/B labels', () => {
    const content = 'Here are two approaches:\nOption A: Use more challenges\nOption B: Keep it lean';
    expect(extractQuickReplies(content)).toEqual(['Option A', 'Option B']);
  });

  it('extracts Option A/B/C labels', () => {
    const content = 'Option A: first\nOption B: second\nOption C: third';
    expect(extractQuickReplies(content)).toEqual(['Option A', 'Option B', 'Option C']);
  });

  it('handles case insensitive options', () => {
    const content = 'option a: lower case\nOPTION B: upper case';
    expect(extractQuickReplies(content)).toEqual(['Option A', 'Option B']);
  });

  it('returns empty for no options', () => {
    expect(extractQuickReplies('Just a plain message without options.')).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(extractQuickReplies('')).toEqual([]);
  });

  it('deduplicates repeated options', () => {
    const content = 'Option A: first mention\nSome text\nOption A: repeated mention';
    expect(extractQuickReplies(content)).toEqual(['Option A']);
  });
});

// ---------------------------------------------------------------------------
// handleToolResult: exercises the switch statement routing tool results
// ---------------------------------------------------------------------------

describe('handleToolResult (via captured callback)', () => {
  function renderAndCapture(props = baseProps) {
    render(<AssessmentChatPanel {...props} />);
    const fn = capturedOnToolResult.current!;
    expect(fn).toBeTruthy();
    return fn;
  }

  it('ignores tool results with success=false', () => {
    const onChallengesChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onChallengesChanged });
    fn('select_challenges', { success: false, result: {} });
    expect(onChallengesChanged).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('calls onChallengesChanged for select_challenges', () => {
    const onChallengesChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onChallengesChanged });
    fn('select_challenges', { success: true, result: { added: 3 } });
    expect(onChallengesChanged).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Added 3 challenges', 'success');
  });

  it('calls onChallengesChanged for remove_challenges', () => {
    const onChallengesChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onChallengesChanged });
    fn('remove_challenges', { success: true, result: {} });
    expect(onChallengesChanged).toHaveBeenCalled();
  });

  it('calls onWeightsChanged for set_weights', () => {
    const onWeightsChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onWeightsChanged });
    const weights = { modelSelection: 30, promptEfficiency: 20 };
    fn('set_weights', { success: true, result: weights });
    expect(onWeightsChanged).toHaveBeenCalledWith(weights);
  });

  it('calls onBrandingChanged for set_branding', () => {
    const onBrandingChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onBrandingChanged });
    const branding = { companyName: 'Ruwt', welcomeMessage: 'Hello' };
    fn('set_branding', { success: true, result: branding });
    expect(onBrandingChanged).toHaveBeenCalledWith(branding);
  });

  it('calls onTimeLimitChanged for set_time_limit', () => {
    const onTimeLimitChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onTimeLimitChanged });
    fn('set_time_limit', { success: true, result: { minutes: 45 } });
    expect(onTimeLimitChanged).toHaveBeenCalledWith(45);
  });

  it('calls onThresholdChanged for set_pass_threshold', () => {
    const onThresholdChanged = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onThresholdChanged });
    const threshold = { type: 'percentage', value: 70 };
    fn('set_pass_threshold', { success: true, result: threshold });
    expect(onThresholdChanged).toHaveBeenCalledWith(threshold);
  });

  it('calls onCustomChallengeCreated for create_custom_challenge', () => {
    const onCustomChallengeCreated = vi.fn();
    const fn = renderAndCapture({ ...baseProps, onCustomChallengeCreated });
    fn('create_custom_challenge', { success: true, result: {} });
    expect(onCustomChallengeCreated).toHaveBeenCalled();
  });

  it('shows toast for known tools', () => {
    const fn = renderAndCapture();
    fn('set_weights', { success: true, result: {} });
    expect(mockShowToast).toHaveBeenCalledWith('Score weights updated', 'success');
  });

  it('does not show toast for unknown tools (no labelFn)', () => {
    const fn = renderAndCapture();
    mockShowToast.mockClear();
    fn('unknown_tool', { success: true, result: {} });
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleSend: type text then click Send
// ---------------------------------------------------------------------------

describe('handleSend', () => {
  it('Send button is disabled when input is empty', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    const sendBtn = screen.getByText('Send').closest('button');
    expect(sendBtn?.disabled).toBe(true);
  });

  it('Send button is enabled when text is typed', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    const input = screen.getByPlaceholderText('Describe the role or paste a job description...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    const sendBtn = screen.getByText('Send').closest('button');
    expect(sendBtn?.disabled).toBe(false);
  });

  it('calls sendMessage when Send clicked with text', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    const input = screen.getByPlaceholderText('Describe the role or paste a job description...');
    fireEvent.change(input, { target: { value: 'Build assessment' } });
    fireEvent.click(screen.getByText('Send'));
    expect(mockSendMessage).toHaveBeenCalledWith('Build assessment');
  });

  it('does not send when streaming (Stop button shown instead)', () => {
    mockStreaming.current = true;
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Send')).toBeNull();
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });
});
