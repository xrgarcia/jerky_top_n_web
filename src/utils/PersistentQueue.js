/**
 * PersistentQueue - IndexedDB-backed queue for reliable ranking saves
 * Survives page refreshes, network failures, and browser crashes
 */
class PersistentQueue {
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
   * Validate operation has required fields for ranking save
   */
  static validateOperation(operation) {
    if (!operation.operationId) {
      return { valid: false, reason: 'Missing operationId' };
    }
    
    if (!operation.rankings || !Array.isArray(operation.rankings)) {
      return { valid: false, reason: 'Missing or invalid rankings array' };
    }
    
    for (let i = 0; i < operation.rankings.length; i++) {
      const ranking = operation.rankings[i];
      if (!ranking.productData || !ranking.productData.productId) {
        return { valid: false, reason: `Ranking ${i} missing productData.productId` };
      }
      if (typeof ranking.ranking !== 'number') {
        return { valid: false, reason: `Ranking ${i} missing ranking number` };
      }
    }
    
    return { valid: true };
  }

  /**
   * Add operation to persistent queue
   */
  async enqueue(operation) {
    await this.readyPromise;
    
    const validation = PersistentQueue.validateOperation(operation);
    if (!validation.valid) {
      console.error('❌ Invalid operation rejected:', validation.reason, operation);
      throw new Error(`Invalid operation: ${validation.reason}`);
    }
    
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
        console.log(`📝 Queued operation: ${operation.operationId.substring(0, 8)}`);
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
        const pending = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(pending);
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
  async markComplete(operationId) {
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
        console.error('❌ Failed to mark operation as complete:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update operation status (for retry tracking)
   */
  async updateOperation(operationId, updates) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(operationId);
      
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (!operation) {
          reject(new Error('Operation not found'));
          return;
        }
        
        const updatedOperation = { ...operation, ...updates };
        const putRequest = store.put(updatedOperation);
        
        putRequest.onsuccess = () => {
          resolve(updatedOperation);
        };
        
        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Mark operation as failed
   */
  async markFailed(operationId, error) {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(operationId);
      
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (!operation) {
          reject(new Error('Operation not found'));
          return;
        }
        
        const updatedOperation = {
          ...operation,
          status: 'failed',
          lastError: error,
          lastAttempt: Date.now()
        };
        
        const putRequest = store.put(updatedOperation);
        
        putRequest.onsuccess = () => {
          console.log(`❌ Failed operation: ${operationId.substring(0, 8)}`);
          resolve(updatedOperation);
        };
        
        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Get count of pending operations
   */
  async getPendingCount() {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.count('pending');
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all operations from queue
   */
  async clearAll() {
    await this.readyPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('🗑️ Cleared all operations from queue');
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

let persistentQueueInstance = null;

export function getPersistentQueue() {
  if (!persistentQueueInstance) {
    persistentQueueInstance = new PersistentQueue();
  }
  return persistentQueueInstance;
}

export { PersistentQueue };
