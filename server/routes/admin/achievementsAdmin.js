const express = require('express');
const multer = require('multer');
const AchievementAdminRepository = require('../../repositories/AchievementAdminRepository');
const AchievementCache = require('../../cache/AchievementCache');
const { ObjectStorageService } = require('../../objectStorage');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024, // 500KB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only PNG, JPG, JPEG, WebP
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and WebP are allowed.'));
    }
  },
});

/**
 * Trigger background achievement recalculation
 * Awards achievements to users who already meet the requirements
 */
async function triggerAchievementRecalculation(achievementId, database, productsService = null) {
  const { users, achievements } = require('../../shared/schema');
  const { eq } = require('drizzle-orm');
  const { primaryDb } = require('../../db-primary');
  
  // Get the achievement
  const achievement = await database.select()
    .from(achievements)
    .where(eq(achievements.id, achievementId))
    .limit(1);
    
  if (achievement.length === 0) {
    throw new Error('Achievement not found');
  }
  
  const ach = achievement[0];
  console.log(`🔄 Background recalculation started: ${ach.name} (${ach.code})`);
  
  // Get all users
  const allUsers = await database.select({ id: users.id }).from(users);
  console.log(`👥 Processing ${allUsers.length} users in background...`);
  
  // Get the CollectionManager
  const CollectionManager = require('../../services/CollectionManager');
  const AchievementRepository = require('../../repositories/AchievementRepository');
  const ProductsMetadataRepository = require('../../repositories/ProductsMetadataRepository');
  
  const achievementRepo = new AchievementRepository(database);
  const productsMetadataRepo = new ProductsMetadataRepository(database);
  const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, primaryDb, productsService);
  
  // Process users in batches
  const BATCH_SIZE = 5;
  let awardedCount = 0;
  
  for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
    const batch = allUsers.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (user) => {
      try {
        let result = null;
        
        if (ach.collectionType === 'static_collection' || 
            ach.collectionType === 'custom_product_list' || 
            ach.collectionType === 'flavor_coin' ||
            ach.collectionType === 'dynamic_collection') {
          const progress = await collectionManager.calculateCustomProductProgress(user.id, ach);
          if (progress.tier) {
            result = await collectionManager.updateCollectionProgress(user.id, ach, progress);
          }
        }
        
        if (result && result.type === 'new') {
          awardedCount++;
          console.log(`   ✨ User ${user.id}: ${ach.name} awarded (${result.tier})`);
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.id}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  console.log(`✅ Background recalculation complete: ${awardedCount} newly awarded`);
  
  // Invalidate caches
  AchievementCache.getInstance().invalidate();
  const HomeStatsCache = require('../../cache/HomeStatsCache');
  const LeaderboardCache = require('../../cache/LeaderboardCache');
  const homeStatsCache = HomeStatsCache.getInstance();
  const leaderboardCache = LeaderboardCache.getInstance();
  homeStatsCache.invalidate();
  leaderboardCache.invalidate(); // invalidate() with no params clears all
}

/**
 * Admin endpoints for achievement CRUD operations
 * All endpoints require employee authentication
 */

module.exports = function createAdminRoutes(storage, db, productsService = null) {
  const router = express.Router();

  async function requireEmployeeAuth(req, res, next) {
    try {
      const sessionId = req.cookies.session_id;
      
      if (!sessionId) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(403).json({ error: 'Access denied. Invalid session.' });
      }

      // Get user from database to check role and email
      const user = await storage.getUserById(session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Access denied. User not found.' });
      }

      // Allow access if user has employee_admin role OR email ends with @jerky.com
      const hasAccess = user.role === 'employee_admin' || (user.email && user.email.endsWith('@jerky.com'));
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Employee authentication required.' });
      }
      
      // Attach user info to request for use in route handlers
      req.session = session;
      req.userId = session.userId;
      req.user = user;
      req.db = db;
      
      next();
    } catch (error) {
      console.error('Error in requireEmployeeAuth:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

/**
 * GET /api/admin/achievements
 * Get all achievements with statistics
 */
router.get('/achievements', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    const achievements = await adminRepo.getAllAchievementsWithStats();
    
    res.json({ success: true, achievements });
  } catch (error) {
    console.error('Error fetching achievements for admin:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * POST /api/admin/achievements
 * Create a new achievement
 */
router.post('/achievements', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    
    // Validate required fields
    const { code, name, description, icon, collectionType, requirement } = req.body;
    
    if (!code || !name || !description || !icon || !collectionType || !requirement) {
      return res.status(400).json({ 
        error: 'Missing required fields: code, name, description, icon, collectionType, requirement' 
      });
    }
    
    // Check if code already exists
    const existing = await adminRepo.getAchievementByCode(code);
    if (existing) {
      return res.status(400).json({ error: `Achievement with code "${code}" already exists` });
    }
    
    // Create achievement
    const achievement = await adminRepo.createAchievement(req.body);
    
    // Invalidate cache
    const cache = AchievementCache.getInstance();
    cache.invalidate();
    console.log('🗑️ AchievementCache invalidated after creating achievement:', achievement.code);
    
    // Trigger background recalculation for product-based achievements
    // This awards the achievement to users who have already ranked the required products
    if (achievement.collectionType === 'flavor_coin' || 
        achievement.collectionType === 'static_collection' || 
        achievement.collectionType === 'custom_product_list' ||
        achievement.collectionType === 'dynamic_collection') {
      console.log(`🔄 Triggering background recalculation for ${achievement.collectionType}: ${achievement.code}`);
      
      // Run recalculation asynchronously (don't await - runs in background)
      triggerAchievementRecalculation(achievement.id, req.db, productsService).catch(err => {
        console.error(`❌ Background recalculation failed for achievement ${achievement.id}:`, err);
      });
    }
    
    res.status(201).json({ success: true, achievement });
  } catch (error) {
    console.error('Error creating achievement:', error);
    res.status(500).json({ error: 'Failed to create achievement', details: error.message });
  }
});

/**
 * PUT /api/admin/achievements/:id
 * Update an existing achievement
 */
router.put('/achievements/:id', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    const achievementId = parseInt(req.params.id);
    
    if (isNaN(achievementId)) {
      return res.status(400).json({ error: 'Invalid achievement ID' });
    }
    
    // Validate required fields
    const { name, description, icon, collectionType, requirement } = req.body;
    
    if (!name || !description || !icon || !collectionType || !requirement) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, description, icon, collectionType, requirement' 
      });
    }
    
    // Update achievement
    const achievement = await adminRepo.updateAchievement(achievementId, req.body);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    // Invalidate cache
    const cache = AchievementCache.getInstance();
    cache.invalidate();
    console.log('🗑️ AchievementCache invalidated after updating achievement:', achievement.code);
    
    res.json({ success: true, achievement });
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ error: 'Failed to update achievement', details: error.message });
  }
});

