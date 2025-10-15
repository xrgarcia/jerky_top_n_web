const express = require('express');

/**
 * Tools Routes - Admin/Employee tools
 * Protected by employee_admin role
 */
function createToolsRoutes(services) {
  const router = express.Router();
  const { storage, achievementRepo } = services;

  // Middleware to check employee role
  async function checkEmployeeRole(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.role !== 'employee_admin') {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'You do not have permission to access this resource' 
        });
      }

      req.user = user;
      req.session = session;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Get all achievements for management
  router.get('/achievements', checkEmployeeRole, async (req, res) => {
    try {
      const achievements = await achievementRepo.getAllAchievements();
      
      // Add earning stats for each achievement
      const achievementsWithStats = await Promise.all(
        achievements.map(async (achievement) => {
          const earningCount = await achievementRepo.getAchievementEarningCount(achievement.id);
          return {
            ...achievement,
            earningCount: earningCount || 0
          };
        })
      );

      res.json({ achievements: achievementsWithStats });
    } catch (error) {
      console.error('Error fetching achievements for tools:', error);
      res.status(500).json({ error: 'Failed to fetch achievements' });
    }
  });

  // Get live active users (WebSocket connections)
  router.get('/live-users', checkEmployeeRole, async (req, res) => {
    try {
      const { wsGateway } = services;
      
      if (!wsGateway) {
        return res.status(503).json({ error: 'WebSocket service unavailable' });
      }

      const activeUsers = wsGateway.getActiveUsers();
      
      const sanitizedUsers = activeUsers.map(user => ({
        ...user,
        lastName: user.lastName ? user.lastName.charAt(0) + '.' : '',
        email: user.role === 'employee_admin' ? user.email : user.email.split('@')[0] + '@***'
      }));
      
      res.json({ 
        users: sanitizedUsers,
        count: sanitizedUsers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching live users:', error);
      res.status(500).json({ error: 'Failed to fetch live users' });
    }
  });

  // Get all products for management
  router.get('/products', checkEmployeeRole, async (req, res) => {
    try {
      const { productsService } = services;
      
      if (!productsService) {
        return res.status(503).json({ error: 'Products service unavailable' });
      }

      const products = await productsService.getAllProducts();
      
      res.json({ 
        products: products,
        count: products.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching products for tools:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  return router;
}

module.exports = createToolsRoutes;
