// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/shared/ui/Avatar', () => ({
  Avatar: ({ src, fallback, size }: any) => (
    <div data-testid="avatar" data-src={src ?? ''} data-fallback={fallback} data-size={size} />
  ),
}));
vi.mock('@/shared/theme/tokens', async () => (await import('@/shared/test/helpers')).mockTokens());

const { AvatarUpload, resizeImage } = await import('./AvatarUpload');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

function createFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

/** Create a small image file (just raw bytes; Image/Canvas are mocked in tests). */
function createImageFile(name = 'photo.png'): File {
  return new File([new Uint8Array(100)], name, { type: 'image/png' });
}

/** Set up Image and Canvas mocks for resizeImage to work in jsdom. */
function setupImageCanvasMocks(opts: { imgWidth?: number; imgHeight?: number; dataUrl?: string; ctxNull?: boolean; imgError?: boolean } = {}) {
  const { imgWidth = 100, imgHeight = 100, dataUrl = 'data:image/jpeg;base64,abc', ctxNull = false, imgError = false } = opts;

  const mockDrawImage = vi.fn();
  const mockToDataURL = vi.fn().mockReturnValue(dataUrl);
  const mockGetContext = vi.fn().mockReturnValue(ctxNull ? null : { drawImage: mockDrawImage });

  const OrigImage = globalThis.Image;
  class MockImage {
    width = imgWidth;
    height = imgHeight;
    onload: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    set src(_val: string) {
      if (imgError) {
        setTimeout(() => this.onerror?.(new Error('Image load failed')), 0);
      } else {
        setTimeout(() => this.onload?.(), 0);
      }
    }
  }
  vi.stubGlobal('Image', MockImage);

  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: mockGetContext, toDataURL: mockToDataURL } as any;
    }
    return origCreateElement(tag);
  });

  return { cleanup: () => { vi.stubGlobal('Image', OrigImage); vi.restoreAllMocks(); }, mockDrawImage, mockToDataURL };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests: resizeImage (with DOM mocks)
// ---------------------------------------------------------------------------

