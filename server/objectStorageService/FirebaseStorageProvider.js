const admin = require('firebase-admin');
const Sentry = require('@sentry/node');
const StorageProvider = require('./StorageProvider');
const { PassThrough, Readable } = require('stream');

class FirebaseStorageProvider extends StorageProvider {
  constructor() {
    super('firebase');
    this.bucket = null;
    this.prefix = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    this.prefix = process.env.FIREBASE_STORAGE_PREFIX || '';

    if (!serviceAccountJson || !storageBucket) {
      console.warn('⚠️  Firebase Storage not configured');
      return false;
    }

    try {
      let app;
      if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: storageBucket
        });
      } else {
        app = admin.apps[0];
      }

      this.bucket = admin.storage().bucket();
      this.initialized = true;
      console.log(`✅ FirebaseStorageProvider initialized: ${storageBucket}/${this.prefix}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error.message);
      Sentry.captureException(error, {
        level: 'error',
        tags: { service: 'storage', provider: 'firebase', operation: 'initialize' }
      });
      return false;
    }
  }

  getFullPath(objectPath) {
    if (this.prefix) {
      return `${this.prefix}/${objectPath}`;
    }
    return objectPath;
  }

  async upload(objectPath, buffer) {
    if (!this.initialized) {
      throw new Error('FirebaseStorageProvider not initialized');
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);

    try {
      await file.save(buffer, {
        metadata: {
          contentType: this.getContentType(objectPath)
        },
        resumable: false
      });
      console.log(`✅ Firebase upload: ${fullPath}`);
      return fullPath;
    } catch (error) {
      console.error(`❌ Firebase upload failed for ${objectPath}:`, error.message);
      Sentry.captureException(error, {
        level: 'warning',
        tags: { service: 'storage', provider: 'firebase', operation: 'upload' },
        extra: { objectPath, fullPath }
      });
      throw error;
    }
  }

  async download(objectPath) {
    if (!this.initialized) {
      throw new Error('FirebaseStorageProvider not initialized');
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);

    try {
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      console.error(`❌ Firebase download failed for ${objectPath}:`, error.message);
      throw error;
    }
  }

  async downloadAsStream(objectPath) {
    if (!this.initialized) {
      throw new Error('FirebaseStorageProvider not initialized');
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);
    return file.createReadStream();
  }

  async exists(objectPath) {
    if (!this.initialized) {
      return false;
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);

    try {
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  async delete(objectPath) {
    if (!this.initialized) {
      throw new Error('FirebaseStorageProvider not initialized');
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);

    try {
      await file.delete();
      console.log(`🗑️  Firebase delete: ${fullPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Firebase delete failed for ${objectPath}:`, error.message);
      return false;
    }
  }

  async list(options = {}) {
    if (!this.initialized) {
      return [];
    }

    const prefix = options.prefix ? this.getFullPath(options.prefix) : this.getFullPath('');
    
    try {
      const [files] = await this.bucket.getFiles({ prefix });
      return files.map(f => f.name.replace(this.prefix + '/', ''));
    } catch (error) {
      console.error('❌ Firebase list failed:', error.message);
      return [];
    }
  }

  async getSignedUrl(objectPath, expiresInMs = 3600000) {
    if (!this.initialized) {
      throw new Error('FirebaseStorageProvider not initialized');
    }

    const fullPath = this.getFullPath(objectPath);
    const file = this.bucket.file(fullPath);

    try {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMs
      });
      return url;
    } catch (error) {
      console.error(`❌ Firebase getSignedUrl failed for ${objectPath}:`, error.message);
      throw error;
    }
  }
}

module.exports = FirebaseStorageProvider;
