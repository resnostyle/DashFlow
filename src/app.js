const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Redirect root to default dashboard (before static so / wins over index.html)
app.get('/', (_req, res) => {
  res.redirect('/dashboard/default');
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve dashboard pages (all dashboard URLs serve the same SPA shell)
app.get('/dashboard/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/dashboards', require('./routes/dashboards'));
app.use('/api/feeds', require('./routes/feeds'));
app.use('/api/content', require('./routes/content'));
app.use('/api/config', require('./routes/config'));
app.use('/api/ticker', require('./routes/ticker'));

// Error handling middleware (must be last)
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
