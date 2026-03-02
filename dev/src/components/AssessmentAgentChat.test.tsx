// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSendMessage = vi.fn();
const mockClearHistory = vi.fn();

let mockMessages: any[] = [];
let mockStreaming = false;
let mockStreamingStatus = 'Thinking...';

vi.mock('@/theme', () => ({
  useColors: () => ({
    text: '#000', textMuted: '#888', textSubtle: '#aaa', accent: '#c9a962',
    border: '#ccc', borderStrong: '#aaa', bg: '#fff', bgWarm: '#f5f3f0',
    primary: '#000', primaryForeground: '#fff', secondary: '#eee', secondaryForeground: '#333',
  }),
}));

vi.mock('@/theme/tokens', () => ({
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  fontSizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 },
  fontFamily: { display: 'serif', body: 'sans-serif' },
  radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

let capturedOnToolResult: ((tool: string, result: any) => void) | null = null;

vi.mock('@/components/arena/ChatMarkdown', () => ({
  renderMarkdown: (text: string) => [<span key="md">{text}</span>],
}));

vi.mock('@/hooks/useAssessmentAgent', () => ({
  useAssessmentAgent: (opts: any) => {
    capturedOnToolResult = opts?.onToolResult ?? null;
    return {
      messages: mockMessages,
      sendMessage: mockSendMessage,
      streaming: mockStreaming,
      streamingStatus: mockStreamingStatus,
      clearHistory: mockClearHistory,
    };
  },
}));

import { AssessmentAgentChat } from './AssessmentAgentChat';

describe('AssessmentAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages = [];
    mockStreaming = false;
    mockStreamingStatus = 'Thinking...';
    capturedOnToolResult = null;
  });

  it('renders the header with AI Assistant title', () => {
    render(<AssessmentAgentChat />);
    expect(screen.getByText('AI Assistant')).toBeTruthy();
    expect(screen.getByText('BETA')).toBeTruthy();
  });

  it('renders empty state with quick actions when no messages', () => {
    render(<AssessmentAgentChat />);
    expect(screen.getByText('Build assessments with AI')).toBeTruthy();
    expect(screen.getByText('Analyze a job description')).toBeTruthy();
    expect(screen.getByText('Suggest challenges for a role')).toBeTruthy();
    expect(screen.getByText('Create a custom challenge')).toBeTruthy();
  });

  it('hides Optimize score weights quick action when no assessmentId', () => {
    render(<AssessmentAgentChat />);
    expect(screen.queryByText('Optimize score weights')).toBeNull();
  });

  it('shows Optimize score weights quick action when assessmentId is set', () => {
    render(<AssessmentAgentChat assessmentId="test-123" />);
    expect(screen.getByText('Optimize score weights')).toBeTruthy();
  });

  it('renders Send button', () => {
    render(<AssessmentAgentChat />);
    expect(screen.getByText('Send')).toBeTruthy();
  });

  it('populates input when quick action is clicked', () => {
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Analyze a job description'));
    const input = screen.getByPlaceholderText(/Describe the role/);
    expect((input as HTMLInputElement).value).toContain('create an assessment');
  });

  it('does not show Clear button when no messages', () => {
    render(<AssessmentAgentChat />);
    expect(screen.queryByText('Clear')).toBeNull();
  });

  it('shows Clear button when messages exist', () => {
    mockMessages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('calls clearHistory after two-step confirmation', () => {
    mockMessages = [{ role: 'user', content: 'test' }];
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Clear'));
    // First click shows confirmation
    expect(mockClearHistory).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    // Second click confirms
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('cancels clear when Cancel is clicked', () => {
    mockMessages = [{ role: 'user', content: 'test' }];
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Clear'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockClearHistory).not.toHaveBeenCalled();
    // Should be back to showing Clear button
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('renders user messages with "You" label', () => {
    mockMessages = [{ role: 'user', content: 'Hello world' }];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders assistant messages with "AI" label', () => {
    mockMessages = [{ role: 'assistant', content: 'I can help with that.' }];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('I can help with that.')).toBeTruthy();
  });

  it('displays assistant message content as-is', () => {
    mockMessages = [
      { role: 'assistant', content: 'Done selecting challenges for you.' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('Done selecting challenges for you.')).toBeTruthy();
  });

  it('shows Thinking... indicator when streaming', () => {
    mockStreaming = true;
    mockMessages = [{ role: 'user', content: 'test' }];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('shows ... on Send button when streaming', () => {
    mockStreaming = true;
    render(<AssessmentAgentChat />);
    expect(screen.getByText('...')).toBeTruthy();
  });

  it('does not show Thinking... when not streaming', () => {
    mockMessages = [{ role: 'user', content: 'test' }];
    render(<AssessmentAgentChat />);
    expect(screen.queryByText('Thinking...')).toBeNull();
  });

  it('hides empty state when messages exist', () => {
    mockMessages = [{ role: 'user', content: 'hi' }];
    render(<AssessmentAgentChat />);
    expect(screen.queryByText('Build assessments with AI')).toBeNull();
    expect(screen.queryByText('Analyze a job description')).toBeNull();
  });

  it('renders multiple messages in order', () => {
    mockMessages = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Second message' },
      { role: 'user', content: 'Third message' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText('First message')).toBeTruthy();
    expect(screen.getByText('Second message')).toBeTruthy();
    expect(screen.getByText('Third message')).toBeTruthy();
  });

  it('populates input for suggest challenges quick action', () => {
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Suggest challenges for a role'));
    const input = screen.getByPlaceholderText(/Describe the role/);
    expect((input as HTMLInputElement).value).toContain('Suggest challenges for a');
  });

  it('populates input for create custom challenge quick action', () => {
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Create a custom challenge'));
    const input = screen.getByPlaceholderText(/Describe the role/);
    expect((input as HTMLInputElement).value).toContain('Create a custom challenge');
  });

  it('populates input for optimize score weights quick action', () => {
    render(<AssessmentAgentChat assessmentId="test-123" />);
    fireEvent.click(screen.getByText('Optimize score weights'));
    const input = screen.getByPlaceholderText(/Describe the role/);
    expect((input as HTMLInputElement).value).toContain('score weights');
  });

  it('renders empty state description text', () => {
    render(<AssessmentAgentChat />);
    expect(screen.getByText(/Paste a job description/)).toBeTruthy();
  });

  it('calls onChallengesChanged when select_challenges tool result is received', () => {
    const onChallengesChanged = vi.fn();
    // We need to test the handleToolResult callback
    // Since it's passed to useAssessmentAgent via onToolResult, we test via the mock
    // The best approach here is to verify the prop is accepted
    render(<AssessmentAgentChat onChallengesChanged={onChallengesChanged} />);
    // Component renders without error with the callback prop
    expect(screen.getByText('AI Assistant')).toBeTruthy();
  });

  it('accepts all optional callback props', () => {
    const onChallengesChanged = vi.fn();
    const onWeightsChanged = vi.fn();
    const onBrandingChanged = vi.fn();
    const onTimeLimitChanged = vi.fn();
    const onThresholdChanged = vi.fn();
    const onCustomChallengeCreated = vi.fn();
    render(
      <AssessmentAgentChat
        assessmentId="test-123"
        onChallengesChanged={onChallengesChanged}
        onWeightsChanged={onWeightsChanged}
        onBrandingChanged={onBrandingChanged}
        onTimeLimitChanged={onTimeLimitChanged}
        onThresholdChanged={onThresholdChanged}
        onCustomChallengeCreated={onCustomChallengeCreated}
      />
    );
    expect(screen.getByText('AI Assistant')).toBeTruthy();
  });

  it('calls sendMessage when Send button is clicked with non-empty input', () => {
    render(<AssessmentAgentChat />);
    const input = screen.getByPlaceholderText(/Describe the role/);
    fireEvent.change(input, { target: { value: 'Hello AI' } });
    fireEvent.click(screen.getByText('Send'));
    expect(mockSendMessage).toHaveBeenCalledWith('Hello AI');
  });

  it('does not call sendMessage when input is empty', () => {
    render(<AssessmentAgentChat />);
    fireEvent.click(screen.getByText('Send'));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('does not call sendMessage when streaming', () => {
    mockStreaming = true;
    render(<AssessmentAgentChat />);
    // Even with text, Send should not trigger when streaming
    const input = screen.getByPlaceholderText(/Describe the role/);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('...'));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('triggers handleSend on Enter key press in input', () => {
    render(<AssessmentAgentChat />);
    const input = screen.getByPlaceholderText(/Describe the role/);
    fireEvent.change(input, { target: { value: 'test message' } });
    // react-native-web maps onKeyPress to DOM keydown event
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(mockSendMessage).toHaveBeenCalledWith('test message');
  });

  it('does not trigger handleSend on Shift+Enter key press', () => {
    render(<AssessmentAgentChat />);
    const input = screen.getByPlaceholderText(/Describe the role/);
    fireEvent.change(input, { target: { value: 'test message' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('calls onChallengesChanged via handleToolResult for select_challenges', () => {
    const onChallengesChanged = vi.fn();
    render(<AssessmentAgentChat onChallengesChanged={onChallengesChanged} />);
    expect(capturedOnToolResult).not.toBeNull();
    capturedOnToolResult!('select_challenges', { success: true });
    expect(onChallengesChanged).toHaveBeenCalled();
  });

  it('calls onChallengesChanged via handleToolResult for remove_challenges', () => {
    const onChallengesChanged = vi.fn();
    render(<AssessmentAgentChat onChallengesChanged={onChallengesChanged} />);
    capturedOnToolResult!('remove_challenges', { success: true });
    expect(onChallengesChanged).toHaveBeenCalled();
  });

  it('calls onWeightsChanged via handleToolResult for set_weights', () => {
    const onWeightsChanged = vi.fn();
    render(<AssessmentAgentChat onWeightsChanged={onWeightsChanged} />);
    capturedOnToolResult!('set_weights', { success: true, result: { cost: 40, speed: 30, quality: 30 } });
    expect(onWeightsChanged).toHaveBeenCalledWith({ cost: 40, speed: 30, quality: 30 });
  });

  it('calls onBrandingChanged via handleToolResult for set_branding', () => {
    const onBrandingChanged = vi.fn();
    render(<AssessmentAgentChat onBrandingChanged={onBrandingChanged} />);
    capturedOnToolResult!('set_branding', { success: true, result: { companyName: 'Acme' } });
    expect(onBrandingChanged).toHaveBeenCalledWith({ companyName: 'Acme' });
  });

  it('calls onTimeLimitChanged via handleToolResult for set_time_limit', () => {
    const onTimeLimitChanged = vi.fn();
    render(<AssessmentAgentChat onTimeLimitChanged={onTimeLimitChanged} />);
    capturedOnToolResult!('set_time_limit', { success: true, result: { minutes: 90 } });
    expect(onTimeLimitChanged).toHaveBeenCalledWith(90);
  });

  it('calls onThresholdChanged via handleToolResult for set_pass_threshold', () => {
    const onThresholdChanged = vi.fn();
    render(<AssessmentAgentChat onThresholdChanged={onThresholdChanged} />);
    capturedOnToolResult!('set_pass_threshold', { success: true, result: { minOverall: 70 } });
    expect(onThresholdChanged).toHaveBeenCalledWith({ minOverall: 70 });
  });

  it('calls onCustomChallengeCreated via handleToolResult for create_custom_challenge', () => {
    const onCustomChallengeCreated = vi.fn();
    render(<AssessmentAgentChat onCustomChallengeCreated={onCustomChallengeCreated} />);
    capturedOnToolResult!('create_custom_challenge', { success: true, result: { id: 'new-ch' } });
    expect(onCustomChallengeCreated).toHaveBeenCalledWith({ id: 'new-ch' });
  });

  it('does not call callbacks when tool result is not successful', () => {
    const onChallengesChanged = vi.fn();
    render(<AssessmentAgentChat onChallengesChanged={onChallengesChanged} />);
    capturedOnToolResult!('select_challenges', { success: false });
    expect(onChallengesChanged).not.toHaveBeenCalled();
  });

  it('renders system messages as compact chips', () => {
    mockMessages = [
      { role: 'user', content: 'Add some challenges' },
      { role: 'system', content: 'Added 3 challenges', systemType: 'tool_result' },
      { role: 'assistant', content: 'Done!' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText(/Added 3 challenges/)).toBeTruthy();
  });

  it('renders tool error system messages', () => {
    mockMessages = [
      { role: 'user', content: 'Try something' },
      { role: 'system', content: 'Failed: No assessment ID', systemType: 'tool_error' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText(/Failed: No assessment ID/)).toBeTruthy();
  });

  it('renders assessment created system message', () => {
    mockMessages = [
      { role: 'system', content: 'New assessment draft created', systemType: 'assessment_created' },
    ];
    render(<AssessmentAgentChat />);
    expect(screen.getByText(/New assessment draft created/)).toBeTruthy();
  });
});
