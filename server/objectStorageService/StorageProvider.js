const Sentry = require('@sentry/node');

class StorageProvider {
  constructor(name) {
    this.name = name;
  }

  async initialize() {
    throw new Error('Method not implemented');
  }

  async upload(objectPath, buffer) {
    throw new Error('Method not implemented');
  }

  async download(objectPath) {
    throw new Error('Method not implemented');
  }

  async downloadAsStream(objectPath) {
    throw new Error('Method not implemented');
  }

  async exists(objectPath) {
    throw new Error('Method not implemented');
  }

  async delete(objectPath) {
    throw new Error('Method not implemented');
  }

  async list(options = {}) {
    throw new Error('Method not implemented');
  }

  getContentType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

module.exports = StorageProvider;
