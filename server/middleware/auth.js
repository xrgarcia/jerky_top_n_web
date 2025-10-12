/**
 * Authentication and Authorization Middleware
 */

async function requireAuth(storage) {
  return async (req, res, next) => {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach session and user info to request
    req.session = session;
    req.userId = session.userId;
    
    next();
  };
}

async function requireRole(storage, requiredRole) {
  return async (req, res, next) => {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get user from database to check role
    const user = await storage.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user has required role
    if (user.role !== requiredRole) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to access this resource' 
      });
    }

    // Attach user info to request
    req.session = session;
    req.userId = session.userId;
    req.user = user;
    
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
