/**
 * Escape HTML special characters to prevent XSS when interpolating user/RSS-sourced strings into HTML.
 * @param {string} str - Raw string (may contain HTML/script)
 * @returns {string} Escaped string safe for HTML text content
 */
function escapeHtml(str) {
  if (str == null || typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Validate that a URL is safe for href or src (http/https only). Prevents javascript:, data:, etc.
 * @param {string} url - URL to validate
 * @returns {string} The URL if safe, or empty string
 */
function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return '';
}

/**
 * Normalize ESPN team color (e.g. "00539b") to CSS hex (#00539b).
 * @param {string} color - Team color from API (with or without #)
 * @returns {string|null} Valid hex color or null
 */
function normalizeTeamColor(color) {
  if (!color || typeof color !== 'string') return null;
  const hex = color.replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return '#' + hex.toLowerCase();
  return null;
}

/**
 * Derive a darker shade for backgrounds (mix color with black).
 * @param {string} hex - CSS hex color
 * @param {number} amount - 0-1, how much to darken (0.8 = 80% original)
 * @returns {string} Darker hex
 */
function darkenHex(hex, amount) {
  if (!hex || !hex.match(/^#[0-9a-fA-F]{6}$/)) return hex || '#0a1628';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const r2 = Math.round(r * amount);
  const g2 = Math.round(g * amount);
  const b2 = Math.round(b * amount);
  return '#' + [r2, g2, b2].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive a lighter shade for accents (mix color with white).
 * @param {string} hex - CSS hex color
 * @param {number} amount - 0-1, how much to lighten (0.6 = 60% white)
 * @returns {string} Lighter hex
 */
function lightenHex(hex, amount) {
  if (!hex || !hex.match(/^#[0-9a-fA-F]{6}$/)) return hex || '#4a9eff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const r2 = Math.round(r + (255 - r) * amount);
  const g2 = Math.round(g + (255 - g) * amount);
  const b2 = Math.round(b + (255 - b) * amount);
  return '#' + [r2, g2, b2].map(x => x.toString(16).padStart(2, '0')).join('');
}
