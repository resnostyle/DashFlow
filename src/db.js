const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
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
      created_at  TEXT NOT NULL
    );

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
        'INSERT OR IGNORE INTO dashboards (id, name, description, created_at) VALUES (?, ?, ?, ?)',
      ),
      feed: db.prepare(
        'INSERT OR IGNORE INTO feeds (id, dashboard_id, name, url, logo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      content: db.prepare(
        'INSERT OR IGNORE INTO content (id, dashboard_id, url, title, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ),
      config: db.prepare(
        'INSERT OR IGNORE INTO config (dashboard_id, rotation_interval, ticker_refresh_interval, max_ticker_items, ticker_enabled) VALUES (?, ?, ?, ?, ?)',
      ),
    };

    for (const d of list) {
      stmts.dashboard.run(
        d.id,
        d.name || d.id,
        d.description || '',
        d.createdAt || new Date().toISOString(),
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
      };
      let cfg = { ...defaults };
      const cfgPath = resolve('config.json');
      if (cfgPath) {
        try {
          cfg = { ...defaults, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
        } catch { /* skip */ }
      }
      stmts.config.run(
        d.id,
        cfg.rotationInterval,
        cfg.tickerRefreshInterval,
        cfg.maxTickerItems,
        cfg.tickerEnabled !== false ? 1 : 0,
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
        'INSERT INTO dashboards (id, name, description, created_at) VALUES (?, ?, ?, ?)',
      ).run('default', 'Default Dashboard', 'Default dashboard', new Date().toISOString());
      db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run('default');
    });
    create();
  }
  // Ensure config row exists
  const cfgExists = db.prepare('SELECT dashboard_id FROM config WHERE dashboard_id = ?').get('default');
  if (!cfgExists) {
    db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run('default');
  }
}

// ---------------------------------------------------------------------------
// Dashboard operations
// ---------------------------------------------------------------------------

const ROW_DASHBOARD = 'SELECT id, name, description, created_at AS createdAt FROM dashboards';

function getAllDashboards() {
  return db.prepare(ROW_DASHBOARD).all();
}

function getDashboard(id) {
  return db.prepare(`${ROW_DASHBOARD} WHERE id = ?`).get(id);
}

function createDashboard({ id, name, description }) {
  const createdAt = new Date().toISOString();
  const create = db.transaction(() => {
    db.prepare(
      'INSERT INTO dashboards (id, name, description, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, name || id, description || '', createdAt);
    db.prepare('INSERT INTO config (dashboard_id) VALUES (?)').run(id);
  });
  create();
  return { id, name: name || id, description: description || '', createdAt };
}

function updateDashboard(id, { name, description }) {
  const row = getDashboard(id);
  if (!row) return null;

  const newName = name !== undefined ? name : row.name;
  const newDesc = description !== undefined ? description : row.description;

  db.prepare('UPDATE dashboards SET name = ?, description = ? WHERE id = ?').run(
    newName,
    newDesc,
    id,
  );
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

function getConfig(dashboardId) {
  const row = db
    .prepare(
      'SELECT rotation_interval, ticker_refresh_interval, max_ticker_items, ticker_enabled FROM config WHERE dashboard_id = ?',
    )
    .get(dashboardId);

  if (!row) {
    return {
      rotationInterval: 30000,
      tickerRefreshInterval: 300000,
      maxTickerItems: 50,
      tickerEnabled: true,
    };
  }

  return {
    rotationInterval: row.rotation_interval,
    tickerRefreshInterval: row.ticker_refresh_interval,
    maxTickerItems: row.max_ticker_items,
    tickerEnabled: Boolean(row.ticker_enabled),
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

  db.prepare(
    'UPDATE config SET rotation_interval = ?, ticker_refresh_interval = ?, max_ticker_items = ?, ticker_enabled = ? WHERE dashboard_id = ?',
  ).run(
    current.rotationInterval,
    current.tickerRefreshInterval,
    current.maxTickerItems,
    current.tickerEnabled ? 1 : 0,
    dashboardId,
  );

  return current;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

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

module.exports = {
  initialize,
  close,
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
  getTickerEnabledDashboards,
  getMinTickerRefreshInterval,
};
