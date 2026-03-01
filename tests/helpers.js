import { vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Create a mock Socket.io instance that routes use via req.app.get('io').
 */
export function createMockIo() {
  const emitFn = vi.fn();
  return {
    to: vi.fn(() => ({ emit: emitFn })),
    emit: emitFn,
    _emitFn: emitFn,
  };
}

/**
 * Initialize the app with a mock io and fresh database.
 * Must be called AFTER setup.js has set process.env.DATA_DIR.
 *
 * @param {object} options
 * @param {boolean} options.mockRss - Whether to stub the rss service (default: true)
 * @param {object} options.rssOverrides - Override specific rss mock return values
 * @param {boolean} options.mockEspn - Whether to stub the espn service (default: true)
 */
export function getApp({ mockRss = true, rssOverrides = {}, mockEspn = true } = {}) {
  const db = require('../src/db');
  db.initialize();

  // Mock ESPN before loading routes that depend on it
  if (mockEspn) {
    const espn = require('../src/services/espn');
    vi.spyOn(espn, 'getNCAAData').mockImplementation((sport) =>
      Promise.resolve({
        sport: sport || 'mens',
        primary: { team: { name: 'Test Team', record: '0-0' }, lastGame: null, upcomingGames: [], nextGame: null },
        secondary: [],
        acc: { standings: [], todayGames: [] },
      }),
    );
  }

  // Load the app (and all route modules, which will load rss as a dependency)
  const app = require('../src/app');

  // Get the rss singleton (same instance the routes use)
  const rss = require('../src/services/rss');

  if (mockRss) {
    // Stub rss methods to prevent network calls
    vi.spyOn(rss, 'init').mockImplementation(() => {});
    vi.spyOn(rss, 'fetchFeeds').mockResolvedValue(rssOverrides.fetchFeeds ?? []);
    vi.spyOn(rss, 'fetchAllFeeds').mockResolvedValue(undefined);
    vi.spyOn(rss, 'startRefreshLoop').mockImplementation(() => {});
    vi.spyOn(rss, 'stopRefreshLoop').mockImplementation(() => {});
    vi.spyOn(rss, 'restartRefreshLoop').mockImplementation(() => {});
    vi.spyOn(rss, 'clearTickerItems').mockImplementation(() => {});
    vi.spyOn(rss, 'getTickerItems').mockImplementation(
      rssOverrides.getTickerItems ?? (() => []),
    );
  }

  const mockIo = createMockIo();
  app.set('io', mockIo);

  return { app, db, mockIo, rss };
}
