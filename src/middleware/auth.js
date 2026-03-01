/**
 * Authentication middleware for admin routes.
 * When ADMIN_PASSWORD is set, requires a valid session with role 'admin'.
 * When ADMIN_PASSWORD is not set (e.g. dev/test), allows all requests.
 */

function ensureAuthenticated(req, res, next) {
  if (!process.env.ADMIN_PASSWORD) {
    return next();
  }
  if (req.session?.authenticated === true && req.session?.role === 'admin') {
    return next();
  }
  const isApi = req.originalUrl.startsWith('/api');
  if (isApi) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login');
}

module.exports = { ensureAuthenticated };
