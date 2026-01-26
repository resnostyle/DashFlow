const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const parser = new Parser();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DASHBOARDS_DIR = path.join(DATA_DIR, 'dashboards');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(DASHBOARDS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Dashboard data storage
let dashboards = [];
let dashboardData = {}; // { dashboardId: { feeds: [], content: [], config: {}, tickerItems: [] } }

// Default dashboard ID
const DEFAULT_DASHBOARD_ID = 'default';

// Dashboard management functions
async function loadDashboards() {
  try {
    const dashboardsData = await fs.readFile(path.join(DATA_DIR, 'dashboards.json'), 'utf8');
    dashboards = JSON.parse(dashboardsData);
  } catch (error) {
    dashboards = [];
  }
}

async function saveDashboards() {
  try {
    await fs.writeFile(path.join(DATA_DIR, 'dashboards.json'), JSON.stringify(dashboards, null, 2));
  } catch (error) {
    console.error('Error saving dashboards:', error);
  }
}

async function loadDashboardData(dashboardId) {
  const dashboardDir = path.join(DASHBOARDS_DIR, dashboardId);
  
  // Initialize dashboard data structure
  if (!dashboardData[dashboardId]) {
    dashboardData[dashboardId] = {
      feeds: [],
      content: [],
      config: {
        rotationInterval: 30000,
        tickerRefreshInterval: 300000,
        maxTickerItems: 50,
        tickerEnabled: true
      },
      tickerItems: []
    };
  }

  try {
    const feedsData = await fs.readFile(path.join(dashboardDir, 'feeds.json'), 'utf8');
    dashboardData[dashboardId].feeds = JSON.parse(feedsData);
  } catch (error) {
    dashboardData[dashboardId].feeds = [];
  }

  try {
    const contentData = await fs.readFile(path.join(dashboardDir, 'content.json'), 'utf8');
    dashboardData[dashboardId].content = JSON.parse(contentData);
  } catch (error) {
    dashboardData[dashboardId].content = [];
  }

  try {
    const configData = await fs.readFile(path.join(dashboardDir, 'config.json'), 'utf8');
    dashboardData[dashboardId].config = { ...dashboardData[dashboardId].config, ...JSON.parse(configData) };
  } catch (error) {
    // Use default config
  }

  return dashboardData[dashboardId];
}

async function saveDashboardData(dashboardId, type, data) {
  const dashboardDir = path.join(DASHBOARDS_DIR, dashboardId);
  
  try {
    await fs.mkdir(dashboardDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating dashboard directory for ${dashboardId}:`, error);
    return;
  }

  try {
    const filePath = path.join(dashboardDir, `${type}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    // Update in-memory data
    if (!dashboardData[dashboardId]) {
      dashboardData[dashboardId] = { feeds: [], content: [], config: {}, tickerItems: [] };
    }
    dashboardData[dashboardId][type] = data;
  } catch (error) {
    console.error(`Error saving dashboard ${type} for ${dashboardId}:`, error);
  }
}

// Migration function to move existing data to default dashboard
async function migrateExistingData() {
  const defaultDashboardPath = path.join(DASHBOARDS_DIR, DEFAULT_DASHBOARD_ID);
  const defaultExists = await fs.access(defaultDashboardPath).then(() => true).catch(() => false);
  
  if (defaultExists) {
    return; // Already migrated
  }

  console.log('Migrating existing data to default dashboard...');
  
  try {
    // Check if old data files exist
    const oldFeedsPath = path.join(DATA_DIR, 'feeds.json');
    const oldContentPath = path.join(DATA_DIR, 'content.json');
    const oldConfigPath = path.join(DATA_DIR, 'config.json');

    let feeds = [];
    let content = [];
    let config = {
      rotationInterval: 30000,
      tickerRefreshInterval: 300000,
      maxTickerItems: 50,
      tickerEnabled: true
    };

    try {
      const feedsData = await fs.readFile(oldFeedsPath, 'utf8');
      feeds = JSON.parse(feedsData);
    } catch (error) {
      // File doesn't exist, use empty array
    }

    try {
      const contentData = await fs.readFile(oldContentPath, 'utf8');
      content = JSON.parse(contentData);
    } catch (error) {
      // File doesn't exist, use empty array
    }

    try {
      const configData = await fs.readFile(oldConfigPath, 'utf8');
      config = { ...config, ...JSON.parse(configData) };
      if (config.tickerEnabled === undefined) {
        config.tickerEnabled = true;
      }
    } catch (error) {
      // File doesn't exist, use default config
    }

    // Save to default dashboard
    await saveDashboardData(DEFAULT_DASHBOARD_ID, 'feeds', feeds);
    await saveDashboardData(DEFAULT_DASHBOARD_ID, 'content', content);
    await saveDashboardData(DEFAULT_DASHBOARD_ID, 'config', config);

    // Create default dashboard entry if it doesn't exist
    const defaultDashboardExists = dashboards.find(d => d.id === DEFAULT_DASHBOARD_ID);
    if (!defaultDashboardExists) {
      dashboards.push({
        id: DEFAULT_DASHBOARD_ID,
        name: 'Default Dashboard',
        description: 'Default dashboard',
        createdAt: new Date().toISOString()
      });
      await saveDashboards();
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Helper function to get dashboard ID from request
function getDashboardId(req) {
  return req.query.dashboard || DEFAULT_DASHBOARD_ID;
}

// Helper function to ensure dashboard exists
function ensureDashboard(dashboardId) {
  if (!dashboardData[dashboardId]) {
    dashboardData[dashboardId] = {
      feeds: [],
      content: [],
      config: {
        rotationInterval: 30000,
        tickerRefreshInterval: 300000,
        maxTickerItems: 50,
        tickerEnabled: true
      },
      tickerItems: []
    };
  }
  return dashboardData[dashboardId];
}

// RSS feed fetching per dashboard
async function fetchRSSFeeds(dashboardId) {
  const dashboard = ensureDashboard(dashboardId);
  
  // Don't fetch if ticker is disabled
  if (!dashboard.config.tickerEnabled) {
    dashboard.tickerItems = [];
    io.emit(`ticker:update:${dashboardId}`, []);
    return [];
  }

  const allItems = [];
  
  for (const feed of dashboard.feeds) {
    try {
      const feedData = await parser.parseURL(feed.url);
      if (feedData.items) {
        feedData.items.forEach(item => {
          allItems.push({
            id: `${feed.id}-${item.guid || item.link || Date.now()}`,
            title: item.title || 'No title',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            feedName: feed.name || feed.url,
            feedId: feed.id,
            feedLogo: feed.logo || null
          });
        });
      }
    } catch (error) {
      console.error(`Error fetching feed ${feed.url} for dashboard ${dashboardId}:`, error.message);
    }
  }

  // Sort by publication date (newest first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.pubDate);
    const dateB = new Date(b.pubDate);
    return dateB - dateA;
  });

  // Limit to max items
  dashboard.tickerItems = allItems.slice(0, dashboard.config.maxTickerItems);
  
  // Broadcast update to all connected clients for this dashboard
  io.emit(`ticker:update:${dashboardId}`, dashboard.tickerItems);
  
  return dashboard.tickerItems;
}

// Fetch feeds for all dashboards that have ticker enabled
async function fetchAllDashboardFeeds() {
  for (const dashboardId in dashboardData) {
    const dashboard = dashboardData[dashboardId];
    if (dashboard.config.tickerEnabled && dashboard.feeds.length > 0) {
      await fetchRSSFeeds(dashboardId);
    }
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve dashboard routes (all dashboard URLs serve the same HTML)
app.get('/dashboard/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes - Dashboards
app.get('/api/dashboards', (req, res) => {
  res.json(dashboards);
});

app.post('/api/dashboards', async (req, res) => {
  const { id, name, description } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Dashboard ID is required' });
  }

  // Validate ID format (alphanumeric, dash, underscore only)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid dashboard ID format. Use only letters, numbers, dashes, and underscores.' });
  }

  // Check if dashboard already exists
  if (dashboards.find(d => d.id === id)) {
    return res.status(409).json({ error: 'Dashboard with this ID already exists' });
  }

  const newDashboard = {
    id: id,
    name: name || id,
    description: description || '',
    createdAt: new Date().toISOString()
  };

  dashboards.push(newDashboard);
  await saveDashboards();
  
  // Initialize dashboard data
  ensureDashboard(id);
  await saveDashboardData(id, 'feeds', []);
  await saveDashboardData(id, 'content', []);
  await saveDashboardData(id, 'config', {
    rotationInterval: 30000,
    tickerRefreshInterval: 300000,
    maxTickerItems: 50,
    tickerEnabled: true
  });
  
  res.status(201).json(newDashboard);
});

app.get('/api/dashboards/:id', (req, res) => {
  const { id } = req.params;
  const dashboard = dashboards.find(d => d.id === id);
  
  if (!dashboard) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  
  res.json(dashboard);
});

app.put('/api/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  const index = dashboards.findIndex(d => d.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  
  if (name) dashboards[index].name = name;
  if (description !== undefined) dashboards[index].description = description;
  
  await saveDashboards();
  
  res.json(dashboards[index]);
});

app.delete('/api/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  
  if (id === DEFAULT_DASHBOARD_ID) {
    return res.status(400).json({ error: 'Cannot delete default dashboard' });
  }
  
  const index = dashboards.findIndex(d => d.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }

  dashboards.splice(index, 1);
  await saveDashboards();
  
  // Delete dashboard data directory
  try {
    const dashboardDir = path.join(DASHBOARDS_DIR, id);
    await fs.rm(dashboardDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error deleting dashboard directory for ${id}:`, error);
  }
  
  // Remove from memory
  delete dashboardData[id];
  
  res.json({ message: 'Dashboard deleted' });
});

// API Routes - Feeds
app.get('/api/feeds', (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  res.json(dashboard.feeds);
});

app.post('/api/feeds', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { name, url, logo } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Validate logo URL if provided
  if (logo) {
    try {
      new URL(logo);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid logo URL format' });
    }
  }

  const newFeed = {
    id: Date.now().toString(),
    name: name || url,
    url: url,
    logo: logo || null,
    createdAt: new Date().toISOString()
  };

  dashboard.feeds.push(newFeed);
  await saveDashboardData(dashboardId, 'feeds', dashboard.feeds);
  
  // Fetch immediately if ticker is enabled
  if (dashboard.config.tickerEnabled) {
    await fetchRSSFeeds(dashboardId);
  }
  
  res.status(201).json(newFeed);
});

app.put('/api/feeds/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { id } = req.params;
  const { name, url, logo } = req.body;
  
  const index = dashboard.feeds.findIndex(f => f.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  if (url) {
    try {
      new URL(url);
      dashboard.feeds[index].url = url;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  }
  
  if (name) dashboard.feeds[index].name = name;
  
  if (logo !== undefined) {
    if (logo) {
      try {
        new URL(logo);
        dashboard.feeds[index].logo = logo;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid logo URL format' });
      }
    } else {
      dashboard.feeds[index].logo = null;
    }
  }
  
  await saveDashboardData(dashboardId, 'feeds', dashboard.feeds);
  
  // Refresh ticker if enabled
  if (dashboard.config.tickerEnabled) {
    await fetchRSSFeeds(dashboardId);
  }
  
  res.json(dashboard.feeds[index]);
});

app.delete('/api/feeds/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { id } = req.params;
  const index = dashboard.feeds.findIndex(f => f.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  dashboard.feeds.splice(index, 1);
  await saveDashboardData(dashboardId, 'feeds', dashboard.feeds);
  
  // Refresh ticker if enabled
  if (dashboard.config.tickerEnabled) {
    await fetchRSSFeeds(dashboardId);
  }
  
  res.json({ message: 'Feed deleted' });
});

// API Routes - Content
app.get('/api/content', (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  res.json(dashboard.content);
});

app.post('/api/content', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { url, title, type } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const newContent = {
    id: Date.now().toString(),
    url: url,
    title: title || url,
    type: type || 'webpage',
    createdAt: new Date().toISOString()
  };

  dashboard.content.push(newContent);
  await saveDashboardData(dashboardId, 'content', dashboard.content);
  
  // Broadcast update
  io.emit(`content:update:${dashboardId}`, dashboard.content);
  
  res.status(201).json(newContent);
});

app.put('/api/content/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { id } = req.params;
  const { url, title, type } = req.body;
  
  const index = dashboard.content.findIndex(c => c.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Content not found' });
  }

  if (url) {
    try {
      new URL(url);
      dashboard.content[index].url = url;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
  }
  
  if (title) dashboard.content[index].title = title;
  if (type) dashboard.content[index].type = type;
  
  await saveDashboardData(dashboardId, 'content', dashboard.content);
  
  // Broadcast update
  io.emit(`content:update:${dashboardId}`, dashboard.content);
  
  res.json(dashboard.content[index]);
});

app.delete('/api/content/:id', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { id } = req.params;
  const index = dashboard.content.findIndex(c => c.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Content not found' });
  }

  dashboard.content.splice(index, 1);
  await saveDashboardData(dashboardId, 'content', dashboard.content);
  
  // Broadcast update
  io.emit(`content:update:${dashboardId}`, dashboard.content);
  
  res.json({ message: 'Content deleted' });
});

// API Routes - Ticker
app.get('/api/ticker', (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  res.json(dashboard.tickerItems || []);
});

// API Routes - Config
app.get('/api/config', (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  res.json(dashboard.config);
});

app.post('/api/config', async (req, res) => {
  const dashboardId = getDashboardId(req);
  const dashboard = ensureDashboard(dashboardId);
  const { rotationInterval, tickerRefreshInterval, maxTickerItems, tickerEnabled } = req.body;
  
  if (rotationInterval !== undefined) {
    dashboard.config.rotationInterval = Math.max(5000, parseInt(rotationInterval) || 30000);
  }
  
  if (tickerRefreshInterval !== undefined) {
    dashboard.config.tickerRefreshInterval = Math.max(60000, parseInt(tickerRefreshInterval) || 300000);
  }
  
  if (maxTickerItems !== undefined) {
    dashboard.config.maxTickerItems = Math.max(10, Math.min(200, parseInt(maxTickerItems) || 50));
  }
  
  if (tickerEnabled !== undefined) {
    dashboard.config.tickerEnabled = Boolean(tickerEnabled);
    
    // If ticker is disabled, clear ticker items
    if (!dashboard.config.tickerEnabled) {
      dashboard.tickerItems = [];
      io.emit(`ticker:update:${dashboardId}`, []);
    } else if (dashboard.feeds.length > 0) {
      // If ticker is enabled and there are feeds, fetch immediately
      await fetchRSSFeeds(dashboardId);
    }
  }
  
  await saveDashboardData(dashboardId, 'config', dashboard.config);
  
  // Broadcast update
  io.emit(`config:update:${dashboardId}`, dashboard.config);
  
  res.json(dashboard.config);
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Client can request a specific dashboard
  socket.on('dashboard:request', async (dashboardId) => {
    const dashboard = ensureDashboard(dashboardId || DEFAULT_DASHBOARD_ID);
    
    // Send initial data for requested dashboard
    socket.emit(`ticker:update:${dashboardId || DEFAULT_DASHBOARD_ID}`, dashboard.tickerItems || []);
    socket.emit(`content:update:${dashboardId || DEFAULT_DASHBOARD_ID}`, dashboard.content);
    socket.emit(`config:update:${dashboardId || DEFAULT_DASHBOARD_ID}`, dashboard.config);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize and start server
async function start() {
  await ensureDataDir();
  await loadDashboards();
  
  // Migrate existing data to default dashboard
  await migrateExistingData();
  
  // Load all dashboard data
  for (const dashboard of dashboards) {
    await loadDashboardData(dashboard.id);
  }
  
  // If no dashboards exist, create default
  if (dashboards.length === 0) {
    dashboards.push({
      id: DEFAULT_DASHBOARD_ID,
      name: 'Default Dashboard',
      description: 'Default dashboard',
      createdAt: new Date().toISOString()
    });
    await saveDashboards();
    await loadDashboardData(DEFAULT_DASHBOARD_ID);
  }
  
  // Initial RSS fetch for all dashboards
  await fetchAllDashboardFeeds();
  
  // Set up periodic RSS refresh for all dashboards
  setInterval(async () => {
    await fetchAllDashboardFeeds();
  }, 300000); // Use a fixed interval, individual dashboards can have different intervals but we'll use a common one
  
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    console.log(`Dashboards loaded: ${dashboards.length}`);
  });
}

start().catch(console.error);
