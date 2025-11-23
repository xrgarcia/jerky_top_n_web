const express = require('express');
const multer = require('multer');
const { imageSize } = require('image-size');
const { users } = require('../../shared/schema');
const { eq, sql } = require('drizzle-orm');
const { 
  generateUniqueHandle, 
  isHandleAvailable, 
  validateHandleFormat 
} = require('../utils/handleGenerator');
const { ObjectStorageService } = require('../objectStorage');
const ProfileRepository = require('../repositories/ProfileRepository');

function createProfileRoutes(services) {
  const { db, storage, leaderboardManager, achievementRepo, productsService } = services;
  const router = express.Router();
  const objectStorage = new ObjectStorageService();
  
  // Instantiate ProfileRepository with ProductsService (golden source for product data)
  const profileRepository = new ProfileRepository(productsService);

  // Configure multer for profile image uploads
  const profileImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 500 * 1024, // 500KB max (client should compress to ~200KB)
    },
    fileFilter: (req, file, cb) => {
      // Accept only JPEG (client compresses to JPEG)
      const allowedMimes = ['image/jpeg', 'image/jpg'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG images are allowed.'));
      }
    },
  });

  /**
   * GET /api/profile
   * Get current user's profile
   */
  router.get('/', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Fetch user profile from database
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          first_name: users.firstName,
          last_name: users.lastName,
          display_name: users.displayName,
          profile_image_url: users.profileImageUrl,
          handle: users.handle,
          hide_name_privacy: users.hideNamePrivacy,
          created_at: users.createdAt,
          shopify_created_at: users.shopifyCreatedAt,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * GET /api/profile/:userId
   * Get public profile page data for any user
   * Returns: hero data, top products, timeline moments, all rankings, achievements
   */
  router.get('/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Fetch core profile data in parallel (rankings split to separate endpoint for performance)
      const [
        profileData,
        topProducts,
        timelineMoments,
        achievements
      ] = await Promise.all([
        profileRepository.getUserProfileData(userId),
        profileRepository.getTopRankedProducts(userId),
        profileRepository.getTimelineMoments(userId),
        achievementRepo.getUserAchievements(userId)
      ]);

      if (!profileData) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get classification data (journey stage, etc.)
      const UserClassificationCache = require('../cache/UserClassificationCache');
      const classificationCache = UserClassificationCache.getInstance();
      
      let classification = await classificationCache.get(userId);
      
      // Fallback to database if cache miss
      if (!classification) {
        const { userClassifications } = require('../../shared/schema');
        const dbResult = await db
          .select()
          .from(userClassifications)
          .where(eq(userClassifications.userId, userId))
          .limit(1);
        
        if (dbResult.length > 0) {
          classification = {
            journeyStage: dbResult[0].journeyStage,
            engagementLevel: dbResult[0].engagementLevel,
            explorationBreadth: dbResult[0].explorationBreadth,
            focusAreas: dbResult[0].focusAreas,
            classificationData: dbResult[0].classificationData
          };
          
          await classificationCache.set(userId, classification);
        }
      }

      // Get engagement score
      const position = await leaderboardManager.getUserPosition(userId, 'all_time');

      // Get flavor profile progress
      const { productsMetadata, productRankings } = require('../../shared/schema');
      
      // Get total products per flavor profile
      const flavorTotalsResult = await db
        .select({
          profile: productsMetadata.primaryFlavor,
          total: sql`COUNT(DISTINCT ${productsMetadata.shopifyProductId})::int`
        })
        .from(productsMetadata)
        .where(sql`${productsMetadata.primaryFlavor} IS NOT NULL`)
        .groupBy(productsMetadata.primaryFlavor);

      // Get user's ranked products per flavor profile
      const userFlavorRankingsResult = await db
        .select({
          profile: productsMetadata.primaryFlavor,
          ranked: sql`COUNT(DISTINCT ${productRankings.shopifyProductId})::int`
        })
        .from(productRankings)
        .innerJoin(productsMetadata, eq(productRankings.shopifyProductId, productsMetadata.shopifyProductId))
        .where(sql`${productRankings.userId} = ${userId} AND ${productsMetadata.primaryFlavor} IS NOT NULL`)
        .groupBy(productsMetadata.primaryFlavor);

      // Combine into flavor profile progress array
      const flavorProfileProgress = flavorTotalsResult.map(total => {
        const userRanked = userFlavorRankingsResult.find(r => r.profile === total.profile);
        return {
          profile: total.profile,
          total: total.total,
          ranked: userRanked?.ranked || 0
        };
      }).filter(p => p.total > 0); // Only show profiles with products

      // Get current streak from engagement tracking
      const { engagementTracking } = require('../../shared/schema');
      const streakResult = await db
        .select({
          currentStreak: engagementTracking.currentStreak
        })
        .from(engagementTracking)
        .where(eq(engagementTracking.userId, userId))
        .limit(1);
      
      const currentStreak = streakResult[0]?.currentStreak || 0;

      // Get recent activity (last 10 activities)
      const recentActivity = [];
      
      // Add recent achievements
      const recentAchievements = achievements
        .filter(a => a.earnedAt)
        .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
        .slice(0, 5)
        .map(a => ({
          type: 'coin_earned',
          text: `Earned Coin: ${a.name}`,
          timestamp: a.earnedAt
        }));
      
      recentActivity.push(...recentAchievements);

      // Add ranking changes (most recent rankings)
      if (topProducts.length > 0) {
        const recentRankings = topProducts
          .filter(p => p.rankedAt)
          .sort((a, b) => new Date(b.rankedAt) - new Date(a.rankedAt))
          .slice(0, 3)
          .map(p => ({
            type: 'ranking_change',
            text: `Ranked ${p.title} #${p.rankPosition}`,
            timestamp: p.rankedAt
          }));
        
        recentActivity.push(...recentRankings);
      }

      // Sort all activities by timestamp and take top 10
      recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedActivity = recentActivity.slice(0, 10);

      res.json({
        user: {
          id: profileData.id,
          displayName: profileData.displayName,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          avatarUrl: profileData.avatarUrl,
          initials: profileData.initials,
          handle: profileData.handle,
          hideNamePrivacy: profileData.hideNamePrivacy,
          rankingCount: profileData.rankingCount,
          journeyStage: classification?.journeyStage || 'new_user',
          engagementLevel: classification?.engagementLevel || 'none',
          explorationBreadth: classification?.explorationBreadth || 'narrow',
          focusAreas: classification?.focusAreas || [],
          engagementScore: position?.engagementScore || 0,
          createdAt: profileData.createdAt,
          memberSince: profileData.createdAt
        },
        topProducts: topProducts.map(p => ({
          shopifyProductId: p.id,
          rankPosition: p.rankPosition,
          title: p.title,
          imageUrl: p.image,
          image: p.image,
          vendor: p.vendor,
          primaryFlavor: p.primaryFlavor,
          animalType: p.animalType,
          flavorIcon: p.flavorIcon,
          animalIcon: p.animalIcon,
          rankedAt: p.rankedAt
        })),
        timeline: timelineMoments,
        achievements: achievements.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          iconType: a.iconType,
          tier: a.tier,
          coinType: a.coinType,
          earnedAt: a.earnedAt,
          currentTier: a.currentTier,
          progress: a.progress
        })),
        flavorProfileProgress: flavorProfileProgress,
        recentActivity: limitedActivity,
        stats: {
          productsRanked: profileData.rankingCount,
          currentStreak: currentStreak
        }
      });
    } catch (error) {
      console.error('Error fetching user profile page:', error);
      res.status(500).json({ error: 'Failed to fetch profile page' });
    }
  });

  /**
   * Generate celebratory headline for purchase milestones
   * @param {Object} product - Product data with primaryFlavor and animalType
   * @param {boolean} isFirst - Is this the first purchase?
   * @param {boolean} isMostRecent - Is this the most recent purchase?
   * @returns {string} Celebratory headline
   */
  function generatePurchaseHeadline(product, isFirst, isMostRecent) {
    if (!product) return 'Order Delivered';

    const flavor = product.primaryFlavor || '';
    const animal = product.animalType || '';

    // Map animal types to user-friendly names
    const animalNameMap = {
      'cattle': 'Beef',
      'poultry': 'Chicken',
      'swine': 'Pork',
      'turkey': 'Turkey',
      'bison': 'Bison',
      'elk': 'Elk',
      'venison': 'Venison',
      'wild_boar': 'Wild Boar',
      'alligator': 'Alligator',
      'salmon': 'Salmon'
    };

    const animalDisplay = animalNameMap[animal?.toLowerCase()] || 
      (animal ? animal.charAt(0).toUpperCase() + animal.slice(1).replace('_', ' ') : '');

    if (isFirst) {
      // First purchase: "FIRST BITE - Original Beef"
      if (flavor && animal) {
        return `FIRST BITE - ${flavor} ${animalDisplay}`;
      } else if (flavor) {
        return `FIRST BITE - ${flavor} Jerky`;
      } else if (animal) {
        return `FIRST BITE - ${animalDisplay}`;
      }
      return 'FIRST BITE';
    }

    if (isMostRecent) {
      // Most recent: "LATEST HAUL - Spicy Pork"
      if (flavor && animal) {
        return `LATEST HAUL - ${flavor} ${animalDisplay}`;
      } else if (flavor) {
        return `LATEST HAUL - ${flavor}`;
      } else if (animal) {
        return `LATEST HAUL - ${animalDisplay}`;
      }
      return 'LATEST HAUL';
    }

    // Middle purchases: Celebratory but not as special as first/last
    if (flavor && animal) {
      return `FLAVOR DROP - ${flavor} ${animalDisplay}`;
    } else if (flavor) {
      return `FLAVOR DROP - ${flavor}`;
    } else if (animal) {
      return `NEW HAUL - ${animalDisplay}`;
    }
    return 'ORDER DELIVERED';
  }

  /**
   * GET /api/profile/:userId/journey
   * Get journey milestones for user's film strip timeline
   * Returns: ~10-15 milestone moments (first purchase, flavor discoveries, achievements, etc.)
   */
  router.get('/:userId/journey', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Get milestone moments from repository (with 10min cache)
      const milestones = await profileRepository.getJourneyMilestones(userId);

      // Enrich milestones with product images using ProductsService (golden source)
      const productIds = milestones
        .filter(m => m.productId)
        .map(m => m.productId);

      let productsMap = {};
      if (productIds.length > 0) {
        const products = await productsService.getProductsByIds(productIds);
        productsMap = products.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // Map milestones to enriched response with celebratory headlines for purchases
      const enrichedMilestones = milestones.map(milestone => {
        const product = milestone.productId && productsMap[milestone.productId] 
          ? productsMap[milestone.productId] 
          : null;

        // Generate custom headline for purchase milestones
        let customHeadline = milestone.headline;
        if (milestone.type === 'purchase' && product) {
          customHeadline = generatePurchaseHeadline(
            product,
            milestone.isFirstPurchase,
            milestone.isMostRecentPurchase
          );
        }

        return {
          type: milestone.type,
          date: milestone.date,
          productId: milestone.productId,
          headline: customHeadline,
          subtitle: milestone.subtitle,
          badge: milestone.badge,
          iconType: milestone.iconType,
          product: product ? {
            id: product.id,
            title: product.title,
            image: product.image || null,
            vendor: product.vendor
          } : null
        };
      });

      res.json({
        milestones: enrichedMilestones
      });
    } catch (error) {
      console.error('Error fetching journey milestones:', error);
      res.status(500).json({ error: 'Failed to fetch journey milestones' });
    }
  });

  /**
   * PATCH /api/profile
   * Update current user's profile
   * Accepts: { handle, hideNamePrivacy, profileImageUrl }
   */
  router.patch('/', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      const { handle, hideNamePrivacy, profileImageUrl } = req.body;
      const updates = {};

      // Validate and update handle
      if (handle !== undefined) {
        if (handle === null || handle === '') {
          // Allow clearing handle
          updates.handle = null;
        } else {
          // Validate format
          const validation = validateHandleFormat(handle);
          if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
          }

          const normalizedHandle = validation.handle;

          // Check if handle is taken by another user
          const [existingUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(sql`LOWER(${users.handle}) = ${normalizedHandle.toLowerCase()} AND ${users.id} != ${session.userId}`)
            .limit(1);

          if (existingUser) {
            return res.status(409).json({ error: 'Handle is already taken' });
          }

          updates.handle = normalizedHandle;
        }
      }

      // Update privacy setting
      if (hideNamePrivacy !== undefined) {
        if (typeof hideNamePrivacy !== 'boolean') {
          return res.status(400).json({ error: 'hideNamePrivacy must be a boolean' });
        }
        updates.hideNamePrivacy = hideNamePrivacy;
      }

      // Update profile image URL
      if (profileImageUrl !== undefined) {
        if (profileImageUrl === null || profileImageUrl === '') {
          updates.profileImageUrl = null;
        } else if (typeof profileImageUrl === 'string') {
          updates.profileImageUrl = profileImageUrl;
        } else {
          return res.status(400).json({ error: 'profileImageUrl must be a string or null' });
        }
      }

      // Ensure at least one field is being updated
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Add updatedAt timestamp
      updates.updatedAt = sql`NOW()`;

      // Update the user
      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, session.userId))
        .returning({
          id: users.id,
          email: users.email,
          first_name: users.firstName,
          last_name: users.lastName,
          display_name: users.displayName,
          profile_image_url: users.profileImageUrl,
          handle: users.handle,
          hide_name_privacy: users.hideNamePrivacy,
          updated_at: users.updatedAt,
        });

      // Invalidate caches if handle, privacy settings, or profile image changed
      // This ensures updated display data appears everywhere
      if (updates.handle !== undefined || updates.hideNamePrivacy !== undefined || updates.profileImageUrl !== undefined) {
        try {
          // Invalidate user profile cache (Redis-backed)
          const UserProfileCache = require('../cache/UserProfileCache');
          const userProfileCache = UserProfileCache.getInstance();
          await userProfileCache.invalidateUser(session.userId);
          console.log(`🗑️ Invalidated user profile cache for user ${session.userId}`);
          
          // Check if user is in leaderboard top 50
          if (leaderboardManager && leaderboardManager.cache) {
            const leaderboardData = leaderboardManager.cache.get('all_time', 50);
            
            if (leaderboardData) {
              const userInLeaderboard = leaderboardData.users?.some(u => u.userId === session.userId);
              
              if (userInLeaderboard) {
                await leaderboardManager.cache.invalidate();
                console.log(`🗑️ Invalidated leaderboard cache (user ${session.userId} handle/privacy updated)`);
              }
            }
          }
        } catch (cacheError) {
          console.error(`⚠️ Error invalidating caches for user ${session.userId}:`, cacheError);
          // Don't throw - cache invalidation failure shouldn't fail the update
        }
      }

      res.json({ 
        success: true,
        user: updatedUser 
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * GET /api/profile/handle-availability
   * Check if a handle is available
   * Query param: ?handle=username
   */
  router.get('/handle-availability', async (req, res) => {
    try {
      const { handle } = req.query;

      if (!handle) {
        return res.status(400).json({ error: 'Handle parameter is required' });
      }

      // Validate format
      const validation = validateHandleFormat(handle);
      if (!validation.valid) {
        return res.json({ 
          available: false, 
          error: validation.error 
        });
      }

      const normalizedHandle = validation.handle;

      // Check availability
      const available = await isHandleAvailable(normalizedHandle);

      res.json({ 
        available,
        handle: normalizedHandle
      });
    } catch (error) {
      console.error('Error checking handle availability:', error);
      res.status(500).json({ error: 'Failed to check handle availability' });
    }
  });

  /**
   * POST /api/profile/generate-handle
   * Generate a new funny handle for the user
   */
  router.post('/generate-handle', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Generate a unique handle
      const newHandle = await generateUniqueHandle();

      res.json({ 
        success: true,
        handle: newHandle
      });
    } catch (error) {
      console.error('Error generating handle:', error);
      res.status(500).json({ error: 'Failed to generate handle' });
    }
  });

  /**
   * POST /api/profile/upload-image
   * Upload a profile image
   */
  router.post('/upload-image', profileImageUpload.single('profileImage'), async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const imageBuffer = req.file.buffer;
      
      // Verify JPEG magic bytes (0xFFD8FF) to prevent MIME type spoofing
      if (imageBuffer.length < 3 || 
          imageBuffer[0] !== 0xFF || 
          imageBuffer[1] !== 0xD8 || 
          imageBuffer[2] !== 0xFF) {
        return res.status(400).json({ error: 'Invalid image format. Only JPEG images are accepted.' });
      }
      
      // Validate image dimensions
      let dimensions;
      try {
        dimensions = imageSize(imageBuffer);
      } catch (dimensionError) {
        console.error('Error reading image dimensions:', dimensionError);
        return res.status(400).json({ error: 'Invalid or corrupted image file' });
      }

      // Verify the image type from actual file content
      if (dimensions.type !== 'jpg') {
        return res.status(400).json({ error: 'Image must be in JPEG format' });
      }

      // Enforce strict dimensions (512x512 only)
      if (dimensions.width !== 512 || dimensions.height !== 512) {
        return res.status(400).json({ 
          error: `Image must be exactly 512x512 pixels (received ${dimensions.width}x${dimensions.height})` 
        });
      }

      // Enforce file size (should be compressed to ~200KB)
      if (req.file.size > 500 * 1024) {
        return res.status(400).json({ 
          error: `Image file size must be under 500KB (received ${Math.round(req.file.size / 1024)}KB)` 
        });
      }
      
      try {
        // Upload to object storage
        const imagePath = await objectStorage.uploadProfileImageFromBuffer(
          imageBuffer,
          req.file.originalname
        );

        // Save to database immediately
        await db
          .update(users)
          .set({ 
            profileImageUrl: imagePath,
            updatedAt: new Date()
          })
          .where(eq(users.id, session.userId));

        console.log(`✅ Profile image saved for user ${session.userId}: ${imagePath}`);

        res.json({
          success: true,
          profile_image_url: imagePath
        });
      } catch (uploadError) {
        console.error('Error uploading profile image:', uploadError);
        res.status(500).json({ error: 'Failed to upload image' });
      }
    } catch (error) {
      console.error('Error in profile image upload:', error);
      res.status(500).json({ error: 'Failed to process image upload' });
    }
  });

  /**
   * DELETE /api/profile/image
   * Delete the user's profile image
   */
  router.delete('/image', async (req, res) => {
    try {
      const sessionId = req.cookies.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Get user's current profile image
      const [user] = await db
        .select({ profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user || !user.profileImageUrl) {
        return res.status(404).json({ error: 'No profile image to delete' });
      }

      // Delete from storage
      try {
        await objectStorage.deleteIcon(user.profileImageUrl);
      } catch (deleteError) {
        console.error('Error deleting image from storage:', deleteError);
        // Continue anyway to clear DB reference
      }

      // Clear from database
      await db
        .update(users)
        .set({ profileImageUrl: null, updatedAt: sql`NOW()` })
        .where(eq(users.id, session.userId));

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting profile image:', error);
      res.status(500).json({ error: 'Failed to delete profile image' });
    }
  });

  /**
   * GET /api/profile/:userId/rankings
   * Get all rankings for a user (for separate loading)
   * Returns: All product rankings with purchase data
   */
  router.get('/:userId/rankings', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      // Fetch rankings (this is the slow query we're isolating)
      const allRankings = await profileRepository.getAllRankingsWithPurchases(userId);

      res.json({
        rankings: allRankings.map(r => ({
          shopifyProductId: r.id,
          rankPosition: r.rankPosition,
          rankedAt: r.rankedAt,
          purchaseDate: r.purchaseDate,
          title: r.title,
          imageUrl: r.image,
          vendor: r.vendor,
          primaryFlavor: r.primaryFlavor,
          animalType: r.animalType
        }))
      });
    } catch (error) {
      console.error('Error fetching user rankings:', error);
      res.status(500).json({ error: 'Failed to fetch rankings' });
    }
  });

  return router;
}

module.exports = createProfileRoutes;
