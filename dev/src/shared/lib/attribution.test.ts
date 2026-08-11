// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureAttribution, getAttribution, reportAttribution } from './attribution';

const KEY = 'ruwt_attribution';

/** Points the jsdom document at a URL and a referrer. */
function visit(url: string, referrer = '') {
  window.history.replaceState({}, '', url);
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

describe('captureAttribution', () => {
  beforeEach(() => {
    localStorage.clear();
    visit('/', '');
  });

  it('records a direct visit', () => {
    captureAttribution();
    expect(getAttribution()).toEqual({
      referrer: 'direct',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      landingPath: '/',
    });
  });

  it('records the referring host, not the full URL', () => {
    visit('/challenges', 'https://news.ycombinator.com/item?id=123');
    captureAttribution();
    expect(getAttribution()?.referrer).toBe('news.ycombinator.com');
  });

  it('records utm parameters', () => {
    visit('/?utm_source=twitter&utm_medium=social&utm_campaign=launch', '');
    captureAttribution();
    const a = getAttribution();
    expect(a?.utmSource).toBe('twitter');
    expect(a?.utmMedium).toBe('social');
    expect(a?.utmCampaign).toBe('launch');
  });

  it('drops the query string from the landing path, so no PII is stored', () => {
    visit('/invite?email=someone%40example.com', '');
    captureAttribution();
    expect(getAttribution()?.landingPath).toBe('/invite');
  });

  it('treats a same-site referrer as direct, not as an arrival', () => {
    visit('/challenges', `${window.location.origin}/dashboard`);
    captureAttribution();
    expect(getAttribution()?.referrer).toBe('direct');
  });

  it('treats an unparsable referrer as direct', () => {
    visit('/', 'not-a-url');
    captureAttribution();
    expect(getAttribution()?.referrer).toBe('direct');
  });

  it('keeps the first touch and ignores later visits', () => {
    visit('/', 'https://news.ycombinator.com/');
    captureAttribution();
    // A GitHub sign-in round trip lands here next. It must not win.
    visit('/callback', 'https://github.com/login');
    captureAttribution();
    expect(getAttribution()?.referrer).toBe('news.ycombinator.com');
    expect(getAttribution()?.landingPath).toBe('/');
  });

  it('survives storage being unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => captureAttribution()).not.toThrow();
    spy.mockRestore();
  });
});

describe('getAttribution', () => {
  beforeEach(() => localStorage.clear());

  it('is null when nothing was captured', () => {
    expect(getAttribution()).toBeNull();
  });

  it('is null when the stored record is corrupt', () => {
    localStorage.setItem(KEY, 'not json');
    expect(getAttribution()).toBeNull();
  });
});

describe('reportAttribution', () => {
  beforeEach(() => {
    localStorage.clear();
    visit('/', '');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the stored record', async () => {
    visit('/pricing', 'https://reddit.com/r/programming');
    captureAttribution();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await reportAttribution();

    expect(fetchMock).toHaveBeenCalledWith('/api/attribution', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.referrer).toBe('reddit.com');
    expect(body.landingPath).toBe('/pricing');
  });

  it('sends nothing when there is no record', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await reportAttribution();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a network failure, so sign-in is never blocked', async () => {
    captureAttribution();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(reportAttribution()).resolves.toBeUndefined();
  });
});
