// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadShareCard } from './share-card';

describe('downloadShareCard', () => {
  let mockCtx: Record<string, any>;
  let mockCanvas: Record<string, any>;
  let blobCallback: ((blob: Blob | null) => void) | null = null;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      letterSpacing: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    };
    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => { blobCallback = cb; }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);
  });

  const baseData = {
    title: 'Test Challenge',
    difficulty: 'medium',
    categoryDisplayName: 'Debugging',
    totalCost: 500,
    badges: [],
    rank: null,
  };

  it('creates a 600x340 canvas', () => {
    downloadShareCard(baseData);
    expect(mockCanvas.width).toBe(600);
    expect(mockCanvas.height).toBe(340);
    expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('draws the challenge title', () => {
    downloadShareCard(baseData);
    expect(mockCtx.fillText).toHaveBeenCalledWith('Test Challenge', 300, 68);
  });

  it('truncates long titles', () => {
    downloadShareCard({ ...baseData, title: 'A very long challenge title that exceeds thirty five chars' });
    const calls = mockCtx.fillText.mock.calls;
    const titleCall = calls.find((c: any[]) => c[1] === 300 && c[2] === 68);
    expect(titleCall?.[0]).toBe('A very long challenge title that ...');
  });

  it('draws difficulty and category subtitle', () => {
    downloadShareCard(baseData);
    expect(mockCtx.fillText).toHaveBeenCalledWith('medium \u2022 Debugging', 300, 90);
  });

  it('draws rank stat box when rank is provided', () => {
    downloadShareCard({ ...baseData, rank: { position: 3, total: 10 } });
    // Draws both cost and rank boxes
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(3); // 2 stat boxes + border
  });

  it('draws single cost box when no rank', () => {
    downloadShareCard(baseData);
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(2); // 1 stat box + border
  });

  it('draws badges when present', () => {
    const badges = [
      { type: 'first_solve', title: 'First Blood', description: '', icon: '\u{1F3AF}' },
      { type: 'speed_demon', title: 'Speed Demon', description: '', icon: '\u26A1' },
    ];
    downloadShareCard({ ...baseData, badges });
    // Should draw badge icons and titles
    expect(mockCtx.fillText).toHaveBeenCalledWith('\u{1F3AF}', expect.any(Number), 118);
    expect(mockCtx.fillText).toHaveBeenCalledWith('\u26A1', expect.any(Number), 118);
    expect(mockCtx.fillText).toHaveBeenCalledWith('First Blood', expect.any(Number), 136);
  });

  it('draws branding at bottom', () => {
    downloadShareCard(baseData);
    expect(mockCtx.fillText).toHaveBeenCalledWith('ruwt.dev', 300, 310);
    expect(mockCtx.fillText).toHaveBeenCalledWith('AI Efficiency Arena', 300, 326);
  });

  it('triggers download when blob is created', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);

    const clickSpy = vi.fn();
    const mockAnchor = { href: '', download: '', click: clickSpy };
    (document.createElement as any).mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      if (tag === 'a') return mockAnchor;
      return {};
    });

    downloadShareCard(baseData);
    expect(blobCallback).toBeTruthy();

    blobCallback!(new Blob(['test'], { type: 'image/png' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(mockAnchor.download).toContain('ruwt-');
  });

  it('handles null blob gracefully', () => {
    downloadShareCard(baseData);
    expect(() => blobCallback!(null)).not.toThrow();
  });

  it('bails out if getContext returns null', () => {
    mockCanvas.getContext = vi.fn(() => null);
    expect(() => downloadShareCard(baseData)).not.toThrow();
    expect(mockCanvas.toBlob).not.toHaveBeenCalled();
  });
});