describe('resizeImage', () => {
  it('resolves with data URL for wide image (w > h, w > maxSize)', async () => {
    const { cleanup } = setupImageCanvasMocks({ imgWidth: 400, imgHeight: 200, dataUrl: 'data:image/jpeg;base64,wide' });
    const file = createFile('wide.png', 'image/png', 100);
    const result = await resizeImage(file, 200);
    expect(result).toBe('data:image/jpeg;base64,wide');
    cleanup();
  });

  it('resolves with data URL for tall image (h > w, h > maxSize)', async () => {
    const { cleanup } = setupImageCanvasMocks({ imgWidth: 100, imgHeight: 400, dataUrl: 'data:image/jpeg;base64,tall' });
    const file = createFile('tall.png', 'image/png', 100);
    const result = await resizeImage(file, 200);
    expect(result).toBe('data:image/jpeg;base64,tall');
    cleanup();
  });

  it('does not scale small wide image (w > h, w <= maxSize)', async () => {
    const { cleanup, mockDrawImage } = setupImageCanvasMocks({ imgWidth: 50, imgHeight: 30 });
    const file = createFile('small.png', 'image/png', 100);
    await resizeImage(file, 200);
    // drawImage should be called with original dimensions
    expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 50, 30);
    cleanup();
  });

  it('does not scale small tall image (h >= w, h <= maxSize)', async () => {
    const { cleanup, mockDrawImage } = setupImageCanvasMocks({ imgWidth: 30, imgHeight: 50 });
    const file = createFile('small-tall.png', 'image/png', 100);
    await resizeImage(file, 200);
    expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 30, 50);
    cleanup();
  });

  it('rejects when canvas context is null', async () => {
    const { cleanup } = setupImageCanvasMocks({ ctxNull: true });
    const file = createFile('test.png', 'image/png', 100);
    await expect(resizeImage(file, 200)).rejects.toThrow('Canvas not supported');
    cleanup();
  });

  it('rejects when Image errors', async () => {
    const { cleanup } = setupImageCanvasMocks({ imgError: true });
    const file = createFile('bad.png', 'image/png', 100);
    await expect(resizeImage(file, 200)).rejects.toBeTruthy();
    cleanup();
  });

  it('rejects when FileReader errors', async () => {
    const OrigReader = globalThis.FileReader;
    class FailReader {
      onerror: ((e: any) => void) | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(new Error('read failed')), 0);
      }
    }
    vi.stubGlobal('FileReader', FailReader);

    const file = createFile('bad.txt', 'text/plain', 100);
    await expect(resizeImage(file, 200)).rejects.toBeTruthy();
    vi.stubGlobal('FileReader', OrigReader);
  });

  it('calls toDataURL with jpeg quality 0.85', async () => {
    const { cleanup, mockToDataURL } = setupImageCanvasMocks();
    const file = createFile('test.png', 'image/png', 100);
    await resizeImage(file, 200);
    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// Tests: AvatarUpload component rendering
// ---------------------------------------------------------------------------

describe('AvatarUpload rendering', () => {
  it('renders avatar with currentUrl', () => {
    render(<AvatarUpload currentUrl="http://img.com/avatar.jpg" fallback="AB" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.dataset.src).toBe('http://img.com/avatar.jpg');
    expect(avatar.dataset.fallback).toBe('AB');
  });

  it('renders avatar with null currentUrl', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.dataset.src).toBe('');
  });

  it('renders Edit overlay text', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('uses default size of 80', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.dataset.size).toBe('80');
  });

  it('accepts custom size', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" size={120} />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar.dataset.size).toBe('120');
  });

  it('renders hidden file input', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/*');
  });
});

// ---------------------------------------------------------------------------
// Tests: AvatarUpload file handling
// ---------------------------------------------------------------------------

describe('AvatarUpload file handling', () => {
  it('ignores non-image files', async () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    const textFile = createFile('test.txt', 'text/plain', 100);
    fireEvent.change(input, { target: { files: [textFile] } });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores files larger than 5MB', async () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    const bigFile = createFile('big.png', 'image/png', 6 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [bigFile] } });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores when no file selected', async () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    fireEvent.change(input, { target: { files: [] } });

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads valid image and calls onUploaded on success', async () => {
    const onUploaded = vi.fn();
    fetchMock.mockResolvedValue({ ok: true });
    const { cleanup } = setupImageCanvasMocks({ dataUrl: 'data:image/jpeg;base64,uploaded' });

    render(<AvatarUpload currentUrl={null} fallback="AB" onUploaded={onUploaded} />);
    const input = screen.getByTestId('avatar-file-input');

    const file = createImageFile('photo.png');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith('data:image/jpeg;base64,uploaded');
    });
    cleanup();
  });

  it('clears previewUrl on upload failure (non-ok response)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { cleanup } = setupImageCanvasMocks({ dataUrl: 'data:image/jpeg;base64,preview' });

    render(<AvatarUpload currentUrl="http://original.jpg" fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    const file = createImageFile('photo.png');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const avatar = screen.getByTestId('avatar');
      expect(avatar.dataset.src).toBe('http://original.jpg');
    });
    cleanup();
  });

  it('clears previewUrl on fetch exception', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));
    const { cleanup } = setupImageCanvasMocks({ dataUrl: 'data:image/jpeg;base64,preview' });

    render(<AvatarUpload currentUrl="http://original.jpg" fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    const file = createImageFile('photo.png');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const avatar = screen.getByTestId('avatar');
      expect(avatar.dataset.src).toBe('http://original.jpg');
    });
    cleanup();
  });

  it('works without onUploaded callback', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { cleanup } = setupImageCanvasMocks();

    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const input = screen.getByTestId('avatar-file-input');

    const file = createImageFile('photo.png');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.anything());
    });
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// Tests: AvatarUpload click interaction
// ---------------------------------------------------------------------------

describe('AvatarUpload click', () => {
  it('triggers file input click when avatar wrapper is clicked', () => {
    render(<AvatarUpload currentUrl={null} fallback="AB" />);
    const wrapEl = screen.getByTestId('avatar-upload');
    const input = screen.getByTestId('avatar-file-input') as HTMLInputElement;

    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(wrapEl);
    expect(clickSpy).toHaveBeenCalled();
  });
});
