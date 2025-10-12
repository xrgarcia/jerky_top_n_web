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

  return router;
}

module.exports = createToolsRoutes;
