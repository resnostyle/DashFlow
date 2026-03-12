import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app } = getApp();

describe('Sports API', () => {
  describe('GET /api/sports/ncaa', () => {
    it('returns sports data for ncaa-mens dashboard', async () => {
      const res = await request(app)
        .get('/api/sports/ncaa')
        .query({ dashboard: 'ncaa-mens' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sport', 'mens');
      expect(res.body).toHaveProperty('primary');
      expect(res.body).toHaveProperty('secondary');
      expect(res.body).toHaveProperty('acc');
    });

    it('returns sports data for ncaa-womens dashboard', async () => {
      const res = await request(app)
        .get('/api/sports/ncaa')
        .query({ dashboard: 'ncaa-womens' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sport', 'womens');
    });

    it('returns 404 for non-existent dashboard', async () => {
      const res = await request(app)
        .get('/api/sports/ncaa')
        .query({ dashboard: 'nonexistent' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for non-sports dashboard', async () => {
      const res = await request(app)
        .get('/api/sports/ncaa')
        .query({ dashboard: 'default' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not a sports dashboard/);
    });
  });
});
