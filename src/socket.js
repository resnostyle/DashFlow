const db = require('./db');
const rss = require('./services/rss');
const espn = require('./services/espn');

async function emitSportsData(io, dashboardId) {
  const dashboard = db.getDashboard(dashboardId);
  if (!dashboard || dashboard.type !== 'sports' || !dashboard.sport) return;

  try {
    const data = await espn.getNCAAData(dashboard.sport);
    io.to(`dashboard:${dashboardId}`).emit(`sports:update:${dashboardId}`, data);
  } catch (err) {
    console.error(`Error fetching sports data for ${dashboardId}:`, err.message);
  }
}

function setup(io) {
  io.on('connection', socket => {
    console.log('Client connected:', socket.id);

    socket.on('dashboard:request', async dashboardId => {
      const id = dashboardId || 'default';

      socket.join(`dashboard:${id}`);

      try {
        const dashboard = db.getDashboard(id);
        const config = db.getConfig(id);

        socket.emit(`dashboard:meta:${id}`, {
          type: dashboard?.type || 'default',
          sport: dashboard?.sport || null,
          name: dashboard?.name || id,
        });
        socket.emit(`ticker:update:${id}`, rss.getTickerItems(id));
        socket.emit(`content:update:${id}`, db.getContent(id));
        socket.emit(`config:update:${id}`, config);

        if (dashboard?.type === 'sports' && dashboard?.sport) {
          await emitSportsData(io, id);
        }
      } catch (err) {
        console.error(`Error handling dashboard:request for "${id}":`, err);
        socket.emit(`dashboard:error:${id}`, { error: 'Failed to load dashboard data' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { setup, emitSportsData };
