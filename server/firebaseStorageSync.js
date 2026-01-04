const admin = require('firebase-admin');
const { Client } = require('@replit/object-storage');
const Sentry = require('@sentry/node');
const { PassThrough } = require('stream');

let firebaseApp = null;
let firebaseBucket = null;
let replitClient = null;

function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!serviceAccountJson || !storageBucket) {
    console.warn('⚠️  Firebase Storage not configured - sync disabled');
    console.warn('   Missing: FIREBASE_SERVICE_ACCOUNT and/or FIREBASE_STORAGE_BUCKET');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });

    firebaseBucket = admin.storage().bucket();
    console.log(`✅ Firebase Storage initialized: ${storageBucket}`);
    return firebaseApp;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    Sentry.captureException(error, {
      level: 'error',
      tags: { service: 'firebase_storage', operation: 'initialize' }
    });
    return null;
  }
}

async function getReplitClient() {
  if (replitClient) return replitClient;
  
  try {
    replitClient = new Client();
    return replitClient;
  } catch (error) {
    console.error('❌ Failed to initialize Replit Object Storage client:', error.message);
    throw error;
  }
}

async function listAllObjects(client) {
  const allFiles = [];
  let startAfter = undefined;
  
  while (true) {
    const options = startAfter ? { startAfter } : {};
    const { ok, value: files, error } = await client.list(options);
    
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
  
  return allFiles;
}

async function streamUploadToFirebase(replitStream, firebaseFile, contentType) {
  return new Promise((resolve, reject) => {
    const writeStream = firebaseFile.createWriteStream({
      metadata: {
        contentType: contentType
      },
      resumable: false
    });
    
    replitStream.on('error', (err) => {
      writeStream.destroy(err);
      reject(err);
    });
    
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    
    replitStream.pipe(writeStream);
  });
}

async function syncObjectsToFirebase() {
  const prefix = process.env.FIREBASE_STORAGE_PREFIX;
  
  if (!prefix) {
    console.warn('⚠️  FIREBASE_STORAGE_PREFIX not set - sync disabled');
    return { synced: 0, skipped: 0, errors: 0 };
  }

  if (!initializeFirebase()) {
    return { synced: 0, skipped: 0, errors: 0, disabled: true };
  }

  console.log(`🔄 Starting Firebase Storage sync to /${prefix}/...`);
  
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const client = await getReplitClient();
    
    const files = await listAllObjects(client);

    if (files.length === 0) {
      console.log('📦 No objects found in Replit Object Storage');
      return { synced: 0, skipped: 0, errors: 0 };
    }

    console.log(`📦 Found ${files.length} objects in Replit Object Storage`);

    for (const file of files) {
      const objectName = typeof file === 'string' ? file : file.name;
      const firebasePath = `${prefix}/${objectName}`;
      
      try {
        const firebaseFile = firebaseBucket.file(firebasePath);
        const [exists] = await firebaseFile.exists();
        
        if (exists) {
          skipped++;
          continue;
        }

        console.log(`⬆️  Uploading: ${objectName} -> ${firebasePath}`);
        
        const stream = client.downloadAsStream(objectName);
        const contentType = getContentType(objectName);
        
        await streamUploadToFirebase(stream, firebaseFile, contentType);
        
        synced++;
        console.log(`✅ Synced: ${firebasePath}`);
        
      } catch (fileError) {
        errors++;
        console.error(`❌ Error syncing ${objectName}:`, fileError.message);
        Sentry.captureException(fileError, {
          level: 'warning',
          tags: { service: 'firebase_storage', operation: 'sync_file' },
          extra: { objectName, firebasePath }
        });
      }
    }

    console.log(`🔄 Firebase sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);
    
  } catch (error) {
    console.error('❌ Firebase sync failed:', error.message);
    Sentry.captureException(error, {
      level: 'error',
      tags: { service: 'firebase_storage', operation: 'sync' }
    });
    return { synced, skipped, errors: errors + 1 };
  }

  return { synced, skipped, errors };
}

function getContentType(filename) {
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

async function uploadToFirebase(buffer, objectPath) {
  const prefix = process.env.FIREBASE_STORAGE_PREFIX;
  
  if (!prefix || !firebaseBucket) {
    return null;
  }

  const firebasePath = `${prefix}/${objectPath}`;
  
  try {
    const firebaseFile = firebaseBucket.file(firebasePath);
    await firebaseFile.save(buffer, {
      metadata: {
        contentType: getContentType(objectPath)
      }
    });
    console.log(`✅ Uploaded to Firebase: ${firebasePath}`);
    return firebasePath;
  } catch (error) {
    console.error(`❌ Firebase upload failed for ${objectPath}:`, error.message);
    Sentry.captureException(error, {
      level: 'warning',
      tags: { service: 'firebase_storage', operation: 'upload' },
      extra: { objectPath, firebasePath }
    });
    return null;
  }
}

async function deleteFromFirebase(objectPath) {
  const prefix = process.env.FIREBASE_STORAGE_PREFIX;
  
  if (!prefix || !firebaseBucket) {
    return false;
  }

  const firebasePath = `${prefix}/${objectPath}`;
  
  try {
    const firebaseFile = firebaseBucket.file(firebasePath);
    await firebaseFile.delete();
    console.log(`🗑️  Deleted from Firebase: ${firebasePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Firebase delete failed for ${objectPath}:`, error.message);
    return false;
  }
}

module.exports = {
  initializeFirebase,
  syncObjectsToFirebase,
  uploadToFirebase,
  deleteFromFirebase
};
