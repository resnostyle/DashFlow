const express = require('express');
const db = require('../db');
const espn = require('../services/espn');
const { getDashboardId } = require('../middleware');

const router = express.Router();

router.get('/ncaa', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = db.getDashboard(dashboardId);

  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  if (dashboard.type !== 'sports') {
    return res.status(400).json({ error: 'Dashboard is not a sports dashboard' });
  }
  if (!dashboard.sport || !['mens', 'womens'].includes(dashboard.sport)) {
    return res.status(400).json({ error: 'Dashboard sport must be mens or womens' });
  }

  try {
    const config = db.getConfig(dashboardId);
    const teamIds = {
      primaryTeamId: config.primaryTeamId,
      secondaryTeamIds: config.secondaryTeamIds,
    };
    const data = await espn.getNCAAData(dashboard.sport, teamIds);
    res.json(data);
  } catch (err) {
    console.error('ESPN fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch sports data' });
  }
});

module.exports = router;
