const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'news-ticker.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at  TEXT NOT NULL,
      type        TEXT DEFAULT 'default',
      sport       TEXT
    );
  `);

  // Migration: add type/sport to existing dashboards table
  const columns = db.prepare("PRAGMA table_info(dashboards)").all().map(r => r.name);
  if (!columns.includes('type')) {
    db.exec("ALTER TABLE dashboards ADD COLUMN type TEXT DEFAULT 'default'");
  }
  if (!columns.includes('sport')) {
    db.exec('ALTER TABLE dashboards ADD COLUMN sport TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id            TEXT PRIMARY KEY,
      dashboard_id  TEXT NOT NULL,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL,
      logo          TEXT,
      created_at    TEXT NOT NULL,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content (
      id            TEXT PRIMARY KEY,
      dashboard_id  TEXT NOT NULL,
      url           TEXT NOT NULL,
      title         TEXT NOT NULL,
      type          TEXT DEFAULT 'webpage',
      created_at    TEXT NOT NULL,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS config (
      dashboard_id             TEXT PRIMARY KEY,
      rotation_interval        INTEGER DEFAULT 30000,
      ticker_refresh_interval  INTEGER DEFAULT 300000,
      max_ticker_items         INTEGER DEFAULT 50,
      ticker_enabled           INTEGER DEFAULT 1,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
  `);

  const configCols = db.prepare('PRAGMA table_info(config)').all().map(r => r.name);
  if (!configCols.includes('primary_team_id')) {
    db.exec('ALTER TABLE config ADD COLUMN primary_team_id INTEGER');
  }
  if (!configCols.includes('secondary_team_ids')) {
    db.exec('ALTER TABLE config ADD COLUMN secondary_team_ids TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
  `);

  migrateFromJSON();
  ensureDefaultDashboard();
}

// ---------------------------------------------------------------------------
// JSON → SQLite migration (runs once when DB is empty and JSON data exists)
// ---------------------------------------------------------------------------

function migrateFromJSON() {
  const count = db.prepare('SELECT COUNT(*) as c FROM dashboards').get().c;
  if (count > 0) return;

  const dashboardsJsonPath = path.join(DATA_DIR, 'dashboards.json');
  const dashboardsDir = path.join(DATA_DIR, 'dashboards');

  const hasJsonData =
    fs.existsSync(dashboardsJsonPath) ||
    fs.existsSync(dashboardsDir) ||
    ['feeds.json', 'content.json', 'config.json'].some(f =>
      fs.existsSync(path.join(DATA_DIR, f)),
    );

  if (!hasJsonData) return;

  console.log('Migrating data from JSON files to SQLite...');

  const migrate = db.transaction(() => {
    // Collect dashboard list
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(dashboardsJsonPath, 'utf8'));
    } catch {
      /* no dashboards.json */
    }

    // Discover dashboard directories not already in the list
    if (fs.existsSync(dashboardsDir)) {
      const dirs = fs
        .readdirSync(dashboardsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const dir of dirs) {
        if (!list.find(d => d.id === dir)) {
          list.push({
            id: dir,
            name: dir.charAt(0).toUpperCase() + dir.slice(1) + ' Dashboard',
            description: '',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Handle legacy flat files → default dashboard
    if (list.length === 0) {
      list.push({
        id: 'default',
        name: 'Default Dashboard',
        description: 'Default dashboard',
        createdAt: new Date().toISOString(),
      });
    }

    const stmts = {
      dashboard: db.prepare(
        'INSERT OR IGNORE INTO dashboards (id, name, description, created_at, type, sport) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      feed: db.prepare(
        'INSERT OR IGNORE INTO feeds (id, dashboard_id, name, url, logo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      content: db.prepare(
        'INSERT OR IGNORE INTO content (id, dashboard_id, url, title, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      config: db.prepare(
        `INSERT OR IGNORE INTO config (dashboard_id, rotation_interval, ticker_refresh_interval, max_ticker_items, ticker_enabled, primary_team_id, secondary_team_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ),
    };

    for (const d of list) {
      stmts.dashboard.run(
        d.id,
        d.name || d.id,
        d.description || '',
        d.createdAt || new Date().toISOString(),
        d.type || 'default',
        d.sport || null,
      );

      const dashDir = path.join(dashboardsDir, d.id);

      // Resolve file paths (per-dashboard dir first, then legacy flat files for default)
      const resolve = file => {
        const perDash = path.join(dashDir, file);
        if (fs.existsSync(perDash)) return perDash;
        if (d.id === 'default') {
          const flat = path.join(DATA_DIR, file);
          if (fs.existsSync(flat)) return flat;
        }
        return null;
      };

      // Feeds
      const feedsPath = resolve('feeds.json');
      if (feedsPath) {
        try {
          for (const f of JSON.parse(fs.readFileSync(feedsPath, 'utf8'))) {
            stmts.feed.run(
              f.id,
              d.id,
              f.name || f.url,
              f.url,
              f.logo || null,
              f.createdAt || new Date().toISOString(),
            );
          }
        } catch { /* skip */ }
      }

      // Content
      const contentPath = resolve('content.json');
      if (contentPath) {
        try {
          for (const c of JSON.parse(fs.readFileSync(contentPath, 'utf8'))) {
            stmts.content.run(
              c.id,
              d.id,
              c.url,
              c.title || c.url,
              c.type || 'webpage',
              c.createdAt || new Date().toISOString(),
            );
          }
        } catch { /* skip */ }
      }

      // Config
      const defaults = {
        rotationInterval: 30000,
        tickerRefreshInterval: 300000,
        maxTickerItems: 50,
        tickerEnabled: true,
        primaryTeamId: null,
        secondaryTeamIds: null,
      };
      let cfg = { ...defaults };
      const cfgPath = resolve('config.json');
      if (cfgPath) {
        try {
          cfg = { ...defaults, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
        } catch { /* skip */ }
      }
      const primaryTeamId =
        cfg.primaryTeamId != null && Number.isInteger(Number(cfg.primaryTeamId))
          ? Number(cfg.primaryTeamId)
          : null;
      const secondaryTeamIds =
        Array.isArray(cfg.secondaryTeamIds) && cfg.secondaryTeamIds.length > 0
          ? JSON.stringify(cfg.secondaryTeamIds.slice(0, 2))
          : null;
      stmts.config.run(
        d.id,
        cfg.rotationInterval,
        cfg.tickerRefreshInterval,
        cfg.maxTickerItems,
        cfg.tickerEnabled !== false ? 1 : 0,
        primaryTeamId,
        secondaryTeamIds,
      );
    }
  });

  migrate();
  console.log('Migration completed successfully.');
}

