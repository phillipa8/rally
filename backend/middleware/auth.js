// auth.js — authentication middleware (session-cookie based).

// Blocks unauthenticated requests to protected routes with 401.
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = req.session.userId;
  next();
}

// Attaches req.userId (or null) without blocking — for routes that are public
// but behave differently when logged in (e.g. applying post visibility).
export function optionalAuth(req, _res, next) {
  req.userId = req.session && req.session.userId ? req.session.userId : null;
  next();
}
