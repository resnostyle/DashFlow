const db = require('./db');
const rss = require('./services/rss');

function setup(io) {
  io.on('connection', socket => {
    console.log('Client connected:', socket.id);

    socket.on('dashboard:request', dashboardId => {
      const id = dashboardId || 'default';

      socket.join(`dashboard:${id}`);

      try {
        const config = db.getConfig(id);

        socket.emit(`ticker:update:${id}`, rss.getTickerItems(id));
        socket.emit(`content:update:${id}`, db.getContent(id));
        socket.emit(`config:update:${id}`, config);
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

module.exports = { setup };
