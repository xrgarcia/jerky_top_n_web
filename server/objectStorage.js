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

  async uploadProfileImageFromBuffer(buffer, filename) {
    // Generate unique filename with extension preserved
    const objectId = crypto.randomUUID();
    const ext = filename.split('.').pop();
    const objectPath = `profile-images/${objectId}.${ext}`;

    // Upload using official Replit client
    const { ok, error } = await replitStorageClient.uploadFromBytes(objectPath, buffer);

    if (!ok) {
      throw new Error(`Failed to upload profile image: ${error}`);
    }

    // Return normalized path for database storage
    return `/objects/${objectPath}`;
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

  async downloadObject(objectName, res, cacheTtlSec = 3600) {
    try {
      // Use Replit client to download as stream
      // Note: downloadAsStream returns a Readable stream directly, not a Result type
      const stream = replitStorageClient.downloadAsStream(objectName);

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
};
