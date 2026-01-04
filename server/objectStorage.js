// Object Storage Service - Platform-agnostic implementation
// Supports: Google Cloud Storage (Railway/production) and Replit Object Storage (development)
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const Sentry = require('@sentry/node');
const fs = require('fs').promises;
const path = require('path');

// Default coin icon configuration
const DEFAULT_COIN_ICON_PATH = '/objects/achievement-icons/default-beta-coin.png';
const DEFAULT_COIN_ICON_SOURCE = 'attached_assets/beta_coin_default_1763580646326.png';

// Storage provider detection
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'auto';

// Lazy initialization for storage clients
let gcsClientInstance = null;
let replitClientInstance = null;
let initializationPromise = null;

/**
 * Detect which storage provider to use
 * Priority: explicit STORAGE_PROVIDER > GCS credentials > Replit environment
 */
function detectStorageProvider() {
  if (STORAGE_PROVIDER === 'gcs' || STORAGE_PROVIDER === 'google') {
    return 'gcs';
  }
  if (STORAGE_PROVIDER === 'replit') {
    return 'replit';
  }
  
  // Auto-detect: Check for GCS credentials first (Railway/production)
  if (process.env.GCS_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return 'gcs';
  }
  
  // Fall back to Replit if in Replit environment
  if (process.env.REPL_ID || process.env.REPLIT) {
    return 'replit';
  }
  
  // Default to GCS for production environments
  if (process.env.NODE_ENV === 'production') {
    return 'gcs';
  }
  
  // Default to Replit for development
  return 'replit';
}

/**
 * Initialize Google Cloud Storage client
 */
