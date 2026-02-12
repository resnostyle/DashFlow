const express = require('express');
const rss = require('../services/rss');
const { getDashboardId } = require('../middleware');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(rss.getTickerItems(getDashboardId(req)));
});

module.exports = router;
