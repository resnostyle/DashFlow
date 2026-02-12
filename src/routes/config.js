const express = require('express');
const db = require('../db');
const rss = require('../services/rss');
const { getDashboardId } = require('../middleware');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getConfig(getDashboardId(req)));
});

router.post('/', async (req, res) => {
  const dashboardId = getDashboardId(req);

  if (!db.getDashboard(dashboardId)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const { rotationInterval, tickerRefreshInterval, maxTickerItems, tickerEnabled } = req.body;

  // Validate and coerce incoming fields
  const validated = {};
  const errors = [];

  if (rotationInterval !== undefined) {
    const v = Number(rotationInterval);
    if (!Number.isInteger(v) || v <= 0) {
      errors.push('rotationInterval must be a positive integer');
    } else {
      validated.rotationInterval = v;
    }
  }

  if (tickerRefreshInterval !== undefined) {
    const v = Number(tickerRefreshInterval);
    if (!Number.isInteger(v) || v <= 0) {
      errors.push('tickerRefreshInterval must be a positive integer');
    } else {
      validated.tickerRefreshInterval = v;
    }
  }

  if (maxTickerItems !== undefined) {
    const v = Number(maxTickerItems);
    if (!Number.isInteger(v) || v < 0) {
      errors.push('maxTickerItems must be a non-negative integer');
    } else {
      validated.maxTickerItems = v;
    }
  }

  if (tickerEnabled !== undefined) {
    if (typeof tickerEnabled !== 'boolean') {
      errors.push('tickerEnabled must be a boolean');
    } else {
      validated.tickerEnabled = tickerEnabled;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const config = db.updateConfig(dashboardId, validated);

  if (!config) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const io = req.app.get('io');

  // Handle ticker enable / disable side-effects
  if (validated.tickerEnabled !== undefined) {
    if (!config.tickerEnabled) {
      rss.clearTickerItems(dashboardId);
      io.to(`dashboard:${dashboardId}`).emit(`ticker:update:${dashboardId}`, []);
    } else {
      const feeds = db.getFeeds(dashboardId);
      if (feeds.length > 0) {
        try {
          await rss.fetchFeeds(dashboardId);
        } catch (err) {
          console.error(`Failed to refresh feeds for dashboard ${dashboardId}:`, err.message);
        }
      }
    }
  }

  if (validated.tickerRefreshInterval !== undefined) {
    rss.restartRefreshLoop();
  }

  io.to(`dashboard:${dashboardId}`).emit(`config:update:${dashboardId}`, config);

  res.json(config);
});

module.exports = router;
