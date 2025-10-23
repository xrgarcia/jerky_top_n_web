// Reference: javascript_object_storage integration
// Simplified object storage service for achievement icons
const { Storage } = require('@google-cloud/storage');
const { Client } = require('@replit/object-storage');
const crypto = require('crypto');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

// Official Replit Object Storage client (for uploads)
const replitStorageClient = new Client();

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

    // Upload using official Replit client
    const { ok, error } = await replitStorageClient.uploadFromBytes(objectPath, buffer);

    if (!ok) {
      throw new Error(`Failed to upload icon: ${error}`);
    }

    // Return normalized path for database storage
    return `/objects/${objectPath}`;
  }

  async getObjectEntityFile(objectPath) {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split('/');
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join('/');
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
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
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith('/objects/')) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await objectFile.makePublic();
    return normalizedPath;
  }

  async deleteIcon(iconPath) {
    if (!iconPath || !iconPath.startsWith('/objects/')) {
      throw new Error('Invalid icon path');
    }

    try {
      // Extract the file path from the normalized path
      const entityId = iconPath.slice('/objects/'.length);
      
      // Delete using official Replit client
      const { ok, error } = await replitStorageClient.delete(entityId);
      
      if (!ok) {
        throw new Error(`Failed to delete icon: ${error}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting icon from storage:', error);
      throw error;
    }
  }

  async downloadObject(file, res, cacheTtlSec = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size,
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
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
};
