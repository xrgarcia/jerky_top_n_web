const crypto = require('crypto');
const Sentry = require('@sentry/node');
const path = require('path');
const fs = require('fs').promises;
const FirebaseStorageProvider = require('./FirebaseStorageProvider');
const ReplitStorageProvider = require('./ReplitStorageProvider');

const DEFAULT_COIN_ICON_PATH = '/objects/achievement-icons/default-beta-coin.png';
const DEFAULT_COIN_ICON_SOURCE = 'attached_assets/beta_coin_default_1763580646326.png';

class StorageService {
  constructor() {
    this.primaryProvider = null;
    this.fallbackProvider = null;
    this.initialized = false;
    this.dualWrite = false;
  }

  async initialize() {
    if (this.initialized) return;

    const firebaseProvider = new FirebaseStorageProvider();
    const replitProvider = new ReplitStorageProvider();

    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const useFirebasePrimary = isRailway || process.env.STORAGE_PROVIDER === 'firebase';

    if (useFirebasePrimary) {
      const firebaseReady = await firebaseProvider.initialize();
      if (firebaseReady) {
        this.primaryProvider = firebaseProvider;
        console.log('🔥 StorageService: Firebase is PRIMARY provider');
      }

      if (!isRailway) {
        const replitReady = await replitProvider.initialize();
        if (replitReady) {
          this.fallbackProvider = replitProvider;
          this.dualWrite = true;
          console.log('📦 StorageService: Replit is FALLBACK provider (dual-write enabled)');
        }
      }
    } else {
      const replitReady = await replitProvider.initialize();
      if (replitReady) {
        this.primaryProvider = replitProvider;
        console.log('📦 StorageService: Replit is PRIMARY provider');
      }

      const firebaseReady = await firebaseProvider.initialize();
      if (firebaseReady) {
        this.fallbackProvider = firebaseProvider;
        this.dualWrite = true;
        console.log('🔥 StorageService: Firebase is FALLBACK provider (dual-write enabled)');
      }
    }

    if (!this.primaryProvider) {
      console.error('❌ StorageService: No storage provider available!');
      throw new Error('No storage provider could be initialized');
    }

    this.initialized = true;
    console.log(`✅ StorageService initialized (primary: ${this.primaryProvider.name}, dualWrite: ${this.dualWrite})`);
  }

  async upload(objectPath, buffer) {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.primaryProvider.upload(objectPath, buffer);

    if (this.dualWrite && this.fallbackProvider) {
      try {
        await this.fallbackProvider.upload(objectPath, buffer);
      } catch (error) {
        console.warn(`⚠️ Dual-write to ${this.fallbackProvider.name} failed:`, error.message);
      }
    }

    return objectPath;
  }

  async uploadIconFromBuffer(buffer, filename) {
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `achievement-icons/${objectId}.${ext}`;

    await this.upload(objectPath, buffer);
    return `/objects/${objectPath}`;
  }

  async uploadProfileImageFromBuffer(buffer, filename) {
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `profile-images/${objectId}.${ext}`;

    await this.upload(objectPath, buffer);
    return `/objects/${objectPath}`;
  }

  async download(objectPath) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.primaryProvider.download(objectPath);
    } catch (error) {
      if (this.fallbackProvider) {
        console.warn(`⚠️ Primary download failed, trying fallback...`);
        return await this.fallbackProvider.download(objectPath);
      }
      throw error;
    }
  }

  async downloadAsStream(objectPath) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.primaryProvider.downloadAsStream(objectPath);
    } catch (error) {
      if (this.fallbackProvider) {
        console.warn(`⚠️ Primary stream failed, trying fallback...`);
        return await this.fallbackProvider.downloadAsStream(objectPath);
      }
      throw error;
    }
  }

  async exists(objectPath) {
    if (!this.initialized) {
      await this.initialize();
    }

    const existsInPrimary = await this.primaryProvider.exists(objectPath);
    if (existsInPrimary) return true;

    if (this.fallbackProvider) {
      return await this.fallbackProvider.exists(objectPath);
    }

    return false;
  }

  async delete(objectPath) {
    if (!this.initialized) {
      await this.initialize();
    }

    let deleted = false;

    try {
      deleted = await this.primaryProvider.delete(objectPath);
    } catch (error) {
      console.warn(`⚠️ Primary delete failed:`, error.message);
    }

    if (this.fallbackProvider) {
      try {
        await this.fallbackProvider.delete(objectPath);
      } catch (error) {
        console.warn(`⚠️ Fallback delete failed:`, error.message);
      }
    }

    return deleted;
  }

  async deleteIcon(iconPath) {
    if (!iconPath || !iconPath.startsWith('/objects/')) {
      throw new Error('Invalid icon path');
    }

    const objectPath = iconPath.slice('/objects/'.length);
    return await this.delete(objectPath);
  }

  async downloadObject(objectName, res, cacheTtlSec = 3600) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const stream = await this.downloadAsStream(objectName);

      res.set({
        'Content-Type': this.primaryProvider.getContentType(objectName),
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Object not found' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }

  async bootstrapDefaultCoinIcon() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🪙 Bootstrapping default coin icon...');

      const objectPath = DEFAULT_COIN_ICON_PATH.slice('/objects/'.length);

      const existsAlready = await this.exists(objectPath);
      if (existsAlready) {
        console.log('✅ Default coin icon already exists in storage');
        return DEFAULT_COIN_ICON_PATH;
      }

      const sourceFilePath = path.join(process.cwd(), DEFAULT_COIN_ICON_SOURCE);
      const imageBuffer = await fs.readFile(sourceFilePath);

      console.log(`📁 Read source image: ${sourceFilePath} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);

      await this.upload(objectPath, imageBuffer);

      console.log(`✅ Default coin icon uploaded successfully: ${DEFAULT_COIN_ICON_PATH}`);
      return DEFAULT_COIN_ICON_PATH;

    } catch (error) {
      console.error('❌ Error bootstrapping default coin icon:', error);
      Sentry.captureException(error, {
        level: 'error',
        tags: { service: 'storage', operation: 'bootstrap_default_coin_icon' }
      });

      console.warn('⚠️ Server will continue without default coin icon');
      return null;
    }
  }

  getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith('/objects/')) {
      throw new Error('Object not found');
    }
    return objectPath.slice('/objects/'.length);
  }

  normalizeObjectEntityPath(rawPath) {
    if (!rawPath.startsWith('https://storage.googleapis.com/')) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    const objectEntityDir = process.env.PRIVATE_OBJECT_DIR || '';
    let normalizedDir = objectEntityDir;
    if (!normalizedDir.endsWith('/')) {
      normalizedDir = `${normalizedDir}/`;
    }

    if (!rawObjectPath.startsWith(normalizedDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(normalizedDir.length);
    return `/objects/${entityId}`;
  }

  async setObjectPublic(rawPath) {
    return rawPath;
  }
}

let storageServiceInstance = null;

function getStorageService() {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

module.exports = {
  StorageService,
  getStorageService,
  DEFAULT_COIN_ICON_PATH,
  DEFAULT_COIN_ICON_SOURCE
};