async function initializeGCSClient() {
  try {
    console.log('🔌 Initializing Google Cloud Storage client...');
    
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable is required for Google Cloud Storage');
    }
    
    let storage;
    
    // Check for service account JSON in environment variable
    if (process.env.GCS_SERVICE_ACCOUNT) {
      try {
        const credentials = JSON.parse(process.env.GCS_SERVICE_ACCOUNT);
        storage = new Storage({
          credentials,
          projectId: credentials.project_id
        });
        console.log(`✅ GCS initialized with service account for project: ${credentials.project_id}`);
      } catch (parseError) {
        throw new Error(`Failed to parse GCS_SERVICE_ACCOUNT JSON: ${parseError.message}`);
      }
    } 
    // Fall back to GOOGLE_APPLICATION_CREDENTIALS file path
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      storage = new Storage();
      console.log('✅ GCS initialized with GOOGLE_APPLICATION_CREDENTIALS file');
    }
    // No credentials found
    else {
      throw new Error('No GCS credentials found. Set GCS_SERVICE_ACCOUNT (JSON) or GOOGLE_APPLICATION_CREDENTIALS (file path)');
    }
    
    const bucket = storage.bucket(bucketName);
    
    // Test bucket access
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket "${bucketName}" does not exist or is not accessible`);
    }
    
    console.log(`✅ GCS bucket "${bucketName}" verified`);
    
    return { storage, bucket, bucketName };
  } catch (error) {
    console.error('❌ Failed to initialize Google Cloud Storage:', error.message);
    Sentry.captureException(error, {
      level: 'error',
      tags: { service: 'object_storage', provider: 'gcs' }
    });
    throw error;
  }
}

/**
 * Initialize Replit Object Storage client with retry logic
 */
async function initializeReplitStorageClient() {
  const maxRetries = 3;
  const retryDelays = [500, 1000, 2000];
  
  // Lazy require to avoid loading in production
  let Client;
  try {
    Client = require('@replit/object-storage').Client;
  } catch (error) {
    throw new Error('Replit Object Storage package not available. Install @replit/object-storage or use GCS.');
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔌 Initializing Replit Object Storage client (attempt ${attempt + 1}/${maxRetries})...`);
      const client = new Client();
      console.log('✅ Replit Object Storage client initialized successfully');
      return client;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isLastAttempt) {
        console.error('❌ Failed to initialize Replit Object Storage client after all retries');
        Sentry.captureException(error, {
          level: 'error',
          tags: { service: 'object_storage', provider: 'replit' }
        });
        throw new Error(`Replit Object Storage initialization failed: ${error.message}`);
      } else {
        console.warn(`⚠️ Replit client init failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelays[attempt]}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }
}

/**
 * Get initialized storage client based on detected provider
 */
async function getStorageClient() {
  const provider = detectStorageProvider();
  
  if (provider === 'gcs') {
    if (!gcsClientInstance) {
      gcsClientInstance = await initializeGCSClient();
    }
    return { provider: 'gcs', client: gcsClientInstance };
  } else {
    if (!replitClientInstance) {
      if (!initializationPromise) {
        initializationPromise = initializeReplitStorageClient();
      }
      try {
        replitClientInstance = await initializationPromise;
      } finally {
        initializationPromise = null;
      }
    }
    return { provider: 'replit', client: replitClientInstance };
  }
}

class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
  }
}

class ObjectStorageService {
  constructor() {
    this.provider = null;
  }

  async getProvider() {
    if (!this.provider) {
      const { provider } = await getStorageClient();
      this.provider = provider;
    }
    return this.provider;
  }

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
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `achievement-icons/${objectId}.${ext}`;

    const { provider, client } = await getStorageClient();

    if (provider === 'gcs') {
      const file = client.bucket.file(objectPath);
      await file.save(buffer, {
        metadata: {
          contentType: this._getMimeType(ext)
        },
        public: true
      });
      console.log(`✅ Uploaded icon to GCS: ${objectPath}`);
    } else {
      const { ok, error } = await client.uploadFromBytes(objectPath, buffer);
      if (!ok) {
        throw new Error(`Failed to upload icon: ${error}`);
      }
    }

    return `/objects/${objectPath}`;
  }

  async uploadProfileImageFromBuffer(buffer, filename) {
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `profile-images/${objectId}.${ext}`;

    const { provider, client } = await getStorageClient();

    if (provider === 'gcs') {
      const file = client.bucket.file(objectPath);
      await file.save(buffer, {
        metadata: {
          contentType: this._getMimeType(ext)
        },
        public: true
      });
      console.log(`✅ Uploaded profile image to GCS: ${objectPath}`);
    } else {
      const { ok, error } = await client.uploadFromBytes(objectPath, buffer);
      if (!ok) {
        throw new Error(`Failed to upload profile image: ${error}`);
      }
    }

    return `/objects/${objectPath}`;
  }

  async bootstrapDefaultCoinIcon() {
    try {
      console.log('🪙 Bootstrapping default coin icon...');
      
      const { provider, client } = await getStorageClient();
      const objectPath = DEFAULT_COIN_ICON_PATH.slice('/objects/'.length);
      
      // Check if already exists
      try {
        if (provider === 'gcs') {
          const [exists] = await client.bucket.file(objectPath).exists();
          if (exists) {
            console.log('✅ Default coin icon already exists in GCS');
            return DEFAULT_COIN_ICON_PATH;
          }
        } else {
          const { ok, value: files } = await client.list({ prefix: objectPath });
          if (ok && files && files.length > 0) {
            console.log('✅ Default coin icon already exists in Replit storage');
            return DEFAULT_COIN_ICON_PATH;
          }
        }
      } catch (error) {
        console.log('📦 Default coin icon not found, uploading...');
      }
      
      // Read source file
      const sourceFilePath = path.join(process.cwd(), DEFAULT_COIN_ICON_SOURCE);
      const imageBuffer = await fs.readFile(sourceFilePath);
      console.log(`📁 Read source image: ${sourceFilePath} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);
      
      // Upload
      if (provider === 'gcs') {
        const file = client.bucket.file(objectPath);
        await file.save(imageBuffer, {
          metadata: { contentType: 'image/png' },
          public: true
        });
      } else {
        const { ok, error } = await client.uploadFromBytes(objectPath, imageBuffer);
        if (!ok) {
          throw new Error(`Failed to upload default coin icon: ${error}`);
        }
      }
      
      console.log(`✅ Default coin icon uploaded: ${DEFAULT_COIN_ICON_PATH}`);
      return DEFAULT_COIN_ICON_PATH;
      
    } catch (error) {
      console.error('❌ Error bootstrapping default coin icon:', error);
      Sentry.captureException(error, {
        level: 'error',
        tags: { service: 'object_storage', operation: 'bootstrap_default_coin_icon' }
      });
      console.warn('⚠️ Server will continue without default coin icon');
      return null;
    }
  }

  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }
    return objectPath.slice('/objects/'.length);
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
    return rawPath;
  }

  async deleteIcon(iconPath) {
    if (!iconPath || !iconPath.startsWith('/objects/')) {
      throw new Error('Invalid icon path');
    }

    const entityId = iconPath.slice('/objects/'.length);
    const { provider, client } = await getStorageClient();

    try {
      if (provider === 'gcs') {
        await client.bucket.file(entityId).delete();
        console.log(`✅ Deleted icon from GCS: ${entityId}`);
      } else {
        const { ok, error } = await client.delete(entityId);
        if (!ok) {
          throw new Error(`Failed to delete icon: ${error}`);
        }
      }
      return true;
    } catch (error) {
      console.error('Error deleting icon from storage:', error);
      throw error;
    }
  }

  async downloadObject(objectName, res, cacheTtlSec = 3600) {
    try {
      const { provider, client } = await getStorageClient();

      res.set({
        'Content-Type': this._getMimeType(objectName.split('.').pop()),
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      if (provider === 'gcs') {
        const file = client.bucket.file(objectName);
        const stream = file.createReadStream();
        
        stream.on('error', (err) => {
          console.error('GCS stream error:', err);
          if (!res.headersSent) {
            res.status(404).json({ error: 'Object not found' });
          }
        });
        
        stream.pipe(res);
      } else {
        const stream = client.downloadAsStream(objectName);
        
        stream.on('error', (err) => {
          console.error('Replit stream error:', err);
          if (!res.headersSent) {
            res.status(404).json({ error: 'Object not found' });
          }
        });
        
        stream.pipe(res);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }

  _getMimeType(ext) {
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[ext?.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Get public URL for an object (for GCS, returns signed URL or public URL)
   */
  async getPublicUrl(objectPath) {
    const { provider, client } = await getStorageClient();
    const entityPath = objectPath.startsWith('/objects/') 
      ? objectPath.slice('/objects/'.length) 
      : objectPath;

    if (provider === 'gcs') {
      return `https://storage.googleapis.com/${client.bucketName}/${entityPath}`;
    } else {
      // For Replit, serve through Express route
      return `/objects/${entityPath}`;
    }
  }
}

module.exports = {
  ObjectStorageService,
  ObjectNotFoundError,
  DEFAULT_COIN_ICON_PATH,
  DEFAULT_COIN_ICON_SOURCE,
  detectStorageProvider,
};
