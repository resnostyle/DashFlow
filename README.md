# News Ticker Display Application

A containerized Node.js application featuring a real-time RSS news ticker and dynamic content display area for YouTube videos, webpages, and other content.

## Features

- **Multiple Dashboards**: Create and manage multiple independent dashboards with unique content, feeds, and configuration
- **Sports Dashboards**: Dedicated NCAA basketball dashboards (men's and women's) with live scores, schedules, and ACC standings powered by ESPN data
- **RSS Ticker**: Continuous horizontal scrolling ticker at the bottom displaying news from multiple RSS feeds (can be disabled per dashboard)
- **Dynamic Content Area**: Full-screen content display with automatic rotation
- **YouTube Support**: Automatic detection and embedding of YouTube videos
- **Real-time Updates**: WebSocket-based real-time updates without page refreshes
- **REST API**: Full CRUD API for managing dashboards, feeds, content, and configuration
- **Admin UI**: Web-based interface at `/admin` for managing dashboards, feeds, content, and config without using the API directly
- **Optional Authentication**: When `ADMIN_PASSWORD` is set, admin and API routes are protected with session-based login
- **Docker Support**: Containerized for easy deployment

## Architecture

- **Backend**: Express.js REST API + Socket.io WebSocket server
- **Frontend**: Single-page application with vanilla JavaScript
- **Data Storage**: SQLite database
- **RSS Parsing**: Automatic fetching and merging of multiple RSS feeds (parallel fetch, per-dashboard refresh intervals)
- **ESPN Integration**: Live NCAA basketball data from ESPN public API (no API key required)

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone or navigate to the project directory
cd news-ticker

# Start the application
docker compose up -d

# View logs
docker compose logs -f

# Stop the application
docker compose down
```

The application will be available at `http://localhost:3000`

Access the application via:
- Default dashboard: `http://localhost:3000` or `http://localhost:3000/dashboard/default`
- NCAA Men's Basketball: `http://localhost:3000/dashboard/ncaa-mens`
- NCAA Women's Basketball: `http://localhost:3000/dashboard/ncaa-womens`
- Custom dashboard: `http://localhost:3000/dashboard/{dashboard-id}`
- Admin UI: `http://localhost:3000/admin` (requires login when `ADMIN_PASSWORD` is set)

