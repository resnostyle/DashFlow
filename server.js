const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const db = require('./src/db');
const rss = require('./src/services/rss');
const socket = require('./src/socket');
const sportsRefresh = require('./src/services/sports-refresh');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'news-ticker.db');

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
sportsRefresh.start(io);

// Initial RSS fetch then start periodic refresh
rss.fetchAllFeeds().catch(err => {
  console.error('Error during initial RSS fetch:', err);
}).finally(() => {
  rss.startRefreshLoop();
});

// Session cleanup (expired sessions in SQLite)
const SESSION_CLEANUP_MS = 24 * 60 * 60 * 1000; // 24 hours
db.cleanupExpiredSessions();
const sessionCleanupInterval = setInterval(db.cleanupExpiredSessions, SESSION_CLEANUP_MS);

// Start listening
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  rss.stopRefreshLoop();
  sportsRefresh.stop();
  clearInterval(sessionCleanupInterval);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
