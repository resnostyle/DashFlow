import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const mockTickerItems = [
  {
    id: 'feed1-item1',
    title: 'Test Article',
    link: 'https://example.com/article',
    pubDate: '2026-01-01T00:00:00Z',
    feedName: 'Test Feed',
    feedId: 'feed1',
    feedLogo: null,
  },
];

const { app, rss } = getApp({
  rssOverrides: {
    getTickerItems: () => mockTickerItems,
  },
});

describe('Ticker API', () => {
  describe('GET /api/ticker', () => {
    it('returns ticker items from the rss service', async () => {
      const res = await request(app)
        .get('/api/ticker')
        .query({ dashboard: 'default' });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 'feed1-item1',
        title: 'Test Article',
      });
    });

    it('calls getTickerItems with the correct dashboard id', async () => {
      await request(app)
        .get('/api/ticker')
        .query({ dashboard: 'my-dash' });
      expect(rss.getTickerItems).toHaveBeenCalledWith('my-dash');
    });
  });
});
