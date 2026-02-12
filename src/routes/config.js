const express = require('express');
const db = require('../db');
const rss = require('../services/rss');

const router = express.Router();

function getDashboardId(req) {
  return req.query.dashboard || 'default';
}

router.get('/', (req, res) => {
  res.json(db.getConfig(getDashboardId(req)));
});

router.post('/', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const { rotationInterval, tickerRefreshInterval, maxTickerItems, tickerEnabled } = req.body;

  const config = db.updateConfig(dashboardId, {
    rotationInterval,
    tickerRefreshInterval,
    maxTickerItems,
    tickerEnabled,
  });

  const io = req.app.get('io');

  // Handle ticker enable / disable side-effects
  if (tickerEnabled !== undefined) {
    if (!config.tickerEnabled) {
      rss.clearTickerItems(dashboardId);
      io.emit(`ticker:update:${dashboardId}`, []);
    } else {
      const feeds = db.getFeeds(dashboardId);
      if (feeds.length > 0) {
        await rss.fetchFeeds(dashboardId);
      }
    }
  }

  io.emit(`config:update:${dashboardId}`, config);

  res.json(config);
});

module.exports = router;
