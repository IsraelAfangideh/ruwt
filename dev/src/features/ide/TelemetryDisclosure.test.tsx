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

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

const { TelemetryDisclosure } = await import('./TelemetryDisclosure');

describe('TelemetryDisclosure', () => {
  const onAccept = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the disclosure modal with company name', () => {
    render(
      <TelemetryDisclosure companyName="Acme Corp" sessionId="sess-1" onAccept={onAccept} />,
    );

    expect(screen.getByTestId('telemetry-disclosure')).toBeInTheDocument();
    expect(screen.getByText('Session Recording Notice')).toBeInTheDocument();
    // Company name appears in both the body and privacy paragraphs
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Code changes and file navigation')).toBeInTheDocument();
    expect(screen.getByText('AI prompts and responses')).toBeInTheDocument();
    expect(screen.getByText('Terminal commands and output')).toBeInTheDocument();
    expect(screen.getByText('Time spent on each part of the assessment')).toBeInTheDocument();
  });

  it('shows the accept button', () => {
    render(
      <TelemetryDisclosure companyName="Acme Corp" sessionId="sess-1" onAccept={onAccept} />,
    );

    const btn = screen.getByTestId('disclosure-accept-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('I Understand');
  });

  it('calls onAccept and posts disclosure when button is clicked', async () => {
    render(
      <TelemetryDisclosure companyName="Acme Corp" sessionId="sess-1" onAccept={onAccept} />,
    );

    fireEvent.click(screen.getByTestId('disclosure-accept-btn'));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/assess/takehome/disclosure', expect.objectContaining({
      method: 'POST',
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sessionId).toBe('sess-1');
  });

  it('calls onAccept even if the POST fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    render(
      <TelemetryDisclosure companyName="Acme Corp" sessionId="sess-1" onAccept={onAccept} />,
    );

    fireEvent.click(screen.getByTestId('disclosure-accept-btn'));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(1);
    });
  });

  it('disables button after clicking accept', async () => {
    render(
      <TelemetryDisclosure companyName="Acme Corp" sessionId="sess-1" onAccept={onAccept} />,
    );

    const btn = screen.getByTestId('disclosure-accept-btn');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalled();
    });
  });

  it('includes privacy notice for the company', () => {
    render(
      <TelemetryDisclosure companyName="TechCo" sessionId="sess-2" onAccept={onAccept} />,
    );

    expect(screen.getAllByText(/TechCo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/will not be shared with third parties/)).toBeInTheDocument();
  });
});
