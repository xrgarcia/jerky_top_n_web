const express = require('express');
const multer = require('multer');
const sizeOf = require('image-size');
const { users } = require('../../shared/schema');
const { eq, sql } = require('drizzle-orm');
const { 
  generateUniqueHandle, 
  isHandleAvailable, 
  validateHandleFormat 
} = require('../utils/handleGenerator');
const { ObjectStorageService } = require('../objectStorage');

function createProfileRoutes(services) {
  const { db, storage } = services;
  const router = express.Router();
  const objectStorage = new ObjectStorageService();

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
        dimensions = sizeOf(imageBuffer);
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

  return router;
}

module.exports = createProfileRoutes;
