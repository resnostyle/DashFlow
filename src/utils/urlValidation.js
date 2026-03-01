/**
 * Validate that a URL is safe for outbound fetch (prevents SSRF).
 * Rejects localhost, private IPs, link-local, file:, javascript:, data:, etc.
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFetchUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { valid: false, error: 'URL must use http or https' };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return { valid: false, error: 'localhost URLs are not allowed' };
  }
  // Reject private/link-local IPv4
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number);
    if (a === 10) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 172 && b >= 16 && b <= 31) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 192 && b === 168) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 169 && b === 254) return { valid: false, error: 'Link-local addresses not allowed' };
  }
  return { valid: true };
}

/**
 * Validate URL for API input (format + basic safety). Uses validateFetchUrl for fetch URLs.
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  return validateFetchUrl(url);
}

module.exports = { validateFetchUrl, validateUrl };
