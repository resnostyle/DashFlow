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
