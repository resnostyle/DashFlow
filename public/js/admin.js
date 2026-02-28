// Admin UI - API integration for News Ticker

const API = '/api';

function getDashboardId() {
  return document.getElementById('dashboardSelect').value || 'default';
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Dashboards
async function loadDashboards() {
  const list = await api('GET', '/dashboards');
  const select = document.getElementById('dashboardSelect');
  const current = select.value;
  select.innerHTML = list.map(d => `<option value="${d.id}">${d.name || d.id}</option>`).join('');
  if (current && list.some(d => d.id === current)) select.value = current;
  else if (list.length) select.value = list[0].id;
  updateViewDashboardLink();
  renderDashboardsList(list);
}

function renderDashboardsList(list) {
  const el = document.getElementById('dashboardsList');
  el.innerHTML = list.map(d => {
    const canDelete = d.id !== 'default';
    return `
      <div class="admin-list-item" data-id="${d.id}">
        <span><strong>${d.name || d.id}</strong> (${d.id})</span>
        <div class="admin-list-actions">
          <button type="button" class="btn-edit" data-id="${d.id}">Edit</button>
          ${canDelete ? `<button type="button" class="btn-delete" data-id="${d.id}">Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => deleteDashboard(btn.dataset.id);
  });
  el.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => editDashboard(btn.dataset.id);
  });
}

