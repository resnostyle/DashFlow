const express = require('express');
const rss = require('../services/rss');

const router = express.Router();

function getDashboardId(req) {
  return req.query.dashboard || 'default';
}

router.get('/', (req, res) => {
  res.json(rss.getTickerItems(getDashboardId(req)));
});

module.exports = router;
