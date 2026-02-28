// Admin UI - API integration for News Ticker

const API = '/api';

/**
 * Get the currently selected dashboard id from the dashboard select element.
 * @returns {string} The selected dashboard id, or `'default'` if no value is set.
 */
function getDashboardId() {
  return document.getElementById('dashboardSelect').value || 'default';
}

/**
 * Displays a transient toast message in the page's '#toast' element.
 *
 * Shows the provided message, applies error or success styling, makes the toast visible,
 * clears any previously scheduled hide timer, and hides the toast after 4 seconds.
 *
 * @param {string} message - The text to display inside the toast.
 * @param {boolean} [isError=false] - If true, apply error styling; otherwise apply success styling.
 */
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

/**
 * Perform an HTTP request against the configured API base and return the parsed JSON response.
 * @param {string} method - HTTP method (e.g., "GET", "POST", "PUT", "DELETE").
 * @param {string} path - Path appended to the API base (should begin with '/').
 * @param {any} [body] - Optional request payload which will be JSON-stringified and sent with a Content-Type of application/json.
 * @returns {any} The parsed JSON response from the server (or an empty object when response body is not valid JSON).
 * @throws {Error} When the response has a non-ok HTTP status; the error message is taken from the response `error` field or `HTTP {status}`.
 */
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

/**
 * Load dashboards from the API and update the dashboard selector, view link, and dashboard list UI.
 *
 * Fetches the dashboard list, populates the element with id `dashboardSelect` with options (using each
 * dashboard's `name` or `id`), preserves the previously selected dashboard when present or selects the
 * first dashboard if none, updates the view dashboard link, and calls `renderDashboardsList` with the list.
 */
async function loadDashboards() {
  const list = await api('GET', '/dashboards');
  const select = document.getElementById('dashboardSelect');
  const current = select.value;
  select.textContent = '';
  if (list.length === 0) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'No dashboards';
    select.appendChild(placeholder);
  } else {
    for (const d of list) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name || d.id;
      select.appendChild(opt);
    }
    if (current && list.some(d => d.id === current)) select.value = current;
    else select.value = list[0].id;
  }
  updateViewDashboardLink();
  renderDashboardsList(list);
}

/**
 * Render the provided dashboard entries into the UI and wire their edit/delete actions.
 *
 * Inserts list items into the element with id "dashboardsList", showing each dashboard's name (or id)
 * and id, omitting a Delete button for the dashboard whose id is "default". Click handlers for the
 * edit and delete controls are attached after rendering.
 *
 * @param {Array<Object>} list - Array of dashboard objects. Each object must include an `id` string and may include a `name` string.
 */
function renderDashboardsList(list) {
  const el = document.getElementById('dashboardsList');
  el.textContent = '';
  for (const d of list) {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.setAttribute('data-id', d.id);
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = d.name || d.id;
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' (' + d.id + ')'));
    item.appendChild(span);
    const actions = document.createElement('div');
    actions.className = 'admin-list-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => editDashboard(d.id);
    actions.appendChild(editBtn);
    if (d.id !== 'default') {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete';
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => deleteDashboard(d.id);
      actions.appendChild(delBtn);
    }
    item.appendChild(actions);
    el.appendChild(item);
  }
}

