import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app, rss } = getApp();

describe('Dashboards API', () => {
  describe('GET /api/dashboards', () => {
    it('returns an array including the default dashboard', async () => {
      const res = await request(app).get('/api/dashboards');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((d) => d.id === 'default')).toBe(true);
    });

    it('returns dashboards with type and sport', async () => {
      const res = await request(app).get('/api/dashboards');
      expect(res.status).toBe(200);
      const sportsDash = res.body.find((d) => d.id === 'ncaa-mens');
      expect(sportsDash).toBeTruthy();
      expect(sportsDash.type).toBe('sports');
      expect(sportsDash.sport).toBe('mens');
    });
  });

  describe('POST /api/dashboards', () => {
    it('creates a new dashboard', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({ id: 'test-dash', name: 'Test Dashboard', description: 'A test' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 'test-dash',
        name: 'Test Dashboard',
        description: 'A test',
      });
      expect(res.body).toHaveProperty('createdAt');
    });

    it('returns 400 when id is missing', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({ name: 'No ID' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for invalid id format', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({ id: 'bad id!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid dashboard ID/);
    });

    it('returns 409 for duplicate id', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({ id: 'default' });
      expect(res.status).toBe(409);
    });

    it('creates a sports dashboard with type and sport', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({
          id: 'sports-test',
          name: 'Sports Test',
          description: 'Test sports dashboard',
          type: 'sports',
          sport: 'womens',
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 'sports-test',
        name: 'Sports Test',
        type: 'sports',
        sport: 'womens',
      });
    });

    it('returns 400 when type is sports but sport is invalid', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({
          id: 'invalid-sport',
          name: 'Invalid',
          type: 'sports',
          sport: 'invalid',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Sport must be/);
    });
  });

  describe('GET /api/dashboards/:id', () => {
    it('returns an existing dashboard', async () => {
      const res = await request(app).get('/api/dashboards/default');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'default');
      expect(res.body).toHaveProperty('name');
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app).get('/api/dashboards/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns dashboard with type and sport', async () => {
      const res = await request(app).get('/api/dashboards/ncaa-mens');
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('sports');
      expect(res.body.sport).toBe('mens');
    });
  });

  describe('PUT /api/dashboards/:id', () => {
    it('updates a dashboard', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'update-test', name: 'Original' });

      const res = await request(app)
        .put('/api/dashboards/update-test')
        .send({ name: 'Updated Name', description: 'Updated desc' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('Updated desc');
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .put('/api/dashboards/nonexistent')
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('updates dashboard type and sport', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'type-update-test', name: 'Type Test', type: 'default' });

      const res = await request(app)
        .put('/api/dashboards/type-update-test')
        .send({ type: 'sports', sport: 'womens' });
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('sports');
      expect(res.body.sport).toBe('womens');
    });

    it('returns 400 for invalid type', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'invalid-type-test', name: 'Invalid Type' });

      const res = await request(app)
        .put('/api/dashboards/invalid-type-test')
        .send({ type: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Type must be/);
    });

    it('returns 400 for invalid sport when type is sports', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'invalid-sport-put', name: 'Invalid Sport', type: 'sports', sport: 'mens' });

      const res = await request(app)
        .put('/api/dashboards/invalid-sport-put')
        .send({ type: 'sports', sport: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Sport must be/);
    });
  });

  describe('DELETE /api/dashboards/:id', () => {
    it('deletes a dashboard', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'delete-me', name: 'Delete Me' });

      const res = await request(app).delete('/api/dashboards/delete-me');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Dashboard deleted');

      const check = await request(app).get('/api/dashboards/delete-me');
      expect(check.status).toBe(404);
    });

    it('calls clearTickerItems with feed ids when deleting dashboard that has feeds', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'delete-with-feeds', name: 'Delete With Feeds' });
      const feedRes = await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'delete-with-feeds' })
        .send({ name: 'Feed', url: 'https://example.com/feed' });
      const feedId = feedRes.body.id;

      rss.clearTickerItems.mockClear();
      await request(app).delete('/api/dashboards/delete-with-feeds');

      expect(rss.clearTickerItems).toHaveBeenCalledWith('delete-with-feeds', [feedId]);
    });

    it('cannot delete the default dashboard', async () => {
      const res = await request(app).delete('/api/dashboards/default');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete default/);
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app).delete('/api/dashboards/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
