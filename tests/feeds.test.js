import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app, rss } = getApp();

describe('Feeds API', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/dashboards')
      .send({ id: 'feed-test', name: 'Feed Test' });
  });

  describe('GET /api/feeds', () => {
    it('returns empty array for dashboard with no feeds', async () => {
      const res = await request(app)
        .get('/api/feeds')
        .query({ dashboard: 'feed-test' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('defaults to the default dashboard', async () => {
      const res = await request(app).get('/api/feeds');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/feeds/health', () => {
    it('returns feed health for dashboard', async () => {
      const res = await request(app)
        .get('/api/feeds/health')
        .query({ dashboard: 'feed-test' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it('returns health structure when feeds exist', async () => {
      const createRes = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Health Feed', url: 'https://example.com/health' });
      const feedId = createRes.body.id;

      rss.getFeedHealth.mockReturnValue({
        [feedId]: { lastSuccess: 1234567890, lastError: null, errorCount: 0 },
      });

      const res = await request(app)
        .get('/api/feeds/health')
        .query({ dashboard: 'feed-test' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty(feedId);
      expect(res.body[feedId]).toMatchObject({
        lastSuccess: 1234567890,
        lastError: null,
        errorCount: 0,
      });
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .get('/api/feeds/health')
        .query({ dashboard: 'nonexistent' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/feeds', () => {
    it('creates a new feed', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Test Feed', url: 'https://example.com/rss' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Test Feed',
        url: 'https://example.com/rss',
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('calls scheduleDashboard when creating feed with ticker enabled', async () => {
      rss.scheduleDashboard.mockClear();
      await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Schedule Test', url: 'https://example.com/schedule' });
      expect(rss.scheduleDashboard).toHaveBeenCalledWith('feed-test');
    });

    it('creates a feed with a logo', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({
          name: 'Logo Feed',
          url: 'https://example.com/feed',
          logo: 'https://example.com/logo.png',
        });
      expect(res.status).toBe(201);
      expect(res.body.logo).toBe('https://example.com/logo.png');
    });

    it('returns 400 when url is missing', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'No URL' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/URL is required/);
    });

    it('returns 400 for invalid url', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ url: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid URL/);
    });

    it('returns 400 for localhost url (SSRF prevention)', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ url: 'http://localhost/feed.xml' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/localhost|not allowed/);
    });

    it('returns 400 for invalid logo url', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ url: 'https://example.com/rss', logo: 'bad-logo' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid URL format/);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'nonexistent' })
        .send({ url: 'https://example.com/rss' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/feeds/:id', () => {
    let feedId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Update Me', url: 'https://example.com/update' });
      feedId = res.body.id;
    });

    it('updates a feed', async () => {
      const res = await request(app)
        .put(`/api/feeds/${feedId}`)
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Updated Feed' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Feed');
    });

    it('returns 404 for non-existent feed', async () => {
      const res = await request(app)
        .put('/api/feeds/nonexistent')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid url on update', async () => {
      const res = await request(app)
        .put(`/api/feeds/${feedId}`)
        .query({ dashboard: 'feed-test' })
        .send({ url: 'bad-url' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/feeds/:id', () => {
    it('deletes a feed', async () => {
      const create = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Delete Me', url: 'https://example.com/delete' });

      const res = await request(app)
        .delete(`/api/feeds/${create.body.id}`)
        .query({ dashboard: 'feed-test' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Feed deleted');
    });

    it('calls clearFeedHealth when deleting a feed', async () => {
      const create = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'feed-test' })
        .send({ name: 'Health Clear Test', url: 'https://example.com/health-clear' });
      const feedId = create.body.id;

      rss.clearFeedHealth.mockClear();
      await request(app)
        .delete(`/api/feeds/${feedId}`)
        .query({ dashboard: 'feed-test' });
      expect(rss.clearFeedHealth).toHaveBeenCalledWith(feedId);
    });

    it('returns 404 for non-existent feed', async () => {
      const res = await request(app)
        .delete('/api/feeds/nonexistent')
        .query({ dashboard: 'feed-test' });
      expect(res.status).toBe(404);
    });
  });
});
