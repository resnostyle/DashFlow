const Parser = require('rss-parser');
const db = require('../db');
const { validateFetchUrl } = require('../utils/urlValidation');

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent', { keepArray: true }],
    ],
  },
});

function extractImageUrl(item) {
  if (item.enclosure?.url && /^image\//i.test(item.enclosure.type || '')) {
    return item.enclosure.url;
  }
  const thumb = item.mediaThumbnail;
  if (thumb?.$?.url) return thumb.$.url;
  if (typeof thumb === 'string') return thumb;
  const media = item.mediaContent;
  if (Array.isArray(media) && media[0]?.$?.url) return media[0].$.url;
  const content = item.content || item['content:encoded'] || '';
  if (typeof content === 'string') {
    const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1];
  }
  return null;
}

let io = null;

// Per-dashboard refresh timers
const dashboardTimers = new Map();

// In-memory ticker items keyed by dashboard ID (transient, not persisted)
const tickerItems = {};
const lastFetchTime = {};

// Feed health: { [feedId]: { lastSuccess, lastError, errorCount } }
const feedHealth = {};

function init(socketIo) {
  io = socketIo;
}

function getTickerItems(dashboardId) {
  return tickerItems[dashboardId] || [];
}

function unscheduleDashboard(dashboardId) {
  const timer = dashboardTimers.get(dashboardId);
  if (timer) {
    clearInterval(timer);
    dashboardTimers.delete(dashboardId);
  }
}

function scheduleDashboard(dashboardId) {
  unscheduleDashboard(dashboardId);

  const feeds = db.getFeeds(dashboardId);
  const config = db.getConfig(dashboardId);

  if (!config.tickerEnabled || feeds.length === 0) {
    return;
  }

  const intervalMs = Math.max(60000, config.tickerRefreshInterval);
  const timer = setInterval(() => fetchFeeds(dashboardId), intervalMs);
  dashboardTimers.set(dashboardId, timer);
}

function clearTickerItems(dashboardId, feedIdsToClear = null) {
  delete tickerItems[dashboardId];
  delete lastFetchTime[dashboardId];
  unscheduleDashboard(dashboardId);
  const ids = feedIdsToClear ?? db.getFeeds(dashboardId).map(f => f.id);
  for (const fid of ids) {
    delete feedHealth[fid];
  }
}

function getFeedHealth(dashboardId) {
  const feeds = db.getFeeds(dashboardId);
  const result = {};
  for (const f of feeds) {
    const h = feedHealth[f.id];
    result[f.id] = h
      ? {
          lastSuccess: h.lastSuccess,
          lastError: h.lastError,
          errorCount: h.errorCount,
        }
      : { lastSuccess: null, lastError: null, errorCount: 0 };
  }
  return result;
}

function clearFeedHealth(feedId) {
  delete feedHealth[feedId];
}

function emitToDashboard(dashboardId, event, data) {
  if (io) io.to(`dashboard:${dashboardId}`).emit(event, data);
}

async function fetchFeeds(dashboardId) {
  const feeds = db.getFeeds(dashboardId);
  const config = db.getConfig(dashboardId);

  if (!config.tickerEnabled) {
    tickerItems[dashboardId] = [];
    emitToDashboard(dashboardId, `ticker:update:${dashboardId}`, []);
    return [];
  }

  const allItems = [];
  const feedPromises = feeds.map(async feed => {
    const urlCheck = validateFetchUrl(feed.url);
    if (!urlCheck.valid) {
      console.error(
        `Skipping feed ${feed.url} for dashboard ${dashboardId}: ${urlCheck.error}`,
      );
      return [];
    }
    try {
      const feedData = await parser.parseURL(feed.url);
      feedHealth[feed.id] = {
        lastSuccess: Date.now(),
        lastError: null,
        errorCount: feedHealth[feed.id]?.errorCount ?? 0,
      };
      if (feedData?.items) {
        return feedData.items.map(item => ({
          id: `${feed.id}-${item.guid || item.link || Date.now()}`,
          title: item.title || 'No title',
          link: item.link || '',
          pubDate: item.pubDate || new Date().toISOString(),
          feedName: feed.name || feed.url,
          feedId: feed.id,
          feedLogo: feed.logo || null,
          image: extractImageUrl(item) || null,
          contentSnippet: item.contentSnippet || null,
        }));
      }
    } catch (error) {
      const prev = feedHealth[feed.id] || { errorCount: 0 };
      feedHealth[feed.id] = {
        lastSuccess: prev.lastSuccess ?? null,
        lastError: error.message,
        errorCount: prev.errorCount + 1,
      };
      console.error(
        `Error fetching feed ${feed.url} for dashboard ${dashboardId}:`,
        error.message,
      );
    }
    return [];
  });

  const results = await Promise.allSettled(feedPromises);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  tickerItems[dashboardId] = allItems.slice(0, config.maxTickerItems);
  lastFetchTime[dashboardId] = Date.now();

  emitToDashboard(dashboardId, `ticker:update:${dashboardId}`, tickerItems[dashboardId]);

  return tickerItems[dashboardId];
}

async function fetchAllFeeds() {
  const dashboardIds = db.getTickerEnabledDashboards();
  await Promise.all(dashboardIds.map(id => fetchFeeds(id)));
}

function startRefreshLoop() {
  const dashboardIds = db.getTickerEnabledDashboards();
  for (const id of dashboardIds) {
    scheduleDashboard(id);
  }
}

function stopRefreshLoop() {
  for (const id of [...dashboardTimers.keys()]) {
    unscheduleDashboard(id);
  }
}

function restartRefreshLoop() {
  stopRefreshLoop();
  startRefreshLoop();
}

module.exports = {
  init,
  getTickerItems,
  getFeedHealth,
  clearFeedHealth,
  clearTickerItems,
  fetchFeeds,
  fetchAllFeeds,
  startRefreshLoop,
  stopRefreshLoop,
  restartRefreshLoop,
  scheduleDashboard,
};
