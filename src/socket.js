const db = require('./db');
const rss = require('./services/rss');

function setup(io) {
  io.on('connection', socket => {
    console.log('Client connected:', socket.id);

    socket.on('dashboard:request', dashboardId => {
      const id = dashboardId || 'default';
      const config = db.getConfig(id);

      socket.emit(`ticker:update:${id}`, rss.getTickerItems(id));
      socket.emit(`content:update:${id}`, db.getContent(id));
      socket.emit(`config:update:${id}`, config);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { setup };
