// utils.js must be loaded before app.js (provides escapeHtml, safeUrl)
if (typeof safeUrl !== 'function') {
  throw new Error('utils.js must be loaded before app.js');
}

// WebSocket connection
const socket = io();

// Detect dashboard ID from URL
function getDashboardIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/dashboard\/([^\/]+)/);
    return match ? match[1] : 'default';
}

// State
const dashboardId = getDashboardIdFromUrl();

// Kiosk mode: hide Manage link when ?kiosk=1
if (new URLSearchParams(window.location.search).get('kiosk') === '1') {
    const manageLink = document.getElementById('manageLink');
    if (manageLink) manageLink.style.display = 'none';
}
let currentContentIndex = 0;
let contentItems = [];
let tickerItems = [];
let dashboardMeta = { type: 'default', sport: null, name: '' };
let config = {
    rotationInterval: 30000,
    tickerEnabled: true
};

let contentRotationInterval = null;
let lastSportsData = null;

// YouTube URL detection and conversion
function isYouTubeUrl(url) {
    if (!url) return false;
    
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    return youtubeRegex.test(url);
}

function convertToYouTubeEmbed(url) {
    if (!url) return null;
    
    // Extract video ID
    let videoId = null;
    
    // Standard YouTube URL: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) {
        videoId = watchMatch[1];
    }
    
    // YouTube Shorts: youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/\/shorts\/([^?&]+)/);
    if (shortsMatch) {
        videoId = shortsMatch[1];
    }
    
    // YouTube embed URL: youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/\/embed\/([^?&]+)/);
    if (embedMatch) {
        videoId = embedMatch[1];
    }
    
    // youtu.be short URL: youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) {
        videoId = shortMatch[1];
    }
    
    if (!videoId) return null;
    
    // Clean video ID (remove any extra characters)
    videoId = videoId.split('&')[0].split('?')[0];
    
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0`;
}

// Content display functions
function createContentElement(item) {
    const div = document.createElement('div');
    div.className = 'content-item';
    div.dataset.id = item.id;
    
    if (isYouTubeUrl(item.url)) {
        const embedUrl = convertToYouTubeEmbed(item.url);
        if (embedUrl) {
            div.classList.add('youtube-embed');
            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.allow = 'autoplay; encrypted-media';
            iframe.allowFullscreen = true;
            div.appendChild(iframe);
        } else {
            const p = document.createElement('p');
            p.textContent = `Invalid YouTube URL: ${item.url || ''}`;
            div.appendChild(p);
        }
    } else {
        // Regular webpage iframe - use safeUrl to prevent XSS
        const safe = typeof safeUrl === 'function' ? safeUrl(item.url) : (item.url || '');
        const iframe = document.createElement('iframe');
        iframe.src = safe || 'about:blank';
        iframe.allowFullscreen = true;
        div.appendChild(iframe);
    }
    
    return div;
}

function displayContent() {
    if (dashboardMeta.type === 'sports') return;

    const contentArea = document.getElementById('contentArea');
    
    if (contentItems.length === 0) {
        contentArea.innerHTML = `
            <div class="content-placeholder">
                <h1>News Ticker Display</h1>
                <p>Add content via the API to display here</p>
            </div>
        `;
        return;
    }
    
    // Clear existing content
    contentArea.innerHTML = '';
    
    // Create content elements
    contentItems.forEach((item, index) => {
        const element = createContentElement(item);
        if (index === currentContentIndex) {
            element.classList.add('active');
        }
        contentArea.appendChild(element);
    });
}

function rotateContent() {
    if (contentItems.length === 0) return;
    
    // Remove active class from current
    const currentElement = document.querySelector('.content-item.active');
    if (currentElement) {
        currentElement.classList.remove('active');
    }
    
    // Move to next
    currentContentIndex = (currentContentIndex + 1) % contentItems.length;
    
    // Add active class to new current
    const nextElement = document.querySelector(`.content-item[data-id="${contentItems[currentContentIndex].id}"]`);
    if (nextElement) {
        nextElement.classList.add('active');
    }
}

function startContentRotation() {
    if (contentRotationInterval) {
        clearInterval(contentRotationInterval);
    }
    
    if (contentItems.length <= 1) {
        return; // No need to rotate if 0 or 1 items
    }
    
    contentRotationInterval = setInterval(() => {
        rotateContent();
    }, config.rotationInterval);
}

function stopContentRotation() {
    if (contentRotationInterval) {
        clearInterval(contentRotationInterval);
    }
}

// Ticker functions
function updateTicker() {
    const tickerContainer = document.querySelector('.ticker-container');
    const tickerContent = document.getElementById('tickerContent');
    
    // Hide ticker if disabled in config
    if (!config.tickerEnabled) {
        if (tickerContainer) {
            tickerContainer.classList.add('ticker-hidden');
        }
        return;
    }
    
    // Show ticker if enabled
    if (tickerContainer) {
        tickerContainer.classList.remove('ticker-hidden');
    }
    
    if (tickerItems.length === 0) {
        tickerContent.innerHTML = '<span class="ticker-item">No news items available</span>';
        return;
    }
    
    // Create ticker items HTML - escape user/RSS content to prevent XSS
    const itemsHTML = tickerItems.map((item, index) => {
        const safeLink = safeUrl(item.link);
        const safeLogo = safeUrl(item.feedLogo);
        const link = safeLink ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener">${escapeHtml(item.title || '')}</a>` : escapeHtml(item.title || '');
        const logo = safeLogo ? `<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(item.feedName || '')}" class="ticker-logo" />` : '';
        const separator = index < tickerItems.length - 1 ? '<span class="ticker-separator">•</span>' : '';
        return `<span class="ticker-item" data-feed-id="${escapeHtml(String(item.feedId || ''))}">${logo}${link}</span>${separator}`;
    }).join('');
    
    // Duplicate content for seamless loop
    tickerContent.innerHTML = itemsHTML + itemsHTML;
    
    // Calculate animation duration based on content width
    const contentWidth = tickerContent.scrollWidth / 2; // Divide by 2 since we duplicated
    const speed = 50; // pixels per second
    const duration = contentWidth / speed;
    
    tickerContent.style.animationDuration = `${duration}s`;
}

