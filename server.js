const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const db = require('./src/db');
const rss = require('./src/services/rss');
const socket = require('./src/socket');

const PORT = process.env.PORT || 3000;

// Initialize database (creates tables, migrates JSON data if needed)
db.initialize();

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Make io available to route handlers via req.app.get('io')
app.set('io', io);

// Wire up services
rss.init(io);
socket.setup(io);

// Initial RSS fetch then start periodic refresh
rss.fetchAllFeeds().then(() => {
  rss.startRefreshLoop();
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: data/news-ticker.db`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  rss.stopRefreshLoop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
