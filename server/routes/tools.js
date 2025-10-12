const express = require('express');
const { requireRole } = require('../middleware/auth');

/**
 * Tools Routes - Admin/Employee tools
 * Protected by employee_admin role
 */
function createToolsRoutes(services) {
  const router = express.Router();
  const { storage, achievementRepo } = services;

  // All routes require employee_admin role
  const employeeOnly = requireRole(storage, 'employee_admin');

  // Get all achievements for management
  router.get('/achievements', employeeOnly, async (req, res) => {
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
