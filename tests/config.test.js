import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app } = getApp();

describe('Config API', () => {
  describe('GET /api/config', () => {
    it('returns default config', async () => {
      const res = await request(app)
        .get('/api/config')
        .query({ dashboard: 'default' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        rotationInterval: 30000,
        tickerRefreshInterval: 300000,
        maxTickerItems: 50,
        tickerEnabled: true,
      });
    });
  });

  describe('POST /api/config', () => {
    it('updates rotation interval', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ rotationInterval: 10000 });
      expect(res.status).toBe(200);
      expect(res.body.rotationInterval).toBe(10000);
    });

    it('updates ticker refresh interval', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerRefreshInterval: 120000 });
      expect(res.status).toBe(200);
      expect(res.body.tickerRefreshInterval).toBe(120000);
    });

    it('updates max ticker items', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ maxTickerItems: 100 });
      expect(res.status).toBe(200);
      expect(res.body.maxTickerItems).toBe(100);
    });

    it('updates ticker enabled', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: false });
      expect(res.status).toBe(200);
      expect(res.body.tickerEnabled).toBe(false);
    });

    it('enforces minimum rotation interval of 5000', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ rotationInterval: 1000 });
      expect(res.status).toBe(200);
      expect(res.body.rotationInterval).toBe(5000);
    });

    it('enforces minimum ticker refresh interval of 60000', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerRefreshInterval: 10000 });
      expect(res.status).toBe(200);
      expect(res.body.tickerRefreshInterval).toBe(60000);
    });

    it('clamps max ticker items between 10 and 200', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ maxTickerItems: 5 });
      expect(res.status).toBe(200);
      expect(res.body.maxTickerItems).toBe(10);

      const res2 = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ maxTickerItems: 500 });
      expect(res2.status).toBe(200);
      expect(res2.body.maxTickerItems).toBe(200);
    });

    it('returns 400 for invalid rotationInterval', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ rotationInterval: 'abc' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid tickerEnabled type', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: 'yes' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'nonexistent' })
        .send({ rotationInterval: 10000 });
      expect(res.status).toBe(404);
    });
  });
});
