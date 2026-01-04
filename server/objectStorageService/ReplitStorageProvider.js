const { Client } = require('@replit/object-storage');
const Sentry = require('@sentry/node');
const StorageProvider = require('./StorageProvider');

class ReplitStorageProvider extends StorageProvider {
  constructor() {
    super('replit');
    this.client = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    if (this.initialized && this.client) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    
    try {
      await this.initializationPromise;
      return true;
    } catch (error) {
      return false;
    } finally {
      this.initializationPromise = null;
    }
  }

  async _doInitialize() {
    const maxRetries = 3;
    const retryDelays = [500, 1000, 2000];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔌 Initializing Replit Object Storage client (attempt ${attempt + 1}/${maxRetries})...`);
        this.client = new Client();
        this.initialized = true;
        console.log('✅ ReplitStorageProvider initialized successfully');
        return true;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;

        if (isLastAttempt) {
          console.error('❌ Failed to initialize Replit Object Storage client after all retries');
          Sentry.captureException(error, {
            level: 'error',
            tags: { service: 'storage', provider: 'replit', operation: 'initialize' }
          });
          throw error;
        } else {
          console.warn(`⚠️ Replit Object Storage initialization failed (attempt ${attempt + 1}/${maxRetries})`);
          console.warn(`   Retrying in ${retryDelays[attempt]}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      }
    }
  }

  async ensureClient() {
    if (!this.client) {
      await this.initialize();
    }
    return this.client;
  }

  async upload(objectPath, buffer) {
    const client = await this.ensureClient();
    const { ok, error } = await client.uploadFromBytes(objectPath, buffer);

    if (!ok) {
      throw new Error(`Replit upload failed: ${error}`);
    }

    console.log(`✅ Replit upload: ${objectPath}`);
    return objectPath;
  }

  async download(objectPath) {
    const client = await this.ensureClient();
    const { ok, value, error } = await client.downloadAsBytes(objectPath);

    if (!ok) {
      throw new Error(`Replit download failed: ${error}`);
    }

    return value;
  }

  async downloadAsStream(objectPath) {
    const client = await this.ensureClient();
    return client.downloadAsStream(objectPath);
  }

  async exists(objectPath) {
    const client = await this.ensureClient();
    
    try {
      const { ok, value: files } = await client.list({ prefix: objectPath });
      return ok && files && files.length > 0;
    } catch (error) {
      return false;
    }
  }

  async delete(objectPath) {
    const client = await this.ensureClient();
    const { ok, error } = await client.delete(objectPath);

    if (!ok) {
      throw new Error(`Replit delete failed: ${error}`);
    }

    console.log(`🗑️  Replit delete: ${objectPath}`);
    return true;
  }

  async list(options = {}) {
    const client = await this.ensureClient();
    const allFiles = [];
    let startAfter = options.startAfter;

    while (true) {
      const listOptions = {};
      if (options.prefix) listOptions.prefix = options.prefix;
      if (startAfter) listOptions.startAfter = startAfter;

      const { ok, value: files, error } = await client.list(listOptions);

      if (!ok) {
        console.error('❌ Failed to list Replit objects:', error);
        break;
      }

      if (!files || files.length === 0) {
        break;
      }

      allFiles.push(...files);

      if (files.length < 100) {
        break;
      }

      const lastFile = files[files.length - 1];
      startAfter = typeof lastFile === 'string' ? lastFile : lastFile.name;
    }

    return allFiles.map(f => typeof f === 'string' ? f : f.name);
  }
}

module.exports = ReplitStorageProvider;
