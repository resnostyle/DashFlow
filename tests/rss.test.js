import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rss = require('../src/services/rss');

const { looksLikeRssOrAtom, fetchFeedBody } = rss;

function mockResponse({
  status,
  url,
  location,
  contentType = null,
  body = '',
}) {
  const headers = {
    get(name) {
      const n = String(name).toLowerCase();
      if (n === 'location') return location ?? null;
      if (n === 'content-type') return contentType;
      return null;
    },
  };
  return {
    status,
    url,
    headers,
    ok: status >= 200 && status < 300,
    statusText: status === 200 ? 'OK' : '',
    text: async () => body,
  };
}

describe('looksLikeRssOrAtom', () => {
  it('returns false for XML without a feed root', () => {
    expect(looksLikeRssOrAtom('<?xml version="1.0"?><note />')).toBe(false);
  });

  it('returns true for RSS 2.0 root', () => {
    expect(looksLikeRssOrAtom('<rss version="2.0"><channel></channel></rss>')).toBe(true);
  });

  it('returns true for Atom feed root', () => {
    expect(
      looksLikeRssOrAtom(
        '<feed xmlns="http://www.w3.org/2005/Atom"><title>t</title></feed>',
      ),
    ).toBe(true);
  });

  it('returns true for RSS 1.0 rdf:RDF root', () => {
    expect(
      looksLikeRssOrAtom(
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel /></rdf:RDF>',
      ),
    ).toBe(true);
  });
});

describe('fetchFeedBody', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns response body and finalUrl on 200', async () => {
    const xml = '<rss version="2.0"><channel></channel></rss>';
    global.fetch.mockResolvedValueOnce(
      mockResponse({
        status: 200,
        url: 'https://example.com/feed.xml',
        contentType: 'application/rss+xml',
        body: xml,
      }),
    );

    const out = await fetchFeedBody('https://example.com/feed.xml');
    expect(out.text).toBe(xml);
    expect(out.finalUrl).toBe('https://example.com/feed.xml');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('follows redirect then reads body', async () => {
    const xml = '<rss version="2.0"><channel></channel></rss>';
    global.fetch
      .mockResolvedValueOnce(
        mockResponse({
          status: 302,
          url: 'https://example.com/a',
          location: 'https://example.com/b.xml',
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          url: 'https://example.com/b.xml',
          contentType: 'application/rss+xml',
          body: xml,
        }),
      );

    const out = await fetchFeedBody('https://example.com/a');
    expect(out.finalUrl).toBe('https://example.com/b.xml');
    expect(out.text).toBe(xml);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects redirect target that fails SSRF validation', async () => {
    global.fetch.mockResolvedValueOnce(
      mockResponse({
        status: 302,
        url: 'https://example.com/start',
        location: 'http://127.0.0.1/private',
      }),
    );

    await expect(fetchFeedBody('https://example.com/start')).rejects.toThrow(/blocked/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
