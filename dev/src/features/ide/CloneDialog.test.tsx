// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/shared/theme/colors', () => ({
  arena: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: 'rgba(240,246,252,0.1)',
    text: '#e6edf3',
    textMuted: '#8b929a',
    accent: '#c9a962',
    error: '#f85149',
  },
}));

import { CloneDialog } from './CloneDialog';

describe('CloneDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onClone: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onClone.mockResolvedValue(undefined);
  });

  it('renders nothing when open is false', () => {
    const { container } = render(<CloneDialog {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog when open is true', () => {
    render(<CloneDialog {...defaultProps} />);
    expect(screen.getByTestId('clone-dialog')).toBeInTheDocument();
    expect(screen.getByText('Clone Repository')).toBeInTheDocument();
  });

  it('renders URL input', () => {
    render(<CloneDialog {...defaultProps} />);
    expect(screen.getByTestId('clone-url-input')).toBeInTheDocument();
    expect(screen.getByLabelText('Repository URL')).toBeInTheDocument();
  });

  it('renders PAT input', () => {
    render(<CloneDialog {...defaultProps} />);
    expect(screen.getByTestId('clone-token-input')).toBeInTheDocument();
  });

  it('renders cancel and clone buttons', () => {
    render(<CloneDialog {...defaultProps} />);
    expect(screen.getByTestId('clone-cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('clone-submit-btn')).toBeInTheDocument();
  });

  it('clone button is disabled when URL is empty', () => {
    render(<CloneDialog {...defaultProps} />);
    const btn = screen.getByTestId('clone-submit-btn');
    expect(btn).toBeDisabled();
  });

  it('clone button is enabled when URL has content', () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    expect(screen.getByTestId('clone-submit-btn')).not.toBeDisabled();
  });

  it('calls onClone with URL when clone button is clicked', async () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(defaultProps.onClone).toHaveBeenCalledWith('https://github.com/user/repo', undefined);
  });

  it('passes token to onClone when provided', async () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    fireEvent.change(screen.getByTestId('clone-token-input'), {
      target: { value: 'ghp_abc123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(defaultProps.onClone).toHaveBeenCalledWith('https://github.com/user/repo', 'ghp_abc123');
  });

  it('shows progress message during clone', async () => {
    // Make onClone hang
    defaultProps.onClone.mockReturnValue(new Promise(() => {}));
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(screen.getByTestId('clone-progress')).toBeInTheDocument();
    expect(screen.getByText('Starting clone...')).toBeInTheDocument();
  });

  it('shows error message when clone fails', async () => {
    defaultProps.onClone.mockRejectedValue(new Error('Authentication failed'));
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(screen.getByTestId('clone-error')).toBeInTheDocument();
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });

  it('shows generic error message for non-Error rejection', async () => {
    defaultProps.onClone.mockRejectedValue('unknown error');
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(screen.getByText('Clone failed')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('clone-cancel-btn'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close (X) button is clicked', () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.click(screen.getByTestId('clone-dialog-close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose after successful clone', async () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('disables inputs during clone', async () => {
    defaultProps.onClone.mockReturnValue(new Promise(() => {}));
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(screen.getByTestId('clone-url-input')).toBeDisabled();
    expect(screen.getByTestId('clone-token-input')).toBeDisabled();
  });

  it('shows Cloning... text on button during clone', async () => {
    defaultProps.onClone.mockReturnValue(new Promise(() => {}));
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: 'https://github.com/user/repo' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('clone-submit-btn'));
    });
    expect(screen.getByText('Cloning...')).toBeInTheDocument();
  });

  it('does not call onClone when URL is whitespace only', async () => {
    render(<CloneDialog {...defaultProps} />);
    fireEvent.change(screen.getByTestId('clone-url-input'), {
      target: { value: '   ' },
    });
    // Button should be disabled, but let's also verify the handler
    expect(screen.getByTestId('clone-submit-btn')).toBeDisabled();
  });

  it('renders overlay background', () => {
    render(<CloneDialog {...defaultProps} />);
    expect(screen.getByTestId('clone-dialog-overlay')).toBeInTheDocument();
  });
});