async function createDashboard(e) {
  e.preventDefault();
  const id = document.getElementById('dashboardId').value.trim();
  const name = document.getElementById('dashboardName').value.trim();
  const description = document.getElementById('dashboardDesc').value.trim();
  if (!id) {
    showToast('Dashboard ID is required', true);
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    showToast('ID must use only letters, numbers, dashes, and underscores', true);
    return;
  }
  try {
    await api('POST', '/dashboards', { id, name, description });
    showToast('Dashboard created');
    document.getElementById('createDashboardForm').reset();
    loadDashboards();
    loadFeeds();
    loadContent();
    loadConfig();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function updateDashboard(id, name, description) {
  try {
    await api('PUT', `/dashboards/${id}`, { name, description });
    showToast('Dashboard updated');
    loadDashboards();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteDashboard(id) {
  if (!confirm(`Delete dashboard "${id}"?`)) return;
  try {
    await api('DELETE', `/dashboards/${id}`);
    showToast('Dashboard deleted');
    loadDashboards();
    loadFeeds();
    loadContent();
    loadConfig();
  } catch (err) {
    showToast(err.message, true);
  }
}

function editDashboard(id) {
  const d = Array.from(document.querySelectorAll('#dashboardsList .admin-list-item')).find(el => el.dataset.id === id);
  if (!d) return;
  const name = prompt('Dashboard name:', d.querySelector('strong').textContent);
  if (name === null) return;
  const description = prompt('Description:', '');
  if (description === null) return;
  updateDashboard(id, name, description);
}

// Feeds
async function loadFeeds() {
  const dashboardId = getDashboardId();
  const list = await api('GET', `/feeds?dashboard=${dashboardId}`);
  renderFeedsList(list);
}

function renderFeedsList(list) {
  const el = document.getElementById('feedsList');
  el.innerHTML = list.length ? list.map(f => `
    <div class="admin-list-item" data-id="${f.id}">
      <span><strong>${f.name || 'Unnamed'}</strong> — ${f.url}</span>
      <div class="admin-list-actions">
        <button type="button" class="btn-delete" data-id="${f.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<p class="admin-empty">No feeds</p>';
  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => deleteFeed(btn.dataset.id);
  });
}

async function addFeed(e) {
  e.preventDefault();
  const name = document.getElementById('feedName').value.trim();
  const url = document.getElementById('feedUrl').value.trim();
  const logo = document.getElementById('feedLogo').value.trim();
  if (!url) {
    showToast('Feed URL is required', true);
    return;
  }
  try {
    new URL(url);
    if (logo) new URL(logo);
  } catch {
    showToast('Invalid URL format', true);
    return;
  }
  try {
    await api('POST', `/feeds?dashboard=${getDashboardId()}`, { name, url, logo: logo || undefined });
    showToast('Feed added');
    document.getElementById('addFeedForm').reset();
    loadFeeds();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteFeed(id) {
  try {
    await api('DELETE', `/feeds/${id}?dashboard=${getDashboardId()}`);
    showToast('Feed deleted');
    loadFeeds();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Content
async function loadContent() {
  const dashboardId = getDashboardId();
  const list = await api('GET', `/content?dashboard=${dashboardId}`);
  renderContentList(list);
}

function renderContentList(list) {
  const el = document.getElementById('contentList');
  el.innerHTML = list.length ? list.map(c => `
    <div class="admin-list-item" data-id="${c.id}">
      <span><strong>${c.title || 'Untitled'}</strong> — ${c.url}</span>
      <div class="admin-list-actions">
        <button type="button" class="btn-delete" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join('') : '<p class="admin-empty">No content</p>';
  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => deleteContent(btn.dataset.id);
  });
}

async function addContent(e) {
  e.preventDefault();
  const url = document.getElementById('contentUrl').value.trim();
  const title = document.getElementById('contentTitle').value.trim();
  const type = document.getElementById('contentType').value;
  if (!url) {
    showToast('Content URL is required', true);
    return;
  }
  try {
    new URL(url);
  } catch {
    showToast('Invalid URL format', true);
    return;
  }
  try {
    await api('POST', `/content?dashboard=${getDashboardId()}`, { url, title, type });
    showToast('Content added');
    document.getElementById('addContentForm').reset();
    loadContent();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function deleteContent(id) {
  try {
    await api('DELETE', `/content/${id}?dashboard=${getDashboardId()}`);
    showToast('Content deleted');
    loadContent();
  } catch (err) {
    showToast(err.message, true);
  }
}

// Config
async function loadConfig() {
  const dashboardId = getDashboardId();
  const cfg = await api('GET', `/config?dashboard=${dashboardId}`);
  document.getElementById('rotationInterval').value = cfg.rotationInterval ?? 30000;
  document.getElementById('tickerRefreshInterval').value = cfg.tickerRefreshInterval ?? 300000;
  document.getElementById('maxTickerItems').value = cfg.maxTickerItems ?? 50;
  document.getElementById('tickerEnabled').checked = cfg.tickerEnabled !== false;
}

async function saveConfig(e) {
  e.preventDefault();
  const rotationInterval = parseInt(document.getElementById('rotationInterval').value, 10);
  const tickerRefreshInterval = parseInt(document.getElementById('tickerRefreshInterval').value, 10);
  const maxTickerItems = parseInt(document.getElementById('maxTickerItems').value, 10);
  const tickerEnabled = document.getElementById('tickerEnabled').checked;
  if (rotationInterval < 5000) {
    showToast('Rotation interval must be at least 5000ms', true);
    return;
  }
  if (tickerRefreshInterval < 60000) {
    showToast('Ticker refresh must be at least 60000ms', true);
    return;
  }
  if (maxTickerItems < 10 || maxTickerItems > 200) {
    showToast('Max ticker items must be between 10 and 200', true);
    return;
  }
  try {
    await api('POST', `/config?dashboard=${getDashboardId()}`, {
      rotationInterval,
      tickerRefreshInterval,
      maxTickerItems,
      tickerEnabled
    });
    showToast('Config saved');
  } catch (err) {
    showToast(err.message, true);
  }
}

function updateViewDashboardLink() {
  const link = document.getElementById('viewDashboardLink');
  link.href = '/dashboard/' + getDashboardId();
}

// Init
document.getElementById('createDashboardForm').onsubmit = createDashboard;
document.getElementById('addFeedForm').onsubmit = addFeed;
document.getElementById('addContentForm').onsubmit = addContent;
document.getElementById('configForm').onsubmit = saveConfig;

document.getElementById('dashboardSelect').onchange = () => {
  updateViewDashboardLink();
  loadFeeds();
  loadContent();
  loadConfig();
};

(async () => {
  try {
    await loadDashboards();
    await loadFeeds();
    await loadContent();
    await loadConfig();
  } catch (err) {
    showToast('Failed to load data: ' + err.message, true);
  }
})();
