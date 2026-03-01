const db = require('../db');
const socket = require('../socket');

const SPORTS_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

let refreshInterval = null;

async function refreshSportsData(io) {
  const sportsDashboards = db.getSportsDashboards();
  for (const d of sportsDashboards) {
    try {
      await socket.emitSportsData(io, d.id);
    } catch (err) {
      console.error(`Error refreshing sports data for dashboard ${d.id}:`, err.message);
    }
  }
}

function start(io) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshSportsData(io).catch((err) =>
    console.error('Error in initial sports refresh:', err.message),
  );
  refreshInterval = setInterval(
    () => refreshSportsData(io).catch((err) => console.error('Error in sports refresh:', err.message)),
    SPORTS_REFRESH_MS,
  );
}

function stop() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

module.exports = { start, stop, refreshSportsData };
