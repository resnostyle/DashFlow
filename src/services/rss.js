const Parser = require('rss-parser');
const db = require('../db');

const parser = new Parser();

let io = null;
let refreshInterval = null;

// In-memory ticker items keyed by dashboard ID (transient, not persisted)
const tickerItems = {};

function init(socketIo) {
  io = socketIo;
}

function getTickerItems(dashboardId) {
  return tickerItems[dashboardId] || [];
}

function clearTickerItems(dashboardId) {
  delete tickerItems[dashboardId];
}

async function fetchFeeds(dashboardId) {
  const feeds = db.getFeeds(dashboardId);
  const config = db.getConfig(dashboardId);

  if (!config.tickerEnabled) {
    tickerItems[dashboardId] = [];
    if (io) io.emit(`ticker:update:${dashboardId}`, []);
    return [];
  }

  const allItems = [];

  for (const feed of feeds) {
    try {
      const feedData = await parser.parseURL(feed.url);
      if (feedData.items) {
        for (const item of feedData.items) {
          allItems.push({
            id: `${feed.id}-${item.guid || item.link || Date.now()}`,
            title: item.title || 'No title',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            feedName: feed.name || feed.url,
            feedId: feed.id,
            feedLogo: feed.logo || null,
          });
        }
      }
    } catch (error) {
      console.error(
        `Error fetching feed ${feed.url} for dashboard ${dashboardId}:`,
        error.message,
      );
    }
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  tickerItems[dashboardId] = allItems.slice(0, config.maxTickerItems);

  if (io) io.emit(`ticker:update:${dashboardId}`, tickerItems[dashboardId]);

  return tickerItems[dashboardId];
}

async function fetchAllFeeds() {
  const dashboardIds = db.getTickerEnabledDashboards();
  for (const id of dashboardIds) {
    await fetchFeeds(id);
  }
}

function startRefreshLoop(intervalMs = 300000) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => fetchAllFeeds(), intervalMs);
}

function stopRefreshLoop() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

module.exports = {
  init,
  getTickerItems,
  clearTickerItems,
  fetchFeeds,
  fetchAllFeeds,
  startRefreshLoop,
  stopRefreshLoop,
};
