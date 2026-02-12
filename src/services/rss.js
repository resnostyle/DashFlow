const Parser = require('rss-parser');
const db = require('../db');

const parser = new Parser();

let io = null;
let refreshInterval = null;

// In-memory ticker items keyed by dashboard ID (transient, not persisted)
const tickerItems = {};
const lastFetchTime = {};

function init(socketIo) {
  io = socketIo;
}

function getTickerItems(dashboardId) {
  return tickerItems[dashboardId] || [];
}

function clearTickerItems(dashboardId) {
  delete tickerItems[dashboardId];
  delete lastFetchTime[dashboardId];
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
    try {
      const feedData = await parser.parseURL(feed.url);
      if (feedData?.items) {
        return feedData.items.map(item => ({
          id: `${feed.id}-${item.guid || item.link || Date.now()}`,
          title: item.title || 'No title',
          link: item.link || '',
          pubDate: item.pubDate || new Date().toISOString(),
          feedName: feed.name || feed.url,
          feedId: feed.id,
          feedLogo: feed.logo || null,
        }));
      }
    } catch (error) {
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
  const now = Date.now();

  const toFetch = [];
  for (const id of dashboardIds) {
    const config = db.getConfig(id);
    const lastFetch = lastFetchTime[id] ?? 0;
    if (now - lastFetch >= config.tickerRefreshInterval) {
      toFetch.push(id);
    }
  }

  await Promise.all(toFetch.map(id => fetchFeeds(id)));
}

function startRefreshLoop() {
  if (refreshInterval) clearInterval(refreshInterval);
  const intervalMs = Math.max(60000, db.getMinTickerRefreshInterval());
  refreshInterval = setInterval(() => fetchAllFeeds(), intervalMs);
}

function stopRefreshLoop() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function restartRefreshLoop() {
  stopRefreshLoop();
  startRefreshLoop();
}

module.exports = {
  init,
  getTickerItems,
  clearTickerItems,
  fetchFeeds,
  fetchAllFeeds,
  startRefreshLoop,
  stopRefreshLoop,
  restartRefreshLoop,
};
