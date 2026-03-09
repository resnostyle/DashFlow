import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

const { app, rss } = getApp();

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

    it('returns default primaryTeamId and secondaryTeamIds for sports dashboard', async () => {
      const res = await request(app)
        .get('/api/config')
        .query({ dashboard: 'ncaa-mens' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('primaryTeamId', 150);
      expect(res.body).toHaveProperty('secondaryTeamIds');
      expect(res.body.secondaryTeamIds).toEqual([153, 152]);
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

    it('calls restartRefreshLoop when tickerRefreshInterval changes', async () => {
      rss.restartRefreshLoop.mockClear();
      await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerRefreshInterval: 180000 });
      expect(rss.restartRefreshLoop).toHaveBeenCalled();
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

    it('coerces tickerEnabled from string "true" and "false"', async () => {
      const resTrue = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: 'true' });
      expect(resTrue.status).toBe(200);
      expect(resTrue.body.tickerEnabled).toBe(true);

      const resFalse = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: 'false' });
      expect(resFalse.status).toBe(200);
      expect(resFalse.body.tickerEnabled).toBe(false);
    });

    it('coerces tickerEnabled from number 1 and 0', async () => {
      const resOne = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: 1 });
      expect(resOne.status).toBe(200);
      expect(resOne.body.tickerEnabled).toBe(true);

      const resZero = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: 0 });
      expect(resZero.status).toBe(200);
      expect(resZero.body.tickerEnabled).toBe(false);
    });

    it('coerces tickerEnabled from string "1" and "0"', async () => {
      const resOne = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: '1' });
      expect(resOne.status).toBe(200);
      expect(resOne.body.tickerEnabled).toBe(true);

      const resZero = await request(app)
        .post('/api/config')
        .query({ dashboard: 'default' })
        .send({ tickerEnabled: '0' });
      expect(resZero.status).toBe(200);
      expect(resZero.body.tickerEnabled).toBe(false);
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

    it('updates primaryTeamId for sports dashboard', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'ncaa-mens' })
        .send({ primaryTeamId: 151 });
      expect(res.status).toBe(200);
      expect(res.body.primaryTeamId).toBe(151);

      const getRes = await request(app)
        .get('/api/config')
        .query({ dashboard: 'ncaa-mens' });
      expect(getRes.body.primaryTeamId).toBe(151);
    });

    it('updates secondaryTeamIds for sports dashboard', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'ncaa-mens' })
        .send({ secondaryTeamIds: [152, 154] });
      expect(res.status).toBe(200);
      expect(res.body.secondaryTeamIds).toEqual([152, 154]);

      const getRes = await request(app)
        .get('/api/config')
        .query({ dashboard: 'ncaa-mens' });
      expect(getRes.body.secondaryTeamIds).toEqual([152, 154]);
    });

    it('returns 400 for invalid primaryTeamId', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'ncaa-mens' })
        .send({ primaryTeamId: 'not-a-number' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid secondaryTeamIds', async () => {
      const res = await request(app)
        .post('/api/config')
        .query({ dashboard: 'ncaa-mens' })
        .send({ secondaryTeamIds: [] });
      expect(res.status).toBe(400);
    });

    it('calls scheduleDashboard when enabling ticker for dashboard with feeds', async () => {
      await request(app)
        .post('/api/dashboards')
        .send({ id: 'config-schedule-test', name: 'Config Schedule Test' });
      await request(app)
        .post('/api/feeds')
        .query({ dashboard: 'config-schedule-test' })
        .send({ url: 'https://example.com/config-feed' });
      await request(app)
        .post('/api/config')
        .query({ dashboard: 'config-schedule-test' })
        .send({ tickerEnabled: false });

      rss.scheduleDashboard.mockClear();
      await request(app)
        .post('/api/config')
        .query({ dashboard: 'config-schedule-test' })
        .send({ tickerEnabled: true });

      expect(rss.scheduleDashboard).toHaveBeenCalledWith('config-schedule-test');
    });
  });
});
