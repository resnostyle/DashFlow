const express = require('express');
const db = require('../db');
const { getDashboardId } = require('../middleware');
const { validateFetchUrl } = require('../utils/urlValidation');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getContent(getDashboardId(req)));
});

router.post('/', (req, res) => {
  const dashboardId = getDashboardId(req);
  const { url, title, type } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  const urlCheck = validateFetchUrl(url);
  if (!urlCheck.valid) {
    return res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
  }

  if (!db.getDashboard(dashboardId)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  const item = db.createContent(dashboardId, { url, title, type });

  const io = req.app.get('io');
  io.to(`dashboard:${dashboardId}`).emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.status(201).json(item);
});

router.put('/:id', (req, res) => {
  const dashboardId = getDashboardId(req);
  const { url, title, type } = req.body;

  if (url) {
    const urlCheck = validateFetchUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.error || 'Invalid URL' });
    }
  }

  const item = db.updateContent(req.params.id, dashboardId, { url, title, type });
  if (!item) {
    return res.status(404).json({ error: 'Content not found' });
  }

  const io = req.app.get('io');
  io.to(`dashboard:${dashboardId}`).emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.json(item);
});

router.delete('/:id', (req, res) => {
  const dashboardId = getDashboardId(req);

  if (!db.deleteContent(req.params.id, dashboardId)) {
    return res.status(404).json({ error: 'Content not found' });
  }

  const io = req.app.get('io');
  io.to(`dashboard:${dashboardId}`).emit(`content:update:${dashboardId}`, db.getContent(dashboardId));

  res.json({ message: 'Content deleted' });
});

module.exports = router;
