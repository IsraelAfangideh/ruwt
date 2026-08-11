// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UsernameClaim } from './UsernameClaim';

vi.mock('@/shared/theme', async () => (await import('@/shared/test/helpers')).mockTheme());
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());
// Matches the house pattern: react-native-web's TextInput does not surface
// onSubmitEditing in jsdom, so the Enter path needs a DOM-level stand-in.
vi.mock('@/shared/ui/Input', () => ({
  Input: ({ onChangeText, onSubmitEditing, containerStyle, inputStyle, testID, ...props }: any) => (
    <input
      onChange={(e: any) => onChangeText?.(e.target.value)}
      onKeyDown={(e: any) => e.key === 'Enter' && onSubmitEditing?.()}
      data-testid={testID}
      {...props}
    />
  ),
}));

const mockFetch = vi.fn();

/** The rule itself is covered in shared/lib/username.test.ts. */
function type(value: string) {
  fireEvent.change(screen.getByTestId('username-input'), { target: { value } });
}

async function save() {
  await act(async () => { fireEvent.click(screen.getByTestId('username-save')); });
}

/** Renders the claim with a fresh onSaved spy, and returns it. */
function renderClaim(value: string | null = null) {
  const onSaved = vi.fn();
  render(<UsernameClaim value={value} onSaved={onSaved} />);
  return onSaved;
}

const okResponse = () => ({ ok: true, json: () => Promise.resolve({}) });

describe('UsernameClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saves a valid handle and reports it back', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const onSaved = renderClaim();

    type('israel');
    await save();

    expect(mockFetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: 'israel' });
    expect(onSaved).toHaveBeenCalledWith('israel');
  });

  it('lowercases and trims before saving', async () => {
    mockFetch.mockResolvedValue(okResponse());
    renderClaim();

    type('  Israel  ');
    await save();

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ username: 'israel' });
  });

  it('does not call the server when the handle is invalid', async () => {
    renderClaim();

    type('ab');
    await save();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('username-error')).toHaveTextContent('3 characters');
  });

  it('explains a taken handle in plain words', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({ error: 'Username already taken' }) });
    const onSaved = renderClaim();

    type('israel');
    await save();

    await waitFor(() => expect(screen.getByTestId('username-error')).toHaveTextContent('taken'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('surfaces a network failure', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    renderClaim();

    type('israel');
    await save();

    await waitFor(() => expect(screen.getByTestId('username-error')).toHaveTextContent('Could not reach the server'));
  });

  it('clears the error once the user edits again', async () => {
    renderClaim();
    type('ab');
    await save();
    expect(screen.getByTestId('username-error')).toBeInTheDocument();

    type('abc');
    expect(screen.queryByTestId('username-error')).not.toBeInTheDocument();
  });

  it('submits on Enter', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const onSaved = renderClaim();

    type('israel');
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('username-input'), { key: 'Enter' });
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('israel'));
  });

  it('starts from the existing handle when there is one', () => {
    renderClaim('israel');
    expect(screen.getByTestId('username-input')).toHaveValue('israel');
  });
});
