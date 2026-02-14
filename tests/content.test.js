import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app } = getApp();

describe('Content API', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/dashboards')
      .send({ id: 'content-test', name: 'Content Test' });
  });

  describe('GET /api/content', () => {
    it('returns empty array for dashboard with no content', async () => {
      const res = await request(app)
        .get('/api/content')
        .query({ dashboard: 'content-test' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/content', () => {
    it('creates content', async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ url: 'https://example.com/page', title: 'Test Page', type: 'webpage' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        url: 'https://example.com/page',
        title: 'Test Page',
        type: 'webpage',
      });
      expect(res.body).toHaveProperty('id');
    });

    it('defaults type to webpage', async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ url: 'https://example.com/other' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('webpage');
    });

    it('returns 400 when url is missing', async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ title: 'No URL' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/URL is required/);
    });

    it('returns 400 for invalid url', async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ url: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid URL/);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'nonexistent' })
        .send({ url: 'https://example.com' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/content/:id', () => {
    let contentId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ url: 'https://example.com/edit', title: 'Edit Me' });
      contentId = res.body.id;
    });

    it('updates content', async () => {
      const res = await request(app)
        .put(`/api/content/${contentId}`)
        .query({ dashboard: 'content-test' })
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('returns 404 for non-existent content', async () => {
      const res = await request(app)
        .put('/api/content/nonexistent')
        .query({ dashboard: 'content-test' })
        .send({ title: 'X' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid url on update', async () => {
      const res = await request(app)
        .put(`/api/content/${contentId}`)
        .query({ dashboard: 'content-test' })
        .send({ url: 'bad-url' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/content/:id', () => {
    it('deletes content', async () => {
      const create = await request(app)
        .post('/api/content')
        .query({ dashboard: 'content-test' })
        .send({ url: 'https://example.com/delete', title: 'Delete Me' });

      const res = await request(app)
        .delete(`/api/content/${create.body.id}`)
        .query({ dashboard: 'content-test' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Content deleted');
    });

    it('returns 404 for non-existent content', async () => {
      const res = await request(app)
        .delete('/api/content/nonexistent')
        .query({ dashboard: 'content-test' });
      expect(res.status).toBe(404);
    });
  });
});
