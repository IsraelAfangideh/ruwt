// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    accentBg: 'rgba(201,169,98,0.12)',
    success: '#3fb950',
    error: '#f85149',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { SessionReplayViewer } = await import('./SessionReplayViewer');

const sampleEvents = [
  { type: 'file_open', timestamp: 0, data: { path: 'index.js' } },
  { type: 'content_snapshot', timestamp: 1000, data: { path: 'index.js', content: 'console.log("hello")' } },
  { type: 'ai_prompt', timestamp: 2000, data: { model: 'gpt-4', fullPrompt: 'Fix the bug' } },
  { type: 'ai_response', timestamp: 3000, data: { model: 'gpt-4', fullResponse: 'Here is the fix', tokens: 100, cost: 10 } },
  { type: 'terminal_command', timestamp: 4000, data: { input: 'npm test', output: 'PASS', exitCode: 0 } },
  { type: 'tab_switch', timestamp: 5000, data: { fromPath: 'index.js', toPath: 'utils.js' } },
  { type: 'content_snapshot', timestamp: 6000, data: { path: 'utils.js', content: 'export function add(a, b) { return a + b; }' } },
  { type: 'test_run', timestamp: 7000, data: { passed: 5, failed: 0 } },
  { type: 'focus_change', timestamp: 8000, data: { focused: false } },
];

describe('SessionReplayViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<SessionReplayViewer sessionId="sess-1" />);
    expect(screen.getByTestId('replay-loading')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<SessionReplayViewer sessionId="sess-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('replay-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('replay-empty')).toBeInTheDocument();
    });
  });

  it('renders the replay viewer with timeline and panels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('session-replay-viewer')).toBeInTheDocument();
    });

    expect(screen.getByTestId('replay-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    expect(screen.getByTestId('replay-file-panel')).toBeInTheDocument();
    expect(screen.getByTestId('replay-ai-panel')).toBeInTheDocument();
    expect(screen.getByTestId('replay-terminal-panel')).toBeInTheDocument();
  });

  it('shows no content at time zero', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('session-replay-viewer')).toBeInTheDocument();
    });

    // At time 0, file_open happened but no content snapshot yet
    const code = screen.getByTestId('replay-code');
    expect(code.textContent).toContain('No content at this point');
  });

  it('shows file content after scrubbing to a snapshot', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    });

    // Scrub to 1500ms — should see the content_snapshot at 1000ms
    fireEvent.change(screen.getByTestId('replay-scrubber'), { target: { value: '1500' } });

    const code = screen.getByTestId('replay-code');
    expect(code.textContent).toContain('console.log("hello")');
  });

  it('shows AI messages after scrubbing past AI events', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    });

    // Scrub to 3500ms — should see both ai_prompt and ai_response
    fireEvent.change(screen.getByTestId('replay-scrubber'), { target: { value: '3500' } });

    expect(screen.getByTestId('ai-msg-0')).toBeInTheDocument();
    expect(screen.getByTestId('ai-msg-1')).toBeInTheDocument();
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('Here is the fix')).toBeInTheDocument();
  });

  it('shows terminal entries after scrubbing past terminal events', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('replay-scrubber'), { target: { value: '4500' } });

    expect(screen.getByTestId('term-entry-0')).toBeInTheDocument();
    expect(screen.getByText('$ npm test')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('shows active file based on last file_open or tab_switch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    });

    // Scrub to 6500ms — tab_switch at 5000 to utils.js, snapshot at 6000
    fireEvent.change(screen.getByTestId('replay-scrubber'), { target: { value: '6500' } });

    const code = screen.getByTestId('replay-code');
    expect(code.textContent).toContain('export function add');
  });

  it('renders event markers on the timeline', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('session-replay-viewer')).toBeInTheDocument();
    });

    // Should have markers for all events
    for (let i = 0; i < sampleEvents.length; i++) {
      expect(screen.getByTestId(`marker-${i}`)).toBeInTheDocument();
    }
  });

  it('fetches replay from the correct URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [] }),
    });
    render(<SessionReplayViewer sessionId="sess-42" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/assess/takehome/replay?sessionId=sess-42',
      );
    });
  });

  it('shows AI count in panel header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: sampleEvents }),
    });
    render(<SessionReplayViewer sessionId="sess-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('replay-scrubber')).toBeInTheDocument();
    });

    // Scrub past all events to see full count
    fireEvent.change(screen.getByTestId('replay-scrubber'), { target: { value: '9000' } });
    expect(screen.getByText('AI Conversation (2)')).toBeInTheDocument();
  });
});