/**
 * PATCH /api/admin/achievements/:id/toggle
 * Toggle achievement active/inactive status
 */
router.patch('/achievements/:id/toggle', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    const achievementId = parseInt(req.params.id);
    
    if (isNaN(achievementId)) {
      return res.status(400).json({ error: 'Invalid achievement ID' });
    }
    
    const achievement = await adminRepo.toggleAchievementStatus(achievementId);
    
    // Invalidate cache
    const cache = AchievementCache.getInstance();
    cache.invalidate();
    console.log('🗑️ AchievementCache invalidated after toggling achievement:', achievement.code);
    
    res.json({ success: true, achievement });
  } catch (error) {
    console.error('Error toggling achievement status:', error);
    res.status(500).json({ error: 'Failed to toggle achievement status', details: error.message });
  }
});

/**
 * DELETE /api/admin/achievements/:id
 * Delete an achievement (soft delete if users have earned it)
 * Automatically cleans up orphaned icon files from Object Storage
 */
router.delete('/achievements/:id', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    const achievementId = parseInt(req.params.id);
    
    if (isNaN(achievementId)) {
      return res.status(400).json({ error: 'Invalid achievement ID' });
    }
    
    // Get achievement data before deletion to check icon
    const achievement = await adminRepo.getAchievementById(achievementId);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    // Delete the achievement
    const result = await adminRepo.deleteAchievement(achievementId);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    // Check if icon should be deleted (only for image icons)
    if (achievement.iconType === 'image' && achievement.icon && achievement.icon.startsWith('/objects/')) {
      try {
        // Check if any other achievements use this icon
        const iconUsageCount = await adminRepo.countAchievementsUsingIcon(achievement.icon, achievementId);
        
        if (iconUsageCount === 0) {
          // No other achievements use this icon - safe to delete
          const objectStorage = new ObjectStorageService();
          await objectStorage.deleteIcon(achievement.icon);
          console.log('🗑️ Deleted orphaned icon from storage:', achievement.icon);
        } else {
          console.log(`ℹ️ Icon still in use by ${iconUsageCount} other achievement(s), keeping: ${achievement.icon}`);
        }
      } catch (iconError) {
        // Log error but don't fail the achievement deletion
        console.error('⚠️ Error cleaning up icon, continuing:', iconError.message);
      }
    }
    
    // Invalidate cache
    const cache = AchievementCache.getInstance();
    cache.invalidate();
    console.log('🗑️ AchievementCache invalidated after deleting achievement:', achievementId);
    
    res.json({ success: true, message: 'Achievement deleted successfully' });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    res.status(500).json({ error: 'Failed to delete achievement', details: error.message });
  }
});

