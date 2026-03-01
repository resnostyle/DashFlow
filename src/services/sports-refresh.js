const db = require('../db');
const socket = require('../socket');

const SPORTS_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

let refreshInterval = null;

function refreshSportsData(io) {
  const sportsDashboards = db.getSportsDashboards();
  for (const d of sportsDashboards) {
    socket.emitSportsData(io, d.id);
  }
}

function start(io) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshSportsData(io);
  refreshInterval = setInterval(() => refreshSportsData(io), SPORTS_REFRESH_MS);
}

function stop() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

module.exports = { start, stop, refreshSportsData };
