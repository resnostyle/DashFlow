const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const { ensureAuthenticated } = require('./middleware/auth');

if (
  process.env.ADMIN_PASSWORD &&
  process.env.NODE_ENV === 'production' &&
  !process.env.ADMIN_SESSION_SECRET
) {
  throw new Error(
    'ADMIN_SESSION_SECRET is required when ADMIN_PASSWORD is set in production',
  );
}

const sessionSecret =
  process.env.ADMIN_SESSION_SECRET || 'dev-secret-change-in-production';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  }),
);

// Redirect root to default dashboard (before static so / wins over index.html)
app.get('/', (_req, res) => {
  res.redirect('/dashboard/default');
});

// Serve admin.html through auth so /admin.html cannot bypass the protected /admin route
app.get('/admin.html', ensureAuthenticated, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve dashboard pages (all dashboard URLs serve the same SPA shell)
app.get('/dashboard/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Admin login (unprotected)
app.get('/admin/login', (_req, res) => {
  if (process.env.ADMIN_PASSWORD && _req.session?.authenticated) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  if (!process.env.ADMIN_PASSWORD) {
    return res.redirect('/admin');
  }
  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.redirect('/admin/login?error=invalid');
  }
  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regenerate error:', err);
      return res.status(500).send('Login failed. Please try again.');
    }
    req.session.authenticated = true;
    req.session.role = 'admin';
    res.redirect('/admin');
  });
});

// Admin page (protected when ADMIN_PASSWORD is set)
app.get('/admin', ensureAuthenticated, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (protected when ADMIN_PASSWORD is set)
app.use('/api/dashboards', ensureAuthenticated, require('./routes/dashboards'));
app.use('/api/feeds', ensureAuthenticated, require('./routes/feeds'));
app.use('/api/content', ensureAuthenticated, require('./routes/content'));
app.use('/api/config', ensureAuthenticated, require('./routes/config'));
app.use('/api/ticker', ensureAuthenticated, require('./routes/ticker'));

// Error handling middleware (must be last)
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
