function getDashboardId(req) {
  return req.query.dashboard || 'default';
}

module.exports = { getDashboardId };