/**
 * Handle the create-dashboard form submission by validating input, creating a dashboard, and refreshing related UI sections.
 * 
 * Validates the dashboard ID (required; letters, numbers, dashes, and underscores only). On successful creation shows a success toast, resets the form, and reloads dashboards, feeds, content, and config. On validation failure or API error shows an error toast.
 * @param {Event} e - Submit event from the create-dashboard form.
 */
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
    await Promise.all([loadDashboards(), loadFeeds(), loadContent(), loadConfig()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Update a dashboard's name and description on the server and refresh the dashboards list.
 * @param {string} id - The dashboard identifier to update.
 * @param {string} name - The new display name for the dashboard.
 * @param {string} description - The new description for the dashboard.
 */
async function updateDashboard(id, name, description) {
  try {
    await api('PUT', `/dashboards/${id}`, { name, description });
    showToast('Dashboard updated');
    await loadDashboards();
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Delete the dashboard with the given id after confirming with the user and refresh related UI sections.
 *
 * Prompts the user for confirmation; if confirmed, removes the dashboard and refreshes dashboards, feeds, content, and config views. On failure, displays an error message.
 * @param {string} id - The dashboard identifier to delete.
 */
async function deleteDashboard(id) {
  if (!confirm(`Delete dashboard "${id}"?`)) return;
  try {
    await api('DELETE', `/dashboards/${id}`);
    showToast('Dashboard deleted');
    await Promise.all([loadDashboards(), loadFeeds(), loadContent(), loadConfig()]);
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Prompts the user to edit the dashboard's name and description and updates it when confirmed.
 *
 * If the dashboard id is not found or the user cancels either prompt, no action is taken.
 * @param {string} id - The dashboard identifier to edit.
 */
function editDashboard(id) {
  const d = Array.from(document.querySelectorAll('#dashboardsList .admin-list-item')).find(el => el.dataset.id === id);
  if (!d) return;
  const name = prompt('Dashboard name:', d.querySelector('strong').textContent);
  if (name === null) return;
  const description = prompt('Description:', '');
  if (description === null) return;
  updateDashboard(id, name, description);
}

/**
 * Load the feeds for the currently selected dashboard and render them into the UI.
 */
async function loadFeeds() {
  const dashboardId = getDashboardId();
  const list = await api('GET', `/feeds?dashboard=${dashboardId}`);
  renderFeedsList(list);
}

/**
 * Render the provided list of feeds into the #feedsList element and wire delete buttons.
 *
 * Populates the DOM element with id "feedsList" with each feed's name (or "Unnamed") and URL,
 * shows a "No feeds" message when the list is empty, and attaches click handlers that delete
 * the corresponding feed when its Delete button is clicked.
 * @param {Array<Object>} list - Array of feed objects to render.
 * @param {string} list[].id - Unique identifier of the feed.
 * @param {string} [list[].name] - Display name of the feed; may be absent.
 * @param {string} list[].url - URL of the feed.
 */
function renderFeedsList(list) {
  const el = document.getElementById('feedsList');
  el.textContent = '';
  if (list.length === 0) {
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = 'No feeds';
    el.appendChild(p);
    return;
  }
  for (const f of list) {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.setAttribute('data-id', f.id);
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = f.name || 'Unnamed';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' — ' + f.url));
    item.appendChild(span);
    const actions = document.createElement('div');
    actions.className = 'admin-list-actions';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteFeed(f.id);
    actions.appendChild(delBtn);
    item.appendChild(actions);
    el.appendChild(item);
  }
}

/**
 * Handle the add-feed form submission: validate the feed and (optional) logo URLs, create the feed for the current dashboard via the API, show success or error toasts, reset the form, and reload the feeds list.
 * @param {Event} e - The form submit event.
 */
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
    await loadFeeds();
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Remove a feed by its id from the currently selected dashboard.
 *
 * Deletes the feed, shows a success toast and reloads the feeds list on success; on error shows an error toast.
 * @param {string} id - The feed identifier to delete.
 */
async function deleteFeed(id) {
  try {
    await api('DELETE', `/feeds/${id}?dashboard=${getDashboardId()}`);
    showToast('Feed deleted');
    await loadFeeds();
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Load content items for the current dashboard and render them into the UI.
 *
 * Fetches the content list for the selected dashboard and updates the page's content list display.
 */
async function loadContent() {
  const dashboardId = getDashboardId();
  const list = await api('GET', `/content?dashboard=${dashboardId}`);
  renderContentList(list);
}

/**
 * Render a list of content items into the DOM and attach delete handlers.
 *
 * Populates the element with id "contentList" with the provided items; each item shows its title (or "Untitled" if missing) and URL. If the list is empty, displays a "No content" message. Adds click handlers to each item's Delete button that invoke `deleteContent` with the item's `id`.
 *
 * @param {Array<{id: string, url: string, title?: string}>} list - Array of content objects to render. Each object must include `id` and `url`; `title` is optional.
 */
function renderContentList(list) {
  const el = document.getElementById('contentList');
  el.textContent = '';
  if (list.length === 0) {
    const p = document.createElement('p');
    p.className = 'admin-empty';
    p.textContent = 'No content';
    el.appendChild(p);
    return;
  }
  for (const c of list) {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.setAttribute('data-id', c.id);
    const span = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = c.title || 'Untitled';
    span.appendChild(strong);
    span.appendChild(document.createTextNode(' — ' + c.url));
    item.appendChild(span);
    const actions = document.createElement('div');
    actions.className = 'admin-list-actions';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteContent(c.id);
    actions.appendChild(delBtn);
    item.appendChild(actions);
    el.appendChild(item);
  }
}

/**
 * Handle the add-content form submission and create a new content item for the current dashboard.
 *
 * Validates the provided URL, posts `{ url, title, type }` to the server for the selected dashboard,
 * shows a success or error toast, resets the form on success, and reloads the content list.
 *
 * @param {Event} e - The submit event from the add content form.
 */
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
    await loadContent();
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Delete a content item from the currently selected dashboard.
 *
 * On success, displays a success toast and refreshes the content list; on failure, displays an error toast with the failure message.
 * @param {string} id - The ID of the content item to delete.
 */
async function deleteContent(id) {
  try {
    await api('DELETE', `/content/${id}?dashboard=${getDashboardId()}`);
    showToast('Content deleted');
    await loadContent();
  } catch (err) {
    showToast(err.message, true);
  }
}

/**
 * Populate configuration form fields for the current dashboard from the server.
 *
 * Fetches the config for the selected dashboard and updates DOM elements:
 * - Sets #rotationInterval to the fetched `rotationInterval` or 30000 if missing.
 * - Sets #tickerRefreshInterval to the fetched `tickerRefreshInterval` or 300000 if missing.
 * - Sets #maxTickerItems to the fetched `maxTickerItems` or 50 if missing.
 * - Sets #tickerEnabled checked state to `true` unless the fetched `tickerEnabled` is explicitly `false`.
 */
async function loadConfig() {
  const dashboardId = getDashboardId();
  const cfg = await api('GET', `/config?dashboard=${dashboardId}`);
  document.getElementById('rotationInterval').value = cfg.rotationInterval ?? 30000;
  document.getElementById('tickerRefreshInterval').value = cfg.tickerRefreshInterval ?? 300000;
  document.getElementById('maxTickerItems').value = cfg.maxTickerItems ?? 50;
  document.getElementById('tickerEnabled').checked = cfg.tickerEnabled !== false;
}

/**
 * Validate and save dashboard configuration from the form inputs.
 *
 * Reads rotationInterval, tickerRefreshInterval, maxTickerItems, and tickerEnabled
 * from the page, validates their constraints, posts the configuration for the
 * current dashboard, and shows a success or error toast.
 *
 * Validation constraints:
 * - rotationInterval must be >= 5000
 * - tickerRefreshInterval must be >= 60000
 * - maxTickerItems must be between 10 and 200 (inclusive)
 *
 * @param {Event} e - The form submit event.
 */
async function saveConfig(e) {
  e.preventDefault();
  const rotationInterval = parseInt(document.getElementById('rotationInterval').value, 10);
  const tickerRefreshInterval = parseInt(document.getElementById('tickerRefreshInterval').value, 10);
  const maxTickerItems = parseInt(document.getElementById('maxTickerItems').value, 10);
  const tickerEnabled = document.getElementById('tickerEnabled').checked;
  if (!Number.isFinite(rotationInterval)) {
    showToast('Rotation interval must be a valid number', true);
    return;
  }
  if (!Number.isFinite(tickerRefreshInterval)) {
    showToast('Ticker refresh must be a valid number', true);
    return;
  }
  if (!Number.isFinite(maxTickerItems)) {
    showToast('Max ticker items must be a valid number', true);
    return;
  }
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

/**
 * Update the "viewDashboardLink" element's href to point to the currently selected dashboard.
 *
 * Sets the href to "/dashboard/{id}", where {id} is the current dashboard id.
 */
function updateViewDashboardLink() {
  const link = document.getElementById('viewDashboardLink');
  link.href = '/dashboard/' + getDashboardId();
}

// Init
document.getElementById('createDashboardForm').onsubmit = createDashboard;
document.getElementById('addFeedForm').onsubmit = addFeed;
document.getElementById('addContentForm').onsubmit = addContent;
document.getElementById('configForm').onsubmit = saveConfig;

document.getElementById('dashboardSelect').onchange = async () => {
  updateViewDashboardLink();
  try {
    await Promise.all([loadFeeds(), loadContent(), loadConfig()]);
  } catch (err) {
    showToast('Failed to load: ' + err.message, true);
  }
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
