import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPersistentQueue } from '../utils/PersistentQueue';
import { apiClient } from '../utils/api';

export function useMyRankings() {
  return useQuery({
    queryKey: ['myRankings'],
    queryFn: async () => {
      // Session is sent via httpOnly cookie, no need for query param
      const response = await apiClient(`/rankings/products?rankingListId=default`);
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000
  });
}

export function useRankings() {
  const [rankings, setRankings] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastSavedProductIds, setLastSavedProductIds] = useState(new Set());
  const [hasPendingDebounce, setHasPendingDebounce] = useState(false);
  
  const autoSaveTimeoutRef = useRef(null);
  const saveQueueRef = useRef(null);
  const pendingRankingsSnapshotRef = useRef(null);
  const autoSaveRankingsRef = useRef(null);
  const queryClient = useQueryClient();

  const loadRankings = useCallback(async () => {
    try {
      // Session is sent via httpOnly cookie, no need for query param
      const response = await apiClient(`/rankings/products?rankingListId=default`);
      const data = await response.json();
      
      if (data.rankings && Array.isArray(data.rankings)) {
        const formattedRankings = data.rankings.map(r => ({
          ranking: r.ranking,
          productData: r.productData
        }));
        setRankings(formattedRankings);
        setLastSavedProductIds(new Set(data.rankings.map(r => r.productData.productId)));
        console.log(`✅ Loaded ${formattedRankings.length} rankings`);
      }
    } catch (error) {
      console.error('Failed to load rankings:', error);
    }
  }, []);

  const collectRankingData = useCallback(() => {
    return rankings.filter(r => r.productData).map(r => ({
      ranking: r.ranking,
      productData: r.productData
    }));
  }, [rankings]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setHasPendingDebounce(true);

    autoSaveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      setSaveMessage('Saving...');
      try {
        await autoSaveRankings();
      } finally {
        setHasPendingDebounce(false);
      }
    }, 800);
  }, []);

  const autoSaveRankings = useCallback(async (rankingsToSave = null) => {
    const currentRankings = rankingsToSave || collectRankingData();
    
    if (saveQueueRef.current?.activeNetworkSave) {
      console.log('🔄 Network save in progress, snapshotting rankings for next save');
      pendingRankingsSnapshotRef.current = currentRankings;
      return;
    }

    const currentProductIds = new Set(currentRankings.map(r => r.productData.productId));
    const newlyRankedProducts = currentRankings.filter(
      r => !lastSavedProductIds.has(r.productData.productId)
    );

    const idempotencyKey = `rank_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    if (saveQueueRef.current) {
      await saveQueueRef.current.enqueue({
        rankings: currentRankings,
        idempotencyKey,
        newlyRankedProducts: newlyRankedProducts.map(r => r.productData)
      });
      
      setLastSavedProductIds(currentProductIds);
    }
  }, [collectRankingData, lastSavedProductIds]);

  autoSaveRankingsRef.current = autoSaveRankings;

  useEffect(() => {
    const processSnapshotCallback = async () => {
      if (pendingRankingsSnapshotRef.current) {
        const snapshot = pendingRankingsSnapshotRef.current;
        console.log('🔄 Auto-processing pending snapshot after save completed');
        try {
          if (autoSaveRankingsRef.current) {
            await autoSaveRankingsRef.current(snapshot);
          }
        } finally {
          pendingRankingsSnapshotRef.current = null;
        }
      }
    };

    const queue = getPersistentQueue();
    saveQueueRef.current = new RankingSaveQueue(
      queue, 
      setSaveStatus, 
      setSaveMessage, 
      queryClient,
      processSnapshotCallback
    );
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [queryClient]);

  const updateRankings = useCallback((newRankings) => {
    setRankings(newRankings);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const clearAllRankings = useCallback(async () => {
    try {
      // Session is sent via httpOnly cookie, no need for query param
      await apiClient(`/rankings/products/clear?rankingListId=default`, { 
        method: 'DELETE' 
      });
      setRankings([]);
      setLastSavedProductIds(new Set());
      setSaveStatus('saved');
      setSaveMessage('Rankings cleared');
      
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    } catch (error) {
      console.error('Failed to clear rankings:', error);
      setSaveStatus('error');
      setSaveMessage('Failed to clear rankings');
    }
  }, [queryClient]);

  const waitForPendingSaves = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      setSaveStatus('saving');
      setSaveMessage('Saving...');
      try {
        await autoSaveRankings();
      } finally {
        setHasPendingDebounce(false);
      }
    }
    
    if (saveQueueRef.current) {
      await saveQueueRef.current.waitForPendingSaves();
    }
    
    if (pendingRankingsSnapshotRef.current) {
      const snapshot = pendingRankingsSnapshotRef.current;
      console.log('🔄 Processing pending snapshot before navigation');
      try {
        await autoSaveRankings(snapshot);
        if (saveQueueRef.current) {
          await saveQueueRef.current.waitForPendingSaves();
        }
      } finally {
        pendingRankingsSnapshotRef.current = null;
      }
    }
  }, [autoSaveRankings]);

  const hasPendingSavesCheck = useCallback(() => {
    return hasPendingDebounce || 
           (saveQueueRef.current?.hasPendingSaves || false) ||
           (pendingRankingsSnapshotRef.current !== null);
  }, [hasPendingDebounce]);

  return {
    rankings,
    updateRankings,
    loadRankings,
    clearAllRankings,
    saveStatus,
    saveMessage,
    waitForPendingSaves,
    hasPendingSaves: hasPendingSavesCheck
  };
}

class RankingSaveQueue {
  constructor(persistentQueue, setSaveStatus, setSaveMessage, queryClient, onQueueDrained) {
    this.persistentQueue = persistentQueue;
    this.setSaveStatus = setSaveStatus;
    this.setSaveMessage = setSaveMessage;
    this.queryClient = queryClient;
    this.onQueueDrained = onQueueDrained;
    this.processing = false;
    this.activeNetworkSave = false;
    this.hasPendingSaves = false;
    
    this.processPendingOperations();
  }

  async processPendingOperations() {
    try {
      const pending = await this.persistentQueue.getPending();
      if (pending.length > 0) {
        console.log(`🔄 Found ${pending.length} pending operation(s) from previous session`);
        this.setSaveStatus('saving');
        this.setSaveMessage(`⏳ Retrying ${pending.length} saved ranking(s)...`);
        
        for (const operation of pending) {
          await this.retryOperation(operation);
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending operations:', error);
    }
  }

  async enqueue(saveData) {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const operation = {
      operationId,
      rankings: saveData.rankings,
      idempotencyKey: saveData.idempotencyKey,
      newlyRankedProducts: saveData.newlyRankedProducts || []
    };

    await this.persistentQueue.enqueue(operation);
    this.hasPendingSaves = true;

    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;
    
    this.processing = true;

    try {
      const pending = await this.persistentQueue.getPending();
      
      for (const operation of pending) {
        await this.executeOperation(operation);
      }
    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      this.processing = false;
      
      const stillPending = await this.persistentQueue.getPending();
      if (stillPending.length > 0) {
        this.processQueue();
      } else {
        this.hasPendingSaves = false;
        if (this.onQueueDrained) {
          await this.onQueueDrained();
        }
      }
    }
  }

  async executeOperation(operation) {
    this.activeNetworkSave = true;
    
    try {
      // Session is sent via httpOnly cookie, no need to include in body
      const response = await apiClient('/rankings/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': operation.idempotencyKey
        },
        body: JSON.stringify({ 
          rankingListId: 'default',
          rankings: operation.rankings 
        })
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      await this.persistentQueue.complete(operation.operationId);
      
      this.setSaveStatus('saved');
      this.setSaveMessage('✓ Saved');
      
      this.queryClient.invalidateQueries({ queryKey: ['rankings'] });
      this.queryClient.invalidateQueries({ queryKey: ['progress'] });
      this.queryClient.invalidateQueries({ queryKey: ['achievements'] });
      
      console.log(`✅ Saved ${operation.rankings.length} rankings`);
      
      setTimeout(() => {
        this.setSaveStatus('idle');
        this.setSaveMessage('');
      }, 2000);

    } catch (error) {
      console.error('❌ Save operation failed:', error);
      
      const retryCount = (operation.retryCount || 0) + 1;
      
      if (retryCount < 3) {
        await this.persistentQueue.update(operation.operationId, {
          retryCount,
          lastAttempt: Date.now()
        });
        
        const backoffMs = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 Retrying in ${backoffMs}ms (attempt ${retryCount + 1}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        // Fetch updated operation with new retryCount before retrying
        const pending = await this.persistentQueue.getPending();
        const updatedOp = pending.find(op => op.operationId === operation.operationId);
        if (updatedOp) {
          await this.retryOperation(updatedOp);
        }
      } else {
        this.setSaveStatus('error');
        this.setSaveMessage('❌ Save failed after 3 attempts');
        console.error('❌ Max retries exceeded for operation:', operation.operationId);
        // Don't leave failed operations in queue forever - mark them as failed
        await this.persistentQueue.markFailed(operation.operationId, error.message);
      }
    } finally {
      this.activeNetworkSave = false;
    }
  }

  async retryOperation(operation) {
    await this.executeOperation(operation);
  }

  async waitForPendingSaves() {
    while (this.hasPendingSaves || this.processing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
