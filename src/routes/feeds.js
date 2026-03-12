const express = require('express');
const db = require('../db');
const rss = require('../services/rss');
const { getDashboardId } = require('../middleware');
const { validateFetchUrl } = require('../utils/urlValidation');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getFeeds(getDashboardId(req)));
});

router.get('/health', (req, res) => {
  const dashboardId = getDashboardId(req);
  if (!db.getDashboard(dashboardId)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  res.json(rss.getFeedHealth(dashboardId));
});

router.post('/', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const { name, url, logo } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  const urlCheck = validateFetchUrl(url);
  if (!urlCheck.valid) {
    return res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
  }
  if (logo) {
    const logoCheck = validateFetchUrl(logo);
    if (!logoCheck.valid) {
      return res.status(400).json({ error: logoCheck.error || 'Invalid logo URL' });
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
    rss.scheduleDashboard(dashboardId);
  }

  res.status(201).json(feed);
});

router.put('/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const { name, url, logo } = req.body;

  if (url) {
    const urlCheck = validateFetchUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
    }
  }
  if (logo) {
    const logoCheck = validateFetchUrl(logo);
    if (!logoCheck.valid) {
      return res.status(400).json({ error: logoCheck.error || 'Invalid logo URL' });
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
    rss.scheduleDashboard(dashboardId);
  }

  res.json(feed);
});

router.delete('/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);

  const deletedFeedId = req.params.id;
  if (!db.deleteFeed(deletedFeedId, dashboardId)) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  rss.clearFeedHealth(deletedFeedId);

  const feedsLeft = db.getFeeds(dashboardId);
  if (feedsLeft.length > 0 && db.getConfig(dashboardId).tickerEnabled) {
    try {
      await rss.fetchFeeds(dashboardId);
    } catch (err) {
      console.error(`Failed to refresh feeds for dashboard ${dashboardId}:`, err.message);
    }
    rss.scheduleDashboard(dashboardId);
  } else {
    rss.clearTickerItems(dashboardId);
  }

  res.json({ message: 'Feed deleted' });
});

module.exports = router;
