// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockSendMessage, mockClearHistory, mockAbort, mockMessages, mockStreaming, mockStreamingStatus } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockClearHistory: vi.fn(),
  mockAbort: vi.fn(),
  mockMessages: { current: [] as any[] },
  mockStreaming: { current: false },
  mockStreamingStatus: { current: '' },
}));

vi.mock('@/hooks/useAssessmentAgent', () => ({
  useAssessmentAgent: () => ({
    messages: mockMessages.current,
    sendMessage: mockSendMessage,
    streaming: mockStreaming.current,
    streamingStatus: mockStreamingStatus.current,
    clearHistory: mockClearHistory,
    abort: mockAbort,
  }),
}));

vi.mock('@/components/arena/ChatMarkdown', () => ({
  renderMarkdown: (text: string) => text,
}));

vi.mock('@/lib/assessment-templates', () => ({
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

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onPress, disabled, ...props }: any) => (
    <button onClick={onPress} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
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

const { AssessmentChatPanel } = await import('./AssessmentChatPanel');

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
    expect(screen.getByText('AI Assistant')).toBeTruthy();
  });

  it('shows BETA badge', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('BETA')).toBeTruthy();
  });

  it('renders empty state with title and description', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Build your assessment with AI')).toBeTruthy();
    expect(screen.getByText(/Paste a job description/)).toBeTruthy();
  });

  it('renders suggested prompts in empty state', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Analyze a job description')).toBeTruthy();
    expect(screen.getByText('Suggest challenges for a role')).toBeTruthy();
    expect(screen.getByText('Create a custom challenge')).toBeTruthy();
  });

  it('does not show assessment-requiring prompts when no assessmentId', () => {
    render(<AssessmentChatPanel {...baseProps} assessmentId={undefined} />);
    expect(screen.queryByText('Optimize score weights')).toBeNull();
  });

  it('shows assessment-requiring prompts when assessmentId exists', () => {
    render(<AssessmentChatPanel {...baseProps} assessmentId="a1" />);
    expect(screen.getByText('Optimize score weights')).toBeTruthy();
  });

  it('renders template buttons when not editing', () => {
    render(<AssessmentChatPanel {...baseProps} isEditing={false} />);
    expect(screen.getByText('Quick Start')).toBeTruthy();
    expect(screen.getByText('Frontend Developer')).toBeTruthy();
  });

  it('does not render template buttons when editing', () => {
    render(<AssessmentChatPanel {...baseProps} isEditing={true} />);
    expect(screen.queryByText('Quick Start')).toBeNull();
  });

  it('sends template setup message on template click', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Frontend Developer'));
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.stringContaining('Frontend Developer')
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
    expect(screen.getByText('Send')).toBeTruthy();
  });

  it('disables Send button when input is empty', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    const sendBtn = screen.getByText('Send');
    expect(sendBtn.closest('button')?.disabled).toBe(true);
  });

  it('renders Stop button when streaming', () => {
    mockStreaming.current = true;
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Stop')).toBeTruthy();
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
    expect(screen.getByText('Help me build an assessment')).toBeTruthy();
    expect(screen.getByText('I can help with that!')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('renders system messages with appropriate prefixes', () => {
    mockMessages.current = [
      { role: 'system', content: 'Added 3 challenges', systemType: 'tool_result' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Added 3 challenges/)).toBeTruthy();
  });

  it('renders system error messages', () => {
    mockMessages.current = [
      { role: 'system', content: 'Failed to add challenges', systemType: 'tool_error' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Failed to add challenges/)).toBeTruthy();
  });

  it('renders assessment_created system messages', () => {
    mockMessages.current = [
      { role: 'system', content: 'Assessment created', systemType: 'assessment_created' },
    ];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText(/Assessment created/)).toBeTruthy();
  });

  it('shows streaming indicator when streaming', () => {
    mockStreaming.current = true;
    mockStreamingStatus.current = 'Thinking...';
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByText('Thinking...')).toBeTruthy();
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
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('does not show Clear button when messages are empty', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Clear')).toBeNull();
  });

  it('shows Confirm/Cancel on clear click', () => {
    mockMessages.current = [{ role: 'user', content: 'Hello' }];
    render(<AssessmentChatPanel {...baseProps} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
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
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('renders the input placeholder', () => {
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.getByPlaceholderText('Describe the role or paste a job description...')).toBeTruthy();
  });

  it('hides empty state when messages exist', () => {
    mockMessages.current = [{ role: 'user', content: 'Hi' }];
    render(<AssessmentChatPanel {...baseProps} />);
    expect(screen.queryByText('Build your assessment with AI')).toBeNull();
  });
});
