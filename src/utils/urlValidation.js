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

  // Hostname checks (localhost, hostnames)
  if (hostname === 'localhost') {
    return { valid: false, error: 'localhost URLs are not allowed' };
  }
  if (hostname === '::1') {
    return { valid: false, error: 'localhost URLs are not allowed' };
  }

  // IPv4 checks
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    if (a === 0 && b === 0 && c === 0 && d === 0) {
      return { valid: false, error: '0.0.0.0 is not allowed' };
    }
    if (a === 127) {
      return { valid: false, error: 'localhost URLs are not allowed' };
    }
    if (a === 10) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 172 && b >= 16 && b <= 31) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 192 && b === 168) return { valid: false, error: 'Private IP ranges not allowed' };
    if (a === 169 && b === 254) return { valid: false, error: 'Link-local addresses not allowed' };
    return { valid: true };
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x) - reject entire ::ffff:0:0/96 range
  if (hostname.startsWith('::ffff:')) {
    return { valid: false, error: 'IPv4-mapped IPv6 addresses not allowed' };
  }

  // IPv6 private (fc00::/7) and link-local (fe80::/10)
  const firstSegment = hostname.split(':')[0] || '';
  const firstHex = parseInt(firstSegment, 16);
  if (!isNaN(firstHex)) {
    if (firstHex >= 0xfc00 && firstHex <= 0xfdff) {
      return { valid: false, error: 'Private IP ranges not allowed' };
    }
    if (firstHex >= 0xfe80 && firstHex <= 0xfebf) {
      return { valid: false, error: 'Link-local addresses not allowed' };
    }
  }

  return { valid: true };
}

/**
 * Alias for validateFetchUrl. Kept for backward compatibility.
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  return validateFetchUrl(url);
}

module.exports = { validateFetchUrl, validateUrl };
