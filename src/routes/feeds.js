const express = require('express');
const db = require('../db');
const rss = require('../services/rss');
const { getDashboardId } = require('../middleware');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getFeeds(getDashboardId(req)));
});

router.post('/', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const { name, url, logo } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  if (logo) {
    try {
      new URL(logo);
    } catch {
      return res.status(400).json({ error: 'Invalid logo URL format' });
    }
  }

  if (!db.getDashboard(dashboardId)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const feed = db.createFeed(dashboardId, { name, url, logo });

  if (db.getConfig(dashboardId).tickerEnabled) {
    try {
      await rss.fetchFeeds(dashboardId);
    } catch (err) {
      console.error(`Failed to refresh feeds for dashboard ${dashboardId}:`, err.message);
    }
  }

  res.status(201).json(feed);
});

router.put('/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const { name, url, logo } = req.body;

  if (url) {
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  }
  if (logo) {
    try {
      new URL(logo);
    } catch {
      return res.status(400).json({ error: 'Invalid logo URL format' });
    }
  }

  const feed = db.updateFeed(req.params.id, dashboardId, { name, url, logo });
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (db.getConfig(dashboardId).tickerEnabled) {
    try {
      await rss.fetchFeeds(dashboardId);
    } catch (err) {
      console.error(`Failed to refresh feeds for dashboard ${dashboardId}:`, err.message);
    }
  }

  res.json(feed);
});

router.delete('/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);

  if (!db.deleteFeed(req.params.id, dashboardId)) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (db.getConfig(dashboardId).tickerEnabled) {
    try {
      await rss.fetchFeeds(dashboardId);
    } catch (err) {
      console.error(`Failed to refresh feeds for dashboard ${dashboardId}:`, err.message);
    }
  }

  res.json({ message: 'Feed deleted' });
});

module.exports = router;
