import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app } = getApp();

describe('Dashboards API', () => {
  describe('GET /api/dashboards', () => {
    it('returns an array including the default dashboard', async () => {
      const res = await request(app).get('/api/dashboards');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((d) => d.id === 'default')).toBe(true);
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
