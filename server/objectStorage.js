// Reference: javascript_object_storage integration
// Simplified object storage service for achievement icons
const { Storage } = require('@google-cloud/storage');
const { Client } = require('@replit/object-storage');
const crypto = require('crypto');
const Sentry = require('@sentry/node');
const fs = require('fs').promises;
const path = require('path');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

// Default coin icon configuration
const DEFAULT_COIN_ICON_PATH = '/objects/achievement-icons/default-beta-coin.png';
const DEFAULT_COIN_ICON_SOURCE = 'attached_assets/beta_coin_default_1763580646326.png';

// Lazy initialization for Replit Object Storage client
// This prevents cold-start fetch failures during module load
let replitStorageClientInstance = null;
let initializationPromise = null;

/**
 * Initialize Replit Object Storage client with retry logic
 * Handles transient network failures during cold starts
 */
async function initializeReplitStorageClient() {
  const maxRetries = 3;
  const retryDelays = [500, 1000, 2000]; // Exponential backoff
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔌 Initializing Replit Object Storage client (attempt ${attempt + 1}/${maxRetries})...`);
      const client = new Client();
      console.log('✅ Replit Object Storage client initialized successfully');
      return client;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isLastAttempt) {
        // Final attempt failed - log as error
        console.error('❌ Failed to initialize Replit Object Storage client after all retries');
        console.error(`   Error: ${error.message}`);
        
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            service: 'object_storage',
            operation: 'client_initialization'
          },
          extra: {
            errorMessage: error.message,
            attempts: maxRetries,
            context: 'Critical failure - object storage unavailable'
          }
        });
        
        throw new Error(`Object Storage initialization failed after ${maxRetries} attempts: ${error.message}`);
      } else {
        // Retry attempt - log as warning
        console.warn(`⚠️ Object Storage client initialization failed (attempt ${attempt + 1}/${maxRetries})`);
        console.warn(`   Error: ${error.message}`);
        console.warn(`   Retrying in ${retryDelays[attempt]}ms...`);
        
        Sentry.captureException(error, {
          level: 'warning',
          tags: {
            service: 'object_storage',
            operation: 'client_initialization_retry'
          },
          extra: {
            errorMessage: error.message,
            attempt: attempt + 1,
            maxRetries,
            nextRetryDelayMs: retryDelays[attempt]
          }
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }
}

/**
 * Get initialized Replit Object Storage client
 * Uses lazy initialization with caching and retry logic
 */
async function getReplitStorageClient() {
  // Return cached instance if available
  if (replitStorageClientInstance) {
    return replitStorageClientInstance;
  }
  
  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Start new initialization
  initializationPromise = initializeReplitStorageClient();
  
  try {
    replitStorageClientInstance = await initializationPromise;
    return replitStorageClientInstance;
  } finally {
    // Clear the promise so future calls can retry if this failed
    initializationPromise = null;
  }
}

// Google Cloud Storage client (for serving/downloads)
const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
  }
}

class ObjectStorageService {
  constructor() {}

  getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        'PRIVATE_OBJECT_DIR not set. Create a bucket in Object Storage ' +
        'tool and set PRIVATE_OBJECT_DIR env var.'
      );
    }
    return dir;
  }

  async uploadIconFromBuffer(buffer, filename) {
    // Generate unique filename with extension preserved
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `achievement-icons/${objectId}.${ext}`;

    // Get initialized client with retry logic
    const client = await getReplitStorageClient();
    
    // Upload using official Replit client
    const { ok, error } = await client.uploadFromBytes(objectPath, buffer);

    if (!ok) {
      throw new Error(`Failed to upload icon: ${error}`);
    }

    // Return normalized path for database storage
    return `/objects/${objectPath}`;
  }

  async uploadProfileImageFromBuffer(buffer, filename) {
    // Generate unique filename with extension preserved
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `profile-images/${objectId}.${ext}`;

    // Get initialized client with retry logic
    const client = await getReplitStorageClient();
    
    // Upload using official Replit client
    const { ok, error } = await client.uploadFromBytes(objectPath, buffer);

    if (!ok) {
      throw new Error(`Failed to upload profile image: ${error}`);
    }

    // Return normalized path for database storage
    return `/objects/${objectPath}`;
  }

  async bootstrapDefaultCoinIcon() {
    try {
      console.log('🪙 Bootstrapping default coin icon...');
      
      // Get initialized client with retry logic
      const client = await getReplitStorageClient();
      
      // Extract object path from normalized path
      const objectPath = DEFAULT_COIN_ICON_PATH.slice('/objects/'.length);
      
      // Check if default icon already exists
      try {
        const { ok, value: files } = await client.list({ prefix: objectPath });
        if (ok && files && files.length > 0) {
          console.log('✅ Default coin icon already exists in storage');
          return DEFAULT_COIN_ICON_PATH;
        }
      } catch (error) {
        // Icon doesn't exist or error checking, continue with upload
        console.log('📦 Default coin icon not found, uploading...');
      }
      
      // Read the source image file
      const sourceFilePath = path.join(process.cwd(), DEFAULT_COIN_ICON_SOURCE);
      const imageBuffer = await fs.readFile(sourceFilePath);
      
      console.log(`📁 Read source image: ${sourceFilePath} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);
      
      // Upload to fixed path (no UUID, using fixed filename)
      const { ok, error } = await client.uploadFromBytes(objectPath, imageBuffer);
      
      if (!ok) {
        throw new Error(`Failed to upload default coin icon: ${error}`);
      }
      
      console.log(`✅ Default coin icon uploaded successfully: ${DEFAULT_COIN_ICON_PATH}`);
      return DEFAULT_COIN_ICON_PATH;
      
    } catch (error) {
      console.error('❌ Error bootstrapping default coin icon:', error);
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          service: 'object_storage',
          operation: 'bootstrap_default_coin_icon'
        },
        extra: {
          errorMessage: error.message,
          defaultIconPath: DEFAULT_COIN_ICON_PATH,
          sourceFile: DEFAULT_COIN_ICON_SOURCE
        }
      });
      
      // Don't throw - allow server to start even if bootstrap fails
      console.warn('⚠️ Server will continue without default coin icon');
      return null;
    }
  }

  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    // Extract the path without '/objects/' prefix
    const objectName = objectPath.slice('/objects/'.length);
    
    // Return the object name for use with Replit client
    return objectName;
  }

  normalizeObjectEntityPath(rawPath) {
    if (!rawPath.startsWith('https://storage.googleapis.com/')) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith('/')) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async setObjectPublic(rawPath) {
    // With Replit client, files are accessible through our Express route
    // No need to explicitly make them public
    return rawPath;
  }

  async deleteIcon(iconPath) {
    if (!iconPath || !iconPath.startsWith('/objects/')) {
      throw new Error('Invalid icon path');
    }

    try {
      // Extract the file path from the normalized path
      const entityId = iconPath.slice('/objects/'.length);
      
      // Get initialized client with retry logic
      const client = await getReplitStorageClient();
      
      // Delete using official Replit client
      const { ok, error } = await client.delete(entityId);
      
      if (!ok) {
        throw new Error(`Failed to delete icon: ${error}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting icon from storage:', error);
      throw error;
    }
  }

  async downloadObject(objectName, res, cacheTtlSec = 3600) {
    try {
      // Get initialized client with retry logic
      const client = await getReplitStorageClient();
      
      // Use Replit client to download as stream
      // Note: downloadAsStream returns a Readable stream directly, not a Result type
      const stream = client.downloadAsStream(objectName);

      // Set response headers
      res.set({
        'Content-Type': 'image/png', // Default for achievement icons
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      // Handle stream errors (file not found, etc.)
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Object not found' });
        }
      });

      // Pipe the stream to response
      stream.pipe(res);
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }
}

function parseObjectPath(path) {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({ bucketName, objectName, method, ttlSec }) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
      `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

module.exports = {
  ObjectStorageService,
  ObjectNotFoundError,
  DEFAULT_COIN_ICON_PATH,
  DEFAULT_COIN_ICON_SOURCE,
};