/**
 * GET /api/admin/achievements/by-type/:type
 * Get achievements filtered by collection type
 */
router.get('/achievements/by-type/:type', requireEmployeeAuth, async (req, res) => {
  try {
    const adminRepo = new AchievementAdminRepository(req.db);
    const { type } = req.params;
    
    let achievements = [];
    
    switch (type) {
      case 'dynamic':
        achievements = await adminRepo.getDynamicCollections();
        break;
      case 'engagement':
        achievements = await adminRepo.getEngagementCollections();
        break;
      case 'static':
      case 'custom': // Backward compatibility (custom_product_list → static_collection)
        achievements = await adminRepo.getStaticCollections();
        break;
      case 'hidden':
        achievements = await adminRepo.getHiddenAchievements();
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Use: dynamic, engagement, static, or hidden' });
    }
    
    res.json({ success: true, achievements });
  } catch (error) {
    console.error(`Error fetching ${req.params.type} achievements:`, error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * POST /api/admin/achievements/upload-icon
 * Upload achievement icon file
 */
router.post('/achievements/upload-icon', requireEmployeeAuth, upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const objectStorageService = new ObjectStorageService();
    const objectPath = await objectStorageService.uploadIconFromBuffer(
      req.file.buffer,
      req.file.originalname
    );

    res.json({ success: true, objectPath });
  } catch (error) {
    console.error('Error uploading icon:', error);
    res.status(500).json({ error: 'Failed to upload icon', details: error.message });
  }
});

/**
 * POST /api/admin/achievements/confirm-icon-upload
 * Confirm icon upload and make it publicly accessible
 */
router.post('/achievements/confirm-icon-upload', requireEmployeeAuth, async (req, res) => {
  try {
    const { uploadURL } = req.body;
    
    if (!uploadURL) {
      return res.status(400).json({ error: 'Upload URL is required' });
    }
    
    const objectStorageService = new ObjectStorageService();
    const iconPath = await objectStorageService.setObjectPublic(uploadURL);
    
    res.json({ success: true, iconPath });
  } catch (error) {
    console.error('Error confirming icon upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload', details: error.message });
  }
});

  return router;
};
