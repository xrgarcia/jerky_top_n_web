/**
 * PersistentQueue - IndexedDB-backed queue for reliable ranking saves
 * Survives page refreshes, network failures, and browser crashes
 */
export class PersistentQueue {
  constructor(dbName = 'RankingQueue', storeName = 'pending_operations') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.isReady = false;
    this.readyPromise = this.init();
  }

  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this.isReady) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('✅ IndexedDB PersistentQueue ready');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'operationId' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('status', 'status', { unique: false });
          console.log('📦 Created IndexedDB object store:', this.storeName);
        }
      };
    });
  }

  /**
   * Add operation to persistent queue
   */
  async enqueue(operation) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const operationData = {
        ...operation,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: operation.retryCount || 0,
        lastAttempt: null
      };
      
      const request = store.put(operationData);
      
      request.onsuccess = () => {
        console.log(`📝 Queued operation: ${operation.operationId.substring(0, 8)} for rank ${operation.ranking}`);
        resolve(operationData);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to enqueue operation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending operations
   */
  async getPending() {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll('pending');
      
      request.onsuccess = () => {
        const operations = request.result || [];
        // Sort by timestamp (oldest first)
        operations.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to get pending operations:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Mark operation as completed and remove from queue
   */
  async complete(operationId) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(operationId);
      
      request.onsuccess = () => {
        console.log(`✅ Completed operation: ${operationId.substring(0, 8)}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Failed to complete operation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update operation (for retry tracking)
   */
  async update(operationId, updates) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(operationId);
      
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (!operation) {
          resolve(null);
          return;
        }
        
        const updatedOperation = { ...operation, ...updates };
        const putRequest = store.put(updatedOperation);
        
        putRequest.onsuccess = () => resolve(updatedOperation);
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Get operation by ID
   */
  async get(operationId) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(operationId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all operations (for testing/debugging)
   */
  async clear() {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('🗑️ Cleared all pending operations');
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue size
   */
  async size() {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let persistentQueueInstance = null;

export function getPersistentQueue() {
  if (!persistentQueueInstance) {
    persistentQueueInstance = new PersistentQueue();
  }
  return persistentQueueInstance;
}
