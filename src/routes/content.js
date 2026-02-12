const express = require('express');
const db = require('../db');

const router = express.Router();

function getDashboardId(req) {
  return req.query.dashboard || 'default';
}

router.get('/', (req, res) => {
  res.json(db.getContent(getDashboardId(req)));
});

router.post('/', (req, res) => {
  const dashboardId = getDashboardId(req);
  const { url, title, type } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (!db.getDashboard(dashboardId)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const item = db.createContent(dashboardId, { url, title, type });

  const io = req.app.get('io');
  io.emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const dashboardId = getDashboardId(req);
  const { url, title, type } = req.body;

  if (url) {
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  }

  const item = db.updateContent(req.params.id, dashboardId, { url, title, type });
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }

  const io = req.app.get('io');
  io.emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.json(item);
});

router.delete('/:id', (req, res) => {
  const dashboardId = getDashboardId(req);

  if (!db.deleteContent(req.params.id, dashboardId)) {
    return res.status(404).json({ error: 'Content not found' });
  }

  const io = req.app.get('io');
  io.emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.json({ message: 'Content deleted' });
});

module.exports = router;
