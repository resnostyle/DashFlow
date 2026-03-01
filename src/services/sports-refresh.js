const db = require('../db');
const socket = require('../socket');

const SPORTS_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

<<<<<<< HEAD
let interval = null;

function start(io) {
  if (interval) clearInterval(interval);
  refresh(io);
  interval = setInterval(() => refresh(io), SPORTS_REFRESH_MS);
}

function stop() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function refresh(io) {
=======
let refreshInterval = null;

function refreshSportsData(io) {
>>>>>>> 8765196 (so much cruft has been built, time to revamp and clean up)
  const sportsDashboards = db.getSportsDashboards();
  for (const d of sportsDashboards) {
    socket.emitSportsData(io, d.id);
  }
}

<<<<<<< HEAD
module.exports = { start, stop };
=======
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
>>>>>>> 8765196 (so much cruft has been built, time to revamp and clean up)
