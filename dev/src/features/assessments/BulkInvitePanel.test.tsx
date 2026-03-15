// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkInvitePanel } from './BulkInvitePanel';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());

function getEmailInput(): HTMLTextAreaElement | HTMLInputElement {
  // react-native-web renders multiline TextInput as <textarea>
  const textarea = document.querySelector('textarea');
  if (textarea) return textarea;
  // fallback to input
  const input = document.querySelector('input[type="text"], input:not([type])') as HTMLInputElement;
  return input;
}

describe('BulkInvitePanel', () => {
  const mockOnInvitesSent = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    mockOnInvitesSent.mockClear();
  });

  it('renders the panel with label and hint', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    expect(screen.getByText('Bulk Invite Candidates')).toBeInTheDocument();
    expect(screen.getByText(/Paste email addresses/)).toBeInTheDocument();
  });

  it('shows 0 valid emails initially', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    expect(screen.getByText('0 valid emails detected')).toBeInTheDocument();
  });

  it('detects valid emails as they are typed', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com, bob@test.com, notanemail' } });
    expect(screen.getByText('2 valid emails detected')).toBeInTheDocument();
  });

  it('shows singular "email" for 1 valid email', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    expect(screen.getByText('1 valid email detected')).toBeInTheDocument();
  });

  it('parses semicolon-separated emails', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'a@b.com;c@d.com;e@f.com' } });
    expect(screen.getByText('3 valid emails detected')).toBeInTheDocument();
  });

  it('parses newline-separated emails', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'a@b.com\nc@d.com\ne@f.com' } });
    expect(screen.getByText('3 valid emails detected')).toBeInTheDocument();
  });

  it('filters out invalid emails from the count', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'valid@test.com, not-an-email, @bad.com, also-bad, another@valid.org' } });
    expect(screen.getByText('2 valid emails detected')).toBeInTheDocument();
  });

  it('shows button text with correct email count', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com, bob@test.com' } });
    expect(screen.getByText('Send 2 Invites')).toBeInTheDocument();
  });

  it('shows singular "Invite" for 1 email', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    expect(screen.getByText('Send 1 Invite')).toBeInTheDocument();
  });

  it('sends invites and shows results on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { email: 'alice@test.com', status: 'created', emailSent: true },
          { email: 'bob@test.com', status: 'created', emailSent: false },
        ],
      }),
    } as Response);

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com\nbob@test.com' } });
    fireEvent.click(screen.getByText(/Send 2 Invite/));
    await waitFor(() => expect(screen.getByText(/2 invites created/)).toBeInTheDocument());
    expect(screen.getByText(/1 email sent/)).toBeInTheDocument();
    expect(mockOnInvitesSent).toHaveBeenCalled();
  });

  it('shows correct count with mixed results (some created, some failed)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { email: 'alice@test.com', status: 'created', emailSent: true },
          { email: 'bob@test.com', status: 'failed', error: 'duplicate' },
        ],
      }),
    } as Response);

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com\nbob@test.com' } });
    fireEvent.click(screen.getByText(/Send 2 Invite/));
    await waitFor(() => expect(screen.getByText(/1 invite created/)).toBeInTheDocument());
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response);

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    fireEvent.click(screen.getByText(/Send 1 Invite/));
    await waitFor(() => expect(screen.getByText('Unauthorized')).toBeInTheDocument());
  });

  it('shows generic error when API returns no error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    fireEvent.click(screen.getByText(/Send 1 Invite/));
    await waitFor(() => expect(screen.getByText('Failed to create invites')).toBeInTheDocument());
  });

  it('shows network error on fetch exception', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('fail'));

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    fireEvent.click(screen.getByText(/Send 1 Invite/));
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('does not send when no valid emails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    // Don't enter any emails, just click send
    fireEvent.click(screen.getByText(/Send 0 Invite/));
    // fetch should not be called for the invite API
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/invites/bulk'), expect.anything());
  });

  it('sends to the correct assessmentId in the API URL', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ email: 'alice@test.com', status: 'created', emailSent: true }] }),
    } as Response);

    render(<BulkInvitePanel assessmentId="my-assessment-42" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    fireEvent.click(screen.getByText(/Send 1 Invite/));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/assessments/my-assessment-42/invites/bulk',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows "Sending Invites..." text while sending', async () => {
    vi.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {})); // Never resolves

    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'alice@test.com' } });
    fireEvent.click(screen.getByText(/Send 1 Invite/));
    await waitFor(() => expect(screen.getByText('Sending Invites...')).toBeInTheDocument());
  });

  it('renders Upload CSV button', () => {
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    expect(screen.getByText('Upload CSV')).toBeInTheDocument();
  });

  it('triggers file input when Upload CSV is clicked', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);
    fireEvent.click(screen.getByText('Upload CSV'));
    expect(createElementSpy).toHaveBeenCalledWith('input');
  });

  it('handles CSV upload with email column header', async () => {
    const mockFile = new File(['email\nalice@test.com\nbob@test.com'], 'contacts.csv', { type: 'text/csv' });
    Object.defineProperty(mockFile, 'text', {
      value: () => Promise.resolve('email\nalice@test.com\nbob@test.com'),
    });

    // Render first, then mock createElement for the CSV button click
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);

    const mockInput = {
      type: '',
      accept: '',
      onchange: null as any,
      click: vi.fn(),
    };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'input') return mockInput as any;
      return origCreate(tag);
    });

    fireEvent.click(screen.getByText('Upload CSV'));

    // Simulate file selection
    if (mockInput.onchange) {
      await mockInput.onchange({ target: { files: [mockFile] } });
    }

    await waitFor(() => {
      expect(screen.getByText('2 valid emails detected')).toBeInTheDocument();
    });
  });

  it('handles CSV upload without email header (uses first column)', async () => {
    const mockFile = new File(['alice@test.com\nbob@test.com'], 'emails.txt', { type: 'text/plain' });
    Object.defineProperty(mockFile, 'text', {
      value: () => Promise.resolve('alice@test.com\nbob@test.com'),
    });

    // Render first, then mock createElement for the CSV button click
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);

    const mockInput = {
      type: '',
      accept: '',
      onchange: null as any,
      click: vi.fn(),
    };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'input') return mockInput as any;
      return origCreate(tag);
    });

    fireEvent.click(screen.getByText('Upload CSV'));

    if (mockInput.onchange) {
      await mockInput.onchange({ target: { files: [mockFile] } });
    }

    await waitFor(() => {
      expect(screen.getByText('2 valid emails detected')).toBeInTheDocument();
    });
  });

  it('handles CSV upload with no file selected', async () => {
    // Render first, then mock createElement for the CSV button click
    render(<BulkInvitePanel assessmentId="a1" onInvitesSent={mockOnInvitesSent} />);

    const mockInput = {
      type: '',
      accept: '',
      onchange: null as any,
      click: vi.fn(),
    };
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'input') return mockInput as any;
      return origCreate(tag);
    });

    fireEvent.click(screen.getByText('Upload CSV'));

    if (mockInput.onchange) {
      await mockInput.onchange({ target: { files: [] } });
    }

    // Should still show 0 emails
    expect(screen.getByText('0 valid emails detected')).toBeInTheDocument();
  });
});