### Manual Setup

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or for development
npm run dev
```

## API Endpoints

When `ADMIN_PASSWORD` is set, all `/api/*` routes require authentication. Log in at `/admin/login` first; session cookies are used for subsequent requests. The `/health` endpoint remains public.

### Dashboard Management

#### List All Dashboards
```http
GET /api/dashboards
```

Response:
```json
[
  {
    "id": "default",
    "name": "Default Dashboard",
    "description": "Default dashboard",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "type": "default",
    "sport": null
  },
  {
    "id": "ncaa-mens",
    "name": "NCAA Men's Basketball",
    "description": "Duke, UNC, NC State, ACC",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "type": "sports",
    "sport": "mens"
  }
]
```

Dashboard fields:
- `type` - Dashboard type: `"default"` (content rotation + ticker) or `"sports"` (NCAA basketball layout + ticker)
- `sport` - Sport identifier (required when type is `"sports"`): `"mens"` or `"womens"`

#### Create Dashboard
```http
POST /api/dashboards
Content-Type: application/json

{
  "id": "weather",
  "name": "Weather Dashboard",
  "description": "Weather information display"
}
```

To create a sports dashboard:
```http
POST /api/dashboards
Content-Type: application/json

{
  "id": "my-sports",
  "name": "My Sports Dashboard",
  "description": "Custom sports dashboard",
  "type": "sports",
  "sport": "mens"
}
```

**Note**: When `type` is `"sports"`, the `sport` field must be either `"mens"` or `"womens"`.

#### Get Dashboard Details
```http
GET /api/dashboards/:id
```

#### Update Dashboard
```http
PUT /api/dashboards/:id
Content-Type: application/json

{
  "name": "Updated Dashboard Name",
  "description": "Updated description"
}
```

#### Delete Dashboard
```http
DELETE /api/dashboards/:id
```

**Note**: The default dashboard cannot be deleted.

### Sports Data (NCAA Basketball)

Sports dashboards display NCAA basketball data from the ESPN API. Two sports dashboards are created automatically on startup:
- `ncaa-mens` — NCAA Men's Basketball (Duke, UNC, NC State, ACC)
- `ncaa-womens` — NCAA Women's Basketball (Duke, UNC, NC State, ACC)

#### Get Sports Data
```http
GET /api/sports/ncaa?dashboard={dashboard-id}
```

**Note**: The dashboard must have `type: "sports"` and a valid `sport` value.

Response:
```json
{
  "sport": "mens",
  "primary": {
    "team": {
      "id": "150",
      "name": "Duke Blue Devils",
      "logo": "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png",
      "record": "23-2",
      "standing": "1st in ACC",
      "rank": 3
    },
    "lastGame": { "id": "...", "home": {...}, "away": {...} },
    "upcomingGames": [],
    "nextGame": { "date": "...", "venue": {...}, "broadcasts": [...] }
  },
  "secondary": [
    { "team": {...}, "lastGame": null, "upcomingGames": [] },
    { "team": {...}, "lastGame": null, "upcomingGames": [] }
  ],
  "acc": { "standings": [], "todayGames": [] }
}
```

Team IDs are configured per dashboard via `primaryTeamId` and `secondaryTeamIds` in config (default: 150, [153, 152]).

Data is fetched from the ESPN public API and cached for 1 hour. Sports dashboards are also refreshed automatically every 5 minutes and pushed to connected clients via WebSocket.

### Feeds Management

All feed endpoints support an optional `?dashboard={id}` query parameter. If omitted, the default dashboard is used.

#### Get All Feeds
```http
GET /api/feeds?dashboard={dashboard-id}
```

**Note**: The `?dashboard={id}` parameter is optional. If omitted, uses the default dashboard.

Response:
```json
[
  {
    "id": "1234567890",
    "name": "Example News",
    "url": "https://example.com/rss",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Add RSS Feed
```http
POST /api/feeds?dashboard={dashboard-id}
Content-Type: application/json

{
  "name": "Example News",
  "url": "https://example.com/rss",
  "logo": "https://example.com/logo.png"
}
```

**Note**: The `?dashboard={id}` parameter is optional. If omitted, adds to the default dashboard.

#### Update Feed
```http
PUT /api/feeds/:id?dashboard={dashboard-id}
Content-Type: application/json

{
  "name": "Updated Feed Name",
  "url": "https://example.com/new-rss",
  "logo": "https://example.com/new-logo.png"
}
```

#### Delete Feed
```http
DELETE /api/feeds/:id?dashboard={dashboard-id}
```

### Content Management

All content endpoints support an optional `?dashboard={id}` query parameter. If omitted, the default dashboard is used.

#### Get All Content
```http
GET /api/content?dashboard={dashboard-id}
```

**Note**: The `?dashboard={id}` parameter is optional. If omitted, uses the default dashboard.

Response:
```json
[
  {
    "id": "1234567890",
    "url": "https://www.youtube.com/watch?v=example",
    "title": "Example Video",
    "type": "youtube",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Add Content
```http
POST /api/content?dashboard={dashboard-id}
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=example",
  "title": "Example Video",
  "type": "youtube"
}
```

**Note**: The `?dashboard={id}` parameter is optional. If omitted, adds to the default dashboard.

Supported content types:
- `youtube` - YouTube videos (auto-detected)
- `webpage` - Regular web pages (default)

#### Update Content
```http
PUT /api/content/:id?dashboard={dashboard-id}
Content-Type: application/json

{
  "title": "Updated Title",
  "url": "https://example.com/new-url"
}
```

#### Delete Content
```http
DELETE /api/content/:id?dashboard={dashboard-id}
```

### Ticker

The ticker endpoint supports an optional `?dashboard={id}` query parameter. If omitted, the default dashboard is used.

#### Get Current Ticker Items
```http
GET /api/ticker?dashboard={dashboard-id}
```

**Note**: The `?dashboard={id}` parameter is optional. If omitted, uses the default dashboard. Returns empty array if ticker is disabled for the dashboard.

Response:
```json
[
  {
    "id": "feed-123-item-456",
    "title": "News Article Title",
    "link": "https://example.com/article",
    "pubDate": "2024-01-01T00:00:00.000Z",
    "feedName": "Example News"
  }
]
```

### Configuration

All config endpoints support an optional `?dashboard={id}` query parameter. If omitted, the default dashboard is used.

#### Get Configuration
```http
GET /api/config?dashboard={dashboard-id}
```

Response:
```json
{
  "rotationInterval": 30000,
  "tickerRefreshInterval": 300000,
  "maxTickerItems": 50,
  "tickerEnabled": true,
  "primaryTeamId": 150,
  "secondaryTeamIds": [153, 152]
}
```

Sports dashboards include `primaryTeamId` and `secondaryTeamIds` (ESPN team IDs). Omitted fields use defaults.

#### Update Configuration
```http
POST /api/config?dashboard={dashboard-id}
Content-Type: application/json

{
  "rotationInterval": 60000,
  "tickerRefreshInterval": 600000,
  "maxTickerItems": 100,
  "tickerEnabled": true
}
```

Configuration options:
- `rotationInterval` - Content rotation interval in milliseconds (minimum: 5000ms). For sports dashboards, this controls the interval between primary team and conference page views.
- `primaryTeamId` - ESPN team ID for the key/primary team (sports dashboards only). Default: 150 (Duke).
- `secondaryTeamIds` - Array of 1-2 ESPN team IDs for secondary teams. Default: [153, 152] (UNC, NC State).
- `tickerRefreshInterval` - RSS feed refresh interval in milliseconds (minimum: 60000ms)
- `maxTickerItems` - Maximum number of ticker items to display (range: 10-200)
- `tickerEnabled` - Enable/disable RSS ticker for this dashboard (default: `true`). When `false`, no RSS feeds are fetched and the ticker is hidden.

### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket Events

The application uses Socket.io for real-time updates. Connect to the server and listen for these events:

### Client → Server

#### `dashboard:request`
Request data for a specific dashboard. Emit this event after connecting to receive initial data for a dashboard.
```javascript
socket.emit('dashboard:request', 'news');
```

### Server → Client

All dashboard-specific events follow the pattern: `{event}:{dashboard-id}`. For example, `ticker:update:news` for the "news" dashboard.

#### `ticker:update:{dashboard-id}`
Emitted when ticker items are updated for a specific dashboard.
```javascript
socket.on('ticker:update:news', (items) => {
  console.log('Ticker updated for news dashboard:', items);
});
```

#### `content:update:{dashboard-id}`
Emitted when content queue changes for a specific dashboard.
```javascript
socket.on('content:update:news', (items) => {
  console.log('Content updated for news dashboard:', items);
});
```

#### `content:rotate`
Emitted to force content rotation (applies to current dashboard).
```javascript
socket.on('content:rotate', () => {
  console.log('Content rotation triggered');
});
```

#### `config:update:{dashboard-id}`
Emitted when configuration changes for a specific dashboard.
```javascript
socket.on('config:update:news', (config) => {
  console.log('Config updated for news dashboard:', config);
});
```

#### `dashboard:meta:{dashboard-id}`
Emitted on initial connection with dashboard metadata including `type` and `sport`.
```javascript
socket.on('dashboard:meta:ncaa-mens', (meta) => {
  console.log(meta);
  // { type: 'sports', sport: 'mens', name: "NCAA Men's Basketball" }
});
```

#### `sports:update:{dashboard-id}`
Emitted when sports data is refreshed for a sports dashboard. Contains primary team, secondary teams, and ACC data (default: Duke, UNC, NC State).
```javascript
socket.on('sports:update:ncaa-mens', (data) => {
  console.log('Primary team record:', data.primary.team.record);
  console.log('ACC games today:', data.acc.todayGames);
});
```

#### `dashboard:error:{dashboard-id}`
Emitted when dashboard data fails to load (e.g., invalid dashboard ID).
```javascript
socket.on('dashboard:error:news', (err) => {
  console.error('Dashboard load failed:', err.error);
});
```
## Admin UI

The admin UI at `/admin` provides a form-based interface for managing dashboards, feeds, content, and configuration. When `ADMIN_PASSWORD` is set, you must log in at `/admin/login` before accessing the admin page or using the API. Use the "Log out" button to sign out. The display page (`/dashboard/:id`) and health check (`/health`) remain public.

For kiosk or display-only use, add `?kiosk=1` to the dashboard URL to hide the "Manage" link (e.g. `/dashboard/default?kiosk=1`).

## Usage Examples

### Creating a New Dashboard

```bash
curl -X POST http://localhost:3000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{
    "id": "weather",
    "name": "Weather Dashboard",
    "description": "Weather information display"
  }'
```

### Creating a Sports Dashboard

```bash
curl -X POST http://localhost:3000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-ncaam",
    "name": "My NCAAM Dashboard",
    "type": "sports",
    "sport": "mens"
  }'
```

### Adding RSS Feeds to a Sports Dashboard

Sports dashboards support the RSS ticker alongside the sports widgets. Add feeds to show college basketball news at the bottom:

```bash
curl -X POST "http://localhost:3000/api/feeds?dashboard=ncaa-mens" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ESPN NCAAM",
    "url": "https://www.espn.com/espn/rss/ncb/news"
  }'

curl -X POST "http://localhost:3000/api/feeds?dashboard=ncaa-womens" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ESPN NCAAW",
    "url": "https://www.espn.com/espn/rss/ncw/news"
  }'
```

### Adding Content to a Specific Dashboard

```bash
# Add to default dashboard
curl -X POST http://localhost:3000/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Example Video"
  }'

# Add to specific dashboard
curl -X POST "http://localhost:3000/api/content?dashboard=weather" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Weather Video"
  }'
```

### Adding RSS Feeds to a Dashboard

```bash
# Add to default dashboard
curl -X POST http://localhost:3000/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "BBC News",
    "url": "http://feeds.bbci.co.uk/news/rss.xml"
  }'

# Add to specific dashboard
curl -X POST "http://localhost:3000/api/feeds?dashboard=news" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech News",
    "url": "https://techcrunch.com/feed/"
  }'
```

### Disabling RSS Ticker for a Dashboard

```bash
curl -X POST "http://localhost:3000/api/config?dashboard=weather" \
  -H "Content-Type: application/json" \
  -d '{
    "tickerEnabled": false
  }'
```

### Updating Dashboard Configuration

```bash
# Update default dashboard
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "rotationInterval": 60000,
    "tickerEnabled": true
  }'

# Update specific dashboard
curl -X POST "http://localhost:3000/api/config?dashboard=news" \
  -H "Content-Type: application/json" \
  -d '{
    "rotationInterval": 30000,
    "maxTickerItems": 100
  }'
```

## YouTube URL Formats Supported

The application automatically detects and converts these YouTube URL formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## Data Persistence

Data is stored in SQLite in the `data/` directory:

- `data/news-ticker.db` - SQLite database containing dashboards, feeds, content, config, and sessions (when `ADMIN_PASSWORD` is set)

**Migration Note**: On first run after upgrading, existing data in JSON files (`data/dashboards.json`, `data/dashboards/{id}/feeds.json`, `data/content.json`, `data/config.json`, or legacy flat files) will be automatically migrated to SQLite. The old JSON files remain for reference but are no longer used.

For Docker deployments, mount the `data/` directory as a volume to persist the database across container restarts.

## Development

### Project Structure

```
news-ticker/
├── server.js              # HTTP server entry point
├── package.json           # Dependencies & scripts
├── vitest.config.js       # Test configuration
├── .mise.toml             # Mise task runner config
├── Dockerfile             # Container definition
├── docker-compose.yml     # Docker Compose config
├── .dockerignore          # Build exclusions
├── .gitignore             # Git exclusions
├── README.md              # This file
├── .github/
│   └── workflows/
│       └── test.yml       # CI test workflow
├── data/                  # Data persistence
│   └── news-ticker.db     # SQLite database
├── src/                   # Backend source
│   ├── app.js             # Express app setup & routing
│   ├── db.js              # SQLite database layer
│   ├── socket.js          # WebSocket handlers
│   ├── middleware.js      # Shared middleware
│   ├── middleware/
│   │   └── auth.js        # Admin authentication middleware
│   ├── utils/
│   │   └── urlValidation.js  # URL validation for feeds and content
│   ├── routes/            # API route handlers
│   │   ├── config.js
│   │   ├── content.js
│   │   ├── dashboards.js
│   │   ├── feeds.js
│   │   ├── sports.js      # NCAA basketball sports data API
│   │   └── ticker.js
│   └── services/          # Business logic
│       ├── espn.js        # ESPN API client (mens + womens NCAA basketball)
│       ├── rss.js         # RSS feed fetching & caching
│       └── sports-refresh.js  # Periodic sports data refresh (5 min interval)
├── tests/                 # Test suite
│   ├── setup.js           # Test environment setup
│   ├── helpers.js         # Shared test utilities
│   ├── config.test.js
│   ├── content.test.js
│   ├── dashboards.test.js
│   ├── db.test.js
│   ├── feeds.test.js
│   ├── health.test.js
│   ├── auth.test.js       # Admin authentication tests
│   ├── sports.test.js    # NCAA basketball sports API tests
│   └── ticker.test.js
└── public/                # Frontend files
    ├── index.html         # Display page
    ├── admin.html         # Admin UI
    ├── admin-login.html   # Admin login page
    ├── css/
    │   ├── style.css
    │   └── admin.css
    └── js/
        ├── app.js             # Display logic
        ├── admin.js            # Admin UI logic
        ├── sports-dashboard.js # NCAA basketball dashboard UI
        └── utils.js            # Shared utilities
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `DATA_DIR` - Path to the data directory for the SQLite database (default: `./data`)
- `ADMIN_PASSWORD` - When set, protects `/admin` and all `/api/*` routes with session-based authentication. Users must log in at `/admin/login` before accessing the admin UI or API.
- `ADMIN_SESSION_SECRET` - Secret for signing session cookies (required when `ADMIN_PASSWORD` is set in production; defaults to a dev-only value)
- `CORS_ORIGIN` - Comma-separated list of allowed origins for CORS. If omitted or set to `*`, allows all origins. This limits which web origins can read API responses in browsers (it does not block server-to-server requests like curl or Postman). For proper API protection, use authentication and authorization in addition to CORS.
- `RSS_FETCH_TIMEOUT_MS` - Wall-clock limit (milliseconds, minimum 1000) for each RSS feed fetch including redirects and response body (default: 15000). Docker Compose passes this through when set on the host.
- `RSS_FETCH_MAX_REDIRECTS` - Maximum redirect hops when fetching a feed URL (default: 10, capped at 30). Each hop is validated for SSRF safety before following.

### Building Docker Image

```bash
docker build -t news-ticker-display .
```

### Running Docker Container

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name news-ticker \
  news-ticker-display
```

### Testing

The project uses [Vitest](https://vitest.dev/) as the test framework and [Supertest](https://github.com/ladjs/supertest) for HTTP assertion testing. Each test run uses an isolated temporary SQLite database, so tests never affect production data.

```bash
# Run the full test suite
npm test

# Run tests in watch mode during development
npm run test:watch
```

Test files are in the `tests/` directory with coverage for all API routes, the database layer, the health endpoint, and admin authentication.

### Continuous Integration

GitHub Actions workflows run automatically:

- **Tests** (`.github/workflows/test.yml`): Runs the test suite on pushes to `main`/`master` and all pull requests
- **Docker Build** (`.github/workflows/docker-build.yml`): Builds and pushes the Docker image to GitHub Container Registry (ghcr.io) on pushes to `main`/`master`

### Mise Task Runner

The project includes a [mise](https://mise.jdx.dev/) configuration (`.mise.toml`) that pins Node.js 24 and provides convenient task aliases:

```bash
mise run setup          # Install dependencies
mise run dev            # Start development server
mise run test           # Run test suite
mise run test-watch     # Run tests in watch mode
mise run docker-up      # Start with Docker Compose
mise run docker-down    # Stop Docker Compose services
mise run docker-logs    # Follow Docker Compose logs
mise run docker-build   # Build Docker image
```

Using mise is entirely optional; standard `npm` commands work the same way.

## Security Considerations

- Input validation on all API endpoints
- URL validation before processing
- CORS enabled (configure for production use)
- Optional session-based authentication: set `ADMIN_PASSWORD` to protect `/admin` and `/api/*` routes; set `ADMIN_SESSION_SECRET` in production
- Login rate limiting: 5 attempts per 15 minutes per IP to prevent brute-force attacks

## Browser Compatibility

- Modern browsers with ES6+ support
- WebSocket support required
- CSS Grid and Flexbox support required

## Troubleshooting

### Ticker Not Scrolling

- Check browser console for JavaScript errors
- Verify RSS feeds are valid and accessible
- Check that ticker items are being fetched (use `/api/ticker?dashboard={id}` endpoint)
- Verify `tickerEnabled` is `true` in the dashboard configuration
- Ensure you're checking the correct dashboard (verify URL path)

### Content Not Rotating

- Verify content items exist (use `/api/content?dashboard={id}` endpoint)
- Check rotation interval in configuration for the specific dashboard
- Ensure at least 2 content items are added to the dashboard
- Verify you're viewing the correct dashboard (check URL path)

### YouTube Videos Not Playing

- Verify YouTube URL format is correct
- Check browser autoplay policies
- Some browsers require user interaction before autoplay

### Data Not Persisting

- Check file permissions on the `data/` directory
- Verify volume mounts in Docker (if using) include the entire `data/` directory
- Check server logs for database write errors
- Ensure the `DATA_DIR` environment variable (if set) points to a writable directory
- Ensure dashboard ID is valid (alphanumeric, dashes, underscores only)

### Admin Login Fails or API Returns 401

- Ensure `ADMIN_PASSWORD` is set if you intend to use authentication
- When auth is enabled, log in at `/admin/login` before using the admin UI or API
- For API access (e.g. curl), use a session cookie: log in via browser, copy the session cookie, and pass it with `-H "Cookie: connect.sid=..."` (or use a tool that preserves cookies)

### Dashboard Not Found

- Verify dashboard exists using `GET /api/dashboards`
- Check that dashboard ID in URL matches exactly (case-sensitive)
- Ensure dashboard was created successfully (check server logs)

### Sports Dashboard Not Loading

- Verify the dashboard has `type: "sports"` and a valid `sport` (`"mens"` or `"womens"`)
- Check server logs for ESPN API fetch errors
- The ESPN API is public and rate-limited; data is cached for 1 hour to reduce requests
- Ensure the server has outbound HTTPS access to `site.api.espn.com`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
