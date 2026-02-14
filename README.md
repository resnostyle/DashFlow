# News Ticker Display Application

A containerized Node.js application featuring a real-time RSS news ticker and dynamic content display area for YouTube videos, webpages, and other content.

## Features

- **Multiple Dashboards**: Create and manage multiple independent dashboards with unique content, feeds, and configuration
- **RSS Ticker**: Continuous horizontal scrolling ticker at the bottom displaying news from multiple RSS feeds (can be disabled per dashboard)
- **Dynamic Content Area**: Full-screen content display with automatic rotation
- **YouTube Support**: Automatic detection and embedding of YouTube videos
- **Real-time Updates**: WebSocket-based real-time updates without page refreshes
- **REST API**: Full CRUD API for managing dashboards, feeds, content, and configuration
- **Docker Support**: Containerized for easy deployment

## Architecture

- **Backend**: Express.js REST API + Socket.io WebSocket server
- **Frontend**: Single-page application with vanilla JavaScript
- **Data Storage**: SQLite database
- **RSS Parsing**: Automatic fetching and merging of multiple RSS feeds (parallel fetch, per-dashboard refresh intervals)

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone or navigate to the project directory
cd news-ticker

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

The application will be available at `http://localhost:3000`

Access dashboards via:
- Default dashboard: `http://localhost:3000` or `http://localhost:3000/dashboard/default`
- Custom dashboard: `http://localhost:3000/dashboard/{dashboard-id}`

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
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "news",
    "name": "News Dashboard",
    "description": "News and current events",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

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
  "maxTickerItems": 50
}
```

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
- `rotationInterval` - Content rotation interval in milliseconds (minimum: 5000ms)
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

- `data/news-ticker.db` - SQLite database containing dashboards, feeds, content, and config

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
│   ├── middleware.js       # Shared middleware
│   ├── routes/            # API route handlers
│   │   ├── config.js
│   │   ├── content.js
│   │   ├── dashboards.js
│   │   ├── feeds.js
│   │   └── ticker.js
│   └── services/          # Business logic
│       └── rss.js         # RSS feed fetching & caching
├── tests/                 # Test suite
│   ├── setup.js           # Test environment setup
│   ├── helpers.js         # Shared test utilities
│   ├── config.test.js
│   ├── content.test.js
│   ├── dashboards.test.js
│   ├── db.test.js
│   ├── feeds.test.js
│   ├── health.test.js
│   └── ticker.test.js
└── public/                # Frontend files
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `DATA_DIR` - Path to the data directory for the SQLite database (default: `./data`)

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

Test files are in the `tests/` directory with coverage for all API routes, the database layer, and the health endpoint.

### Continuous Integration

A GitHub Actions workflow (`.github/workflows/test.yml`) runs the test suite automatically on:

- Pushes to `main` / `master`
- All pull requests

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
- No authentication implemented (add for production)

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

### Dashboard Not Found

- Verify dashboard exists using `GET /api/dashboards`
- Check that dashboard ID in URL matches exactly (case-sensitive)
- Ensure dashboard was created successfully (check server logs)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
