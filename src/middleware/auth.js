// Authentication middleware - requires user to be logged in
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Optional auth - doesn't require authentication but sets user if available
function optionalAuth(req, res, next) {
  req.userId = req.session?.userId || null;
  next();
}

// Requires email verification
function requireEmailVerified(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.session.emailVerified) {
    return res.status(403).json({ error: 'Email verification required' });
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireEmailVerified,
};