// WebSocket event handlers
function requestDashboardData() {
    socket.emit('dashboard:request', dashboardId);
}

socket.on('connect', () => {
    console.log('Connected to server');
    console.log('Dashboard ID:', dashboardId);
    requestDashboardData();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.io.on('reconnect', () => {
    requestDashboardData();
});

// Dashboard-specific event handlers
socket.on(`ticker:update:${dashboardId}`, (items) => {
    tickerItems = items;
    updateTicker();
    if (dashboardMeta.type === 'sports' && lastSportsData && typeof renderSportsDashboard === 'function') {
        renderSportsDashboard(lastSportsData, dashboardMeta.sport, tickerItems, config.rotationInterval);
    }
});

socket.on(`content:update:${dashboardId}`, (items) => {
    const wasEmpty = contentItems.length === 0;
    contentItems = items;
    
    if (dashboardMeta.type === 'sports') return;

    if (wasEmpty && items.length > 0) {
        currentContentIndex = 0;
    } else if (currentContentIndex >= items.length) {
        currentContentIndex = 0;
    }
    
    displayContent();
    startContentRotation();
});

socket.on('content:rotate', () => {
    rotateContent();
});

socket.on(`config:update:${dashboardId}`, (newConfig) => {
    config = newConfig;
    updateTicker(); // Update ticker visibility when config changes
    startContentRotation();
    if (dashboardMeta.type === 'sports' && lastSportsData && typeof renderSportsDashboard === 'function') {
        renderSportsDashboard(lastSportsData, dashboardMeta.sport, tickerItems, config.rotationInterval);
    }
});

socket.on(`dashboard:meta:${dashboardId}`, (meta) => {
    dashboardMeta = meta;
    if (meta.type === 'sports') {
        stopContentRotation();
        if (typeof clearSportsPageRotation === 'function') clearSportsPageRotation();
        if (typeof renderSportsLoading === 'function') {
            renderSportsLoading(meta.sport);
        }
    } else {
        if (typeof clearSportsPageRotation === 'function') clearSportsPageRotation();
        displayContent();
        startContentRotation();
    }
});

socket.on(`sports:update:${dashboardId}`, (data) => {
    if (dashboardMeta.type === 'sports' && typeof renderSportsDashboard === 'function') {
        lastSportsData = data;
        renderSportsDashboard(data, dashboardMeta.sport, tickerItems, config.rotationInterval);
    }
});

// Handle page visibility to pause/resume animations
document.addEventListener('visibilitychange', () => {
    const tickerContent = document.getElementById('tickerContent');
    if (tickerContent) {
        if (document.hidden) {
            tickerContent.classList.add('paused');
        } else {
            tickerContent.classList.remove('paused');
        }
    }
});
