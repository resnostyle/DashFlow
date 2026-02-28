import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';

describe('Admin authentication', () => {
  let app;

  beforeAll(() => {
    process.env.ADMIN_PASSWORD = 'test-secret';
    const result = getApp();
    app = result.app;
  });

  afterAll(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  describe('when unauthenticated', () => {
    it('GET /admin redirects to /admin/login', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin/login');
    });

    it('GET /api/dashboards returns 401', async () => {
      const res = await request(app).get('/api/dashboards');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('POST /api/dashboards returns 401', async () => {
      const res = await request(app)
        .post('/api/dashboards')
        .send({ id: 'auth-test', name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('GET /api/feeds returns 401', async () => {
      const res = await request(app).get('/api/feeds');
      expect(res.status).toBe(401);
    });

    it('GET /api/config returns 401', async () => {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(401);
    });

    it('GET /health remains public and returns 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /admin/login', () => {
    it('returns 200 and serves login page when unauthenticated', async () => {
      const res = await request(app).get('/admin/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Admin Login');
      expect(res.text).toContain('password');
    });

    it('redirects to /admin when already authenticated', async () => {
      const agent = request.agent(app);
      await agent.post('/admin/login').send({ password: 'test-secret' });
      const res = await agent.get('/admin/login');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin');
    });
  });

  describe('POST /admin/login', () => {
    it('redirects to /admin/login?error=invalid for wrong password', async () => {
      const res = await request(app)
        .post('/admin/login')
        .send({ password: 'wrong' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin/login?error=invalid');
    });

    it('redirects to /admin for correct password and sets session', async () => {
      const agent = request.agent(app);
      const loginRes = await agent.post('/admin/login').send({ password: 'test-secret' });
      expect(loginRes.status).toBe(302);
      expect(loginRes.headers.location).toBe('/admin');
    });

    it('allows authenticated access to /admin after login', async () => {
      const agent = request.agent(app);
      await agent.post('/admin/login').send({ password: 'test-secret' });
      const res = await agent.get('/admin');
      expect(res.status).toBe(200);
      expect(res.text).toContain('News Ticker Admin');
    });

    it('allows authenticated access to API after login', async () => {
      const agent = request.agent(app);
      await agent.post('/admin/login').send({ password: 'test-secret' });
      const res = await agent.get('/api/dashboards');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((d) => d.id === 'default')).toBe(true);
    });
  });
});

describe('Admin authentication (disabled)', () => {
  let app;

  beforeAll(() => {
    delete process.env.ADMIN_PASSWORD;
    const result = getApp();
    app = result.app;
  });

  it('GET /admin returns 200 without login when ADMIN_PASSWORD is not set', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(res.text).toContain('News Ticker Admin');
  });

  it('GET /api/dashboards returns 200 without login when ADMIN_PASSWORD is not set', async () => {
    const res = await request(app).get('/api/dashboards');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/login returns 200 and serves login page', async () => {
    const res = await request(app).get('/admin/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Admin Login');
  });

  it('POST /admin/login redirects to /admin when ADMIN_PASSWORD is not set', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ password: 'anything' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });
});
