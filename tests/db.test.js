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
  });
});
