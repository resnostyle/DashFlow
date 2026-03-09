import { describe, it, expect } from 'vitest';
import { getApp } from './helpers.js';

const { db } = getApp();

describe('Database layer', () => {
  describe('dashboards', () => {
    it('returns default dashboard on init', () => {
      const all = db.getAllDashboards();
      expect(all.some((d) => d.id === 'default')).toBe(true);
    });

    it('creates and retrieves a dashboard', () => {
      const created = db.createDashboard({
        id: 'db-test',
        name: 'DB Test',
        description: 'testing',
      });
      expect(created.id).toBe('db-test');

      const fetched = db.getDashboard('db-test');
      expect(fetched).toBeTruthy();
      expect(fetched.name).toBe('DB Test');
    });

    it('creates a sports dashboard with type and sport', () => {
      const created = db.createDashboard({
        id: 'db-sports-test',
        name: 'Sports DB Test',
        description: 'sports',
        type: 'sports',
        sport: 'mens',
      });
      expect(created.type).toBe('sports');
      expect(created.sport).toBe('mens');

      const fetched = db.getDashboard('db-sports-test');
      expect(fetched.type).toBe('sports');
      expect(fetched.sport).toBe('mens');
    });

    it('updates a dashboard', () => {
      db.createDashboard({ id: 'db-update', name: 'Before' });
      const updated = db.updateDashboard('db-update', { name: 'After' });
      expect(updated.name).toBe('After');
    });

    it('deletes a dashboard', () => {
      db.createDashboard({ id: 'db-delete', name: 'Delete' });
      expect(db.deleteDashboard('db-delete')).toBe(true);
      expect(db.getDashboard('db-delete')).toBeUndefined();
    });

    it('returns null when updating non-existent dashboard', () => {
      expect(db.updateDashboard('nope', { name: 'X' })).toBeNull();
    });
  });

  describe('feeds', () => {
    it('creates and retrieves feeds for a dashboard', () => {
      db.createDashboard({ id: 'feed-db-test', name: 'Feed DB Test' });
      const feed = db.createFeed('feed-db-test', {
        name: 'Test RSS',
        url: 'https://example.com/rss',
      });
      expect(feed).toHaveProperty('id');
      expect(feed.url).toBe('https://example.com/rss');

      const feeds = db.getFeeds('feed-db-test');
      expect(feeds).toHaveLength(1);
      expect(feeds[0].name).toBe('Test RSS');
    });

    it('deletes a feed', () => {
      db.createDashboard({ id: 'feed-del-test', name: 'Feed Del' });
      const feed = db.createFeed('feed-del-test', {
        name: 'Del',
        url: 'https://example.com/del',
      });
      expect(db.deleteFeed(feed.id, 'feed-del-test')).toBe(true);
      expect(db.getFeeds('feed-del-test')).toHaveLength(0);
    });
  });

  describe('content', () => {
    it('creates and retrieves content for a dashboard', () => {
      db.createDashboard({ id: 'content-db-test', name: 'Content DB Test' });
      const item = db.createContent('content-db-test', {
        url: 'https://example.com',
        title: 'Example',
        type: 'webpage',
      });
      expect(item).toHaveProperty('id');
      expect(item.type).toBe('webpage');

      const items = db.getContent('content-db-test');
      expect(items).toHaveLength(1);
    });
  });

  describe('config', () => {
    it('returns default config values', () => {
      const config = db.getConfig('default');
      expect(config).toMatchObject({
        rotationInterval: 30000,
        tickerRefreshInterval: 300000,
        maxTickerItems: 50,
        tickerEnabled: true,
      });
    });

    it('updates config', () => {
      const updated = db.updateConfig('default', { rotationInterval: 15000 });
      expect(updated.rotationInterval).toBe(15000);
    });

    it('returns null when updating config for non-existent dashboard', () => {
      expect(db.updateConfig('nope', { rotationInterval: 5000 })).toBeNull();
    });

    it('returns and updates primaryTeamId and secondaryTeamIds', () => {
      const config = db.getConfig('ncaa-mens');
      expect(config.primaryTeamId).toBe(150);
      expect(config.secondaryTeamIds).toEqual([153, 152]);

      const updated = db.updateConfig('ncaa-mens', {
        primaryTeamId: 200,
        secondaryTeamIds: [201, 202],
      });
      expect(updated.primaryTeamId).toBe(200);
      expect(updated.secondaryTeamIds).toEqual([201, 202]);

      const refetched = db.getConfig('ncaa-mens');
      expect(refetched.primaryTeamId).toBe(200);
      expect(refetched.secondaryTeamIds).toEqual([201, 202]);
    });
  });

  describe('session store', () => {
    it('createSessionStore returns a store with get, set, destroy', () => {
      const store = db.createSessionStore();
      expect(store).toHaveProperty('get');
      expect(store).toHaveProperty('set');
      expect(store).toHaveProperty('destroy');
      expect(typeof store.get).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.destroy).toBe('function');
    });

    it('session store persists and retrieves sessions', async () => {
      const store = db.createSessionStore();
      const sid = 'test-session-' + Date.now();
      const sess = { cookie: {}, authenticated: true, role: 'admin' };

      await new Promise((resolve, reject) => {
        store.set(sid, sess, (err) => (err ? reject(err) : resolve()));
      });
      const retrieved = await new Promise((resolve, reject) => {
        store.get(sid, (err, data) => (err ? reject(err) : resolve(data)));
      });
      expect(retrieved).toBeTruthy();
      expect(retrieved.authenticated).toBe(true);

      await new Promise((resolve, reject) => {
        store.destroy(sid, (err) => (err ? reject(err) : resolve()));
      });
      const afterDestroy = await new Promise((resolve, reject) => {
        store.get(sid, (err, data) => (err ? reject(err) : resolve(data)));
      });
      expect(afterDestroy).toBeNull();
    });

    it('session store does not return expired sessions', async () => {
      const store = db.createSessionStore();
      const sid = 'expired-session-' + Date.now();
      const pastExpire = Math.floor(Date.now() / 1000) - 3600;
      const rawDb = db.getRawDb();
      rawDb.prepare('INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)').run(
        sid,
        JSON.stringify({ cookie: {}, expired: true }),
        pastExpire,
      );
      const retrieved = await new Promise((resolve, reject) => {
        store.get(sid, (err, data) => (err ? reject(err) : resolve(data)));
      });
      expect(retrieved).toBeNull();
    });

    it('cleanupExpiredSessions removes expired sessions', () => {
      const rawDb = db.getRawDb();
      const pastExpire = Math.floor(Date.now() / 1000) - 3600;
      const sid = 'cleanup-test-' + Date.now();
      rawDb.prepare('INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)').run(
        sid,
        JSON.stringify({ cookie: {} }),
        pastExpire,
      );
      const before = rawDb.prepare('SELECT COUNT(*) as c FROM sessions WHERE sid = ?').get(sid);
      expect(before.c).toBe(1);

      db.cleanupExpiredSessions();

      const after = rawDb.prepare('SELECT COUNT(*) as c FROM sessions WHERE sid = ?').get(sid);
      expect(after.c).toBe(0);
    });
  });

  describe('getSportsDashboards', () => {
    it('returns dashboards with type sports and non-null sport', () => {
      const sports = db.getSportsDashboards();
      expect(Array.isArray(sports)).toBe(true);
      expect(sports.some((d) => d.id === 'ncaa-mens')).toBe(true);
      expect(sports.some((d) => d.id === 'ncaa-womens')).toBe(true);
      sports.forEach((d) => {
        expect(d.type).toBe('sports');
        expect(d.sport).toBeTruthy();
      });
    });
  });
});