function ensureDefaultDashboard() {
  const exists = db.prepare('SELECT id FROM dashboards WHERE id = ?').get('default');
  if (!exists) {
    const create = db.transaction(() => {
      db.prepare(
        'INSERT INTO dashboards (id, name, description, created_at, type, sport) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        'default',
        'Default Dashboard',
        'Default dashboard',
        new Date().toISOString(),
        'default',
        null,
      );
      db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run('default');
    });
    create();
  }
  // Ensure config row exists
  const cfgExists = db.prepare('SELECT dashboard_id FROM config WHERE dashboard_id = ?').get('default');
  if (!cfgExists) {
    db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run('default');
  }

  ensureSportsDashboards();
}

function ensureSportsDashboards() {
  const sports = [
    {
      id: 'ncaa-mens',
      name: "NCAA Men's Basketball",
      description: 'Duke, UNC, NC State, ACC',
      type: 'sports',
      sport: 'mens',
    },
    {
      id: 'ncaa-womens',
      name: "NCAA Women's Basketball",
      description: 'Duke, UNC, NC State, ACC',
      type: 'sports',
      sport: 'womens',
    },
  ];
  for (const s of sports) {
    const exists = db.prepare('SELECT id FROM dashboards WHERE id = ?').get(s.id);
    if (!exists) {
      db.prepare(
        'INSERT INTO dashboards (id, name, description, created_at, type, sport) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(s.id, s.name, s.description, new Date().toISOString(), s.type, s.sport);
      db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run(s.id);
      console.log(`Created sports dashboard: ${s.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard operations
// ---------------------------------------------------------------------------

const ROW_DASHBOARD =
  'SELECT id, name, description, created_at AS createdAt, type, sport FROM dashboards';

function getAllDashboards() {
  return db.prepare(ROW_DASHBOARD).all();
}

function getDashboard(id) {
  return db.prepare(`${ROW_DASHBOARD} WHERE id = ?`).get(id);
}

function createDashboard({ id, name, description, type, sport }) {
  const createdAt = new Date().toISOString();
  const dashType = type || 'default';
  const dashSport = sport || null;
  const create = db.transaction(() => {
    db.prepare(
      'INSERT INTO dashboards (id, name, description, created_at, type, sport) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, name || id, description || '', createdAt, dashType, dashSport);
    db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run(id);
  });
  create();
  return {
    id,
    name: name || id,
    description: description || '',
    createdAt,
    type: dashType,
    sport: dashSport,
  };
}

function updateDashboard(id, { name, description, type, sport }) {
  const row = getDashboard(id);
  if (!row) return null;

  const newName = name !== undefined ? name : row.name;
  const newDesc = description !== undefined ? description : row.description;
  const newType = type !== undefined ? type : row.type;
  const newSport = sport !== undefined ? sport : row.sport;

  db.prepare(
    'UPDATE dashboards SET name = ?, description = ?, type = ?, sport = ? WHERE id = ?',
  ).run(newName, newDesc, newType, newSport, id);
  return getDashboard(id);
}

function deleteDashboard(id) {
  return db.prepare('DELETE FROM dashboards WHERE id = ?').run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Feed operations
// ---------------------------------------------------------------------------

const ROW_FEED = 'SELECT id, name, url, logo, created_at AS createdAt FROM feeds';

function getFeeds(dashboardId) {
  return db.prepare(`${ROW_FEED} WHERE dashboard_id = ?`).all(dashboardId);
}

function createFeed(dashboardId, { name, url, logo }) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO feeds (id, dashboard_id, name, url, logo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, dashboardId, name || url, url, logo || null, createdAt);
  return { id, name: name || url, url, logo: logo || null, createdAt };
}

function updateFeed(id, dashboardId, { name, url, logo }) {
  const row = db.prepare('SELECT * FROM feeds WHERE id = ? AND dashboard_id = ?').get(
    id,
    dashboardId,
  );
  if (!row) return null;

  const newName = name !== undefined ? name : row.name;
  const newUrl = url !== undefined ? url : row.url;
  const newLogo = logo !== undefined ? (logo || null) : row.logo;

  db.prepare('UPDATE feeds SET name = ?, url = ?, logo = ? WHERE id = ?').run(
    newName,
    newUrl,
    newLogo,
    id,
  );
  return db.prepare(`${ROW_FEED} WHERE id = ?`).get(id);
}

function deleteFeed(id, dashboardId) {
  return (
    db.prepare('DELETE FROM feeds WHERE id = ? AND dashboard_id = ?').run(id, dashboardId)
      .changes > 0
  );
}

// ---------------------------------------------------------------------------
// Content operations
// ---------------------------------------------------------------------------

const ROW_CONTENT = 'SELECT id, url, title, type, created_at AS createdAt FROM content';

function getContent(dashboardId) {
  return db.prepare(`${ROW_CONTENT} WHERE dashboard_id = ?`).all(dashboardId);
}

function createContent(dashboardId, { url, title, type }) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO content (id, dashboard_id, url, title, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, dashboardId, url, title || url, type || 'webpage', createdAt);
  return { id, url, title: title || url, type: type || 'webpage', createdAt };
}

function updateContent(id, dashboardId, { url, title, type }) {
  const row = db.prepare('SELECT * FROM content WHERE id = ? AND dashboard_id = ?').get(
    id,
    dashboardId,
  );
  if (!row) return null;

  const newUrl = url !== undefined ? url : row.url;
  const newTitle = title !== undefined ? title : row.title;
  const newType = type !== undefined ? type : row.type;

  db.prepare('UPDATE content SET url = ?, title = ?, type = ? WHERE id = ?').run(
    newUrl,
    newTitle,
    newType,
    id,
  );
  return db.prepare(`${ROW_CONTENT} WHERE id = ?`).get(id);
}

function deleteContent(id, dashboardId) {
  return (
    db.prepare('DELETE FROM content WHERE id = ? AND dashboard_id = ?').run(id, dashboardId)
      .changes > 0
  );
}

// ---------------------------------------------------------------------------
// Config operations
// ---------------------------------------------------------------------------

const DEFAULT_PRIMARY_TEAM_ID = 150;
const DEFAULT_SECONDARY_TEAM_IDS = [153, 152];

function parseSecondaryTeamIds(val) {
  if (val == null || val === '') return DEFAULT_SECONDARY_TEAM_IDS;
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.slice(0, 2).map(Number).filter(n => !isNaN(n)) : DEFAULT_SECONDARY_TEAM_IDS;
  } catch {
    return DEFAULT_SECONDARY_TEAM_IDS;
  }
}

function getConfig(dashboardId) {
  const row = db
    .prepare(
      'SELECT rotation_interval, ticker_refresh_interval, max_ticker_items, ticker_enabled, primary_team_id, secondary_team_ids FROM config WHERE dashboard_id = ?',
    )
    .get(dashboardId);

  if (!row) {
    return {
      rotationInterval: 30000,
      tickerRefreshInterval: 300000,
      maxTickerItems: 50,
      tickerEnabled: true,
      primaryTeamId: DEFAULT_PRIMARY_TEAM_ID,
      secondaryTeamIds: DEFAULT_SECONDARY_TEAM_IDS,
    };
  }

  return {
    rotationInterval: row.rotation_interval,
    tickerRefreshInterval: row.ticker_refresh_interval,
    maxTickerItems: row.max_ticker_items,
    tickerEnabled: Boolean(row.ticker_enabled),
    primaryTeamId: row.primary_team_id != null ? Number(row.primary_team_id) : DEFAULT_PRIMARY_TEAM_ID,
    secondaryTeamIds: parseSecondaryTeamIds(row.secondary_team_ids),
  };
}

function updateConfig(dashboardId, updates) {
  // Verify dashboard exists to avoid FK violations
  if (!getDashboard(dashboardId)) return null;

  // Ensure config row exists
  const configExists = db
    .prepare('SELECT dashboard_id FROM config WHERE dashboard_id = ?')
    .get(dashboardId);
  if (!configExists) {
    db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run(dashboardId);
  }

  const current = getConfig(dashboardId);

  if (updates.rotationInterval !== undefined) {
    current.rotationInterval = Math.max(5000, parseInt(updates.rotationInterval) || 30000);
  }
  if (updates.tickerRefreshInterval !== undefined) {
    current.tickerRefreshInterval = Math.max(
      60000,
      parseInt(updates.tickerRefreshInterval) || 300000,
    );
  }
  if (updates.maxTickerItems !== undefined) {
    current.maxTickerItems = Math.max(10, Math.min(200, parseInt(updates.maxTickerItems) || 50));
  }
  if (updates.tickerEnabled !== undefined) {
    current.tickerEnabled = Boolean(updates.tickerEnabled);
  }
  if (updates.primaryTeamId !== undefined) {
    const v = parseInt(updates.primaryTeamId, 10);
    current.primaryTeamId = !isNaN(v) && v > 0 ? v : DEFAULT_PRIMARY_TEAM_ID;
  }
  if (updates.secondaryTeamIds !== undefined) {
    const arr = Array.isArray(updates.secondaryTeamIds)
      ? updates.secondaryTeamIds
      : [updates.secondaryTeamIds];
    current.secondaryTeamIds = arr.slice(0, 2).map(Number).filter(n => !isNaN(n) && n > 0);
    if (current.secondaryTeamIds.length === 0) current.secondaryTeamIds = DEFAULT_SECONDARY_TEAM_IDS;
  }

  db.prepare(
    'UPDATE config SET rotation_interval = ?, ticker_refresh_interval = ?, max_ticker_items = ?, ticker_enabled = ?, primary_team_id = ?, secondary_team_ids = ? WHERE dashboard_id = ?',
  ).run(
    current.rotationInterval,
    current.tickerRefreshInterval,
    current.maxTickerItems,
    current.tickerEnabled ? 1 : 0,
    current.primaryTeamId,
    JSON.stringify(current.secondaryTeamIds),
    dashboardId,
  );

  return current;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function getSportsDashboards() {
  return db
    .prepare("SELECT id, name, type, sport FROM dashboards WHERE type = 'sports' AND sport IS NOT NULL")
    .all();
}

function getTickerEnabledDashboards() {
  return db
    .prepare(
      `SELECT DISTINCT d.id
       FROM dashboards d
       JOIN config c ON d.id = c.dashboard_id
       JOIN feeds f ON d.id = f.dashboard_id
       WHERE c.ticker_enabled = 1`,
    )
    .all()
    .map(r => r.id);
}

function getMinTickerRefreshInterval() {
  const row = db
    .prepare(
      `SELECT MIN(c.ticker_refresh_interval) as min_interval
       FROM config c
       JOIN feeds f ON c.dashboard_id = f.dashboard_id
       WHERE c.ticker_enabled = 1`,
    )
    .get();
  return row?.min_interval ?? 300000;
}

function close() {
  db.close();
}

function cleanupExpiredSessions() {
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare('DELETE FROM sessions WHERE expire < ?').run(now);
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} expired session(s)`);
  }
}

/**
 * Create an express-session store that persists sessions in SQLite.
 * @returns {import('express-session').Store}
 */
function createSessionStore() {
  const Store = session.Store;
  class SQLiteStore extends Store {
    get(sid, callback) {
      try {
        const row = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?').get(
          sid,
          Math.floor(Date.now() / 1000),
        );
        callback(null, row ? JSON.parse(row.sess) : null);
      } catch (err) {
        callback(err);
      }
    }
    set(sid, sess, callback) {
      try {
        const data = JSON.stringify(sess);
        const maxAge = sess.cookie?.maxAge;
        const expire = maxAge
          ? Math.floor(Date.now() / 1000) + Math.floor(maxAge / 1000)
          : Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24h default
        db.prepare(
          'INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)',
        ).run(sid, data, expire);
        callback(null);
      } catch (err) {
        callback(err);
      }
    }
    destroy(sid, callback) {
      try {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        callback(null);
      } catch (err) {
        callback(err);
      }
    }
    touch(sid, sess, callback) {
      this.set(sid, sess, callback);
    }
  }
  return new SQLiteStore();
}

/** Expose raw db for tests (e.g. inserting expired sessions). */
function getRawDb() {
  return db;
}

module.exports = {
  initialize,
  close,
  cleanupExpiredSessions,
  createSessionStore,
  getRawDb,
  getAllDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  getFeeds,
  createFeed,
  updateFeed,
  deleteFeed,
  getContent,
  createContent,
  updateContent,
  deleteContent,
  getConfig,
  updateConfig,
  getSportsDashboards,
  getTickerEnabledDashboards,
  getMinTickerRefreshInterval,
};
