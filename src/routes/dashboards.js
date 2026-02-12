const express = require('express');
const db = require('../db');
const rss = require('../services/rss');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(db.getAllDashboards());
});

router.post('/', (req, res) => {
  const { id, name, description } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Dashboard ID is required' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res
      .status(400)
      .json({
        error:
          'Invalid dashboard ID format. Use only letters, numbers, dashes, and underscores.',
      });
  }
  if (db.getDashboard(id)) {
    return res.status(409).json({ error: 'Dashboard with this ID already exists' });
  }

  const dashboard = db.createDashboard({ id, name, description });
  res.status(201).json(dashboard);
});

router.get('/:id', (req, res) => {
  const dashboard = db.getDashboard(req.params.id);
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  res.json(dashboard);
});

router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const dashboard = db.updateDashboard(req.params.id, { name, description });
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  res.json(dashboard);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  if (id === 'default') {
    return res.status(400).json({ error: 'Cannot delete default dashboard' });
  }
  if (!db.deleteDashboard(id)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  rss.clearTickerItems(id);
  res.json({ message: 'Dashboard deleted' });
});

module.exports = router;
