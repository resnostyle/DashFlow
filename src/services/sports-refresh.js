const db = require('../db');
const socket = require('../socket');

const SPORTS_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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
  const sportsDashboards = db.getSportsDashboards();
  for (const d of sportsDashboards) {
    socket.emitSportsData(io, d.id);
  }
}

module.exports = { start, stop };
