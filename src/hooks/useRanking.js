import { useState, useEffect, useCallback, useRef } from 'react';
import { getPersistentQueue } from '../utils/PersistentQueue';
import { generateUUID } from '../utils/uuid';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { api } from '../utils/api';

export function useRanking(options = {}) {
  const { onSaveComplete } = options;
  const [rankedProducts, setRankedProducts] = useState([]);
  const [slotCount, setSlotCount] = useState(10);
  const [saveStatus, setSaveStatus] = useState({ state: 'idle', message: '' }); // idle, saving, saved, error
  const [isLoading, setIsLoading] = useState(true);
  
  const saveTimeoutRef = useRef(null);
  const persistentQueue = useRef(null);
  const currentOperationId = useRef(null);
  const isRecovering = useRef(false); // Track if we're in recovery mode
  
  // Initialize persistent queue
  useEffect(() => {
    persistentQueue.current = getPersistentQueue();
  }, []);
  
  // Load existing rankings on mount
  useEffect(() => {
    loadRankings();
  }, []);
  
  // Auto-expand slots when getting full
  useEffect(() => {
    if (rankedProducts.length >= slotCount - 3) {
      setSlotCount(prev => prev + 10);
      console.log(`📊 Expanded slots to ${slotCount + 10} (${rankedProducts.length} ranked)`);
    }
  }, [rankedProducts.length, slotCount]);
  
  /**
   * Load existing rankings from backend
   */
  const loadRankings = async () => {
    try {
      setIsLoading(true);
      const data = await api.get('/rankings/products?rankingListId=default');
      
      if (data.rankings && data.rankings.length > 0) {
        // Sort by ranking position
        const sorted = [...data.rankings].sort((a, b) => a.ranking - b.ranking);
        setRankedProducts(sorted);
        console.log(`✅ Loaded ${sorted.length} existing rankings`);
        
        // Set slot count to accommodate rankings + buffer
        if (sorted.length > 0) {
          setSlotCount(Math.max(10, sorted.length + 5));
        }
      }
      
      // Check for pending operations in IndexedDB
      await recoverPendingOperations();
      
    } catch (error) {
      console.error('Failed to load rankings:', error);
      setSaveStatus({ state: 'error', message: 'Failed to load rankings' });
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Recover pending operations from IndexedDB (after page refresh)
   */
  const recoverPendingOperations = async () => {
    if (!persistentQueue.current) return;
    
    try {
      const pending = await persistentQueue.current.getPending();
      
      if (pending.length > 0) {
        console.log(`🔄 Found ${pending.length} pending operation(s), attempting recovery...`);
        
        // Set recovery mode to skip individual callbacks
        isRecovering.current = true;
        
        for (const operation of pending) {
          try {
            await saveToBackend(operation.rankings, operation.operationId);
          } catch (error) {
            console.error('Failed to recover operation:', operation.operationId, error);
          }
        }
        
        // Recovery complete - trigger single callback for all operations
        isRecovering.current = false;
        if (onSaveComplete) {
          console.log('✅ Recovery complete - triggering single refresh');
          onSaveComplete(rankedProducts, null);
        }
      }
    } catch (error) {
      console.error('Failed to recover pending operations:', error);
      isRecovering.current = false;
    }
  };
  
  /**
   * Add product to ranking at specific position
   */
  const addRanking = useCallback((product, position) => {
    setRankedProducts(prev => {
      const newRankings = [...prev];
      
      // Find if product already ranked
      const existingIndex = newRankings.findIndex(r => r.productData.id === product.id);
      
      if (existingIndex !== -1) {
        // Remove from old position
        newRankings.splice(existingIndex, 1);
      }
      
      // Insert at new position
      newRankings.splice(position - 1, 0, {
        ranking: position,
        productData: product
      });
      
      // Renumber all rankings
      const renumbered = newRankings.map((r, index) => ({
        ...r,
        ranking: index + 1
      }));
      
      console.log(`✅ Added/moved "${product.title}" to position ${position}`);
      
      // Trigger auto-save with position info
      scheduleAutoSave(renumbered, position);
      
      return renumbered;
    });
  }, []);
  
  /**
   * Remove product from rankings
   */
  const removeRanking = useCallback((productId) => {
    setRankedProducts(prev => {
      // Find the position before removing
      const removedItem = prev.find(r => r.productData.id === productId);
      const removedPosition = removedItem ? removedItem.ranking : null;
      
      const filtered = prev.filter(r => r.productData.id !== productId);
      
      // Renumber remaining rankings
      const renumbered = filtered.map((r, index) => ({
        ...r,
        ranking: index + 1
      }));
      
      console.log(`🗑️ Removed product ${productId} from position ${removedPosition}`);
      
      // Trigger auto-save with removed position (negative to indicate removal)
      scheduleAutoSave(renumbered, removedPosition ? -removedPosition : null);
      
      return renumbered;
    });
  }, []);
  
  /**
   * Reorder rankings (drag and drop within rankings column)
   */
  const reorderRankings = useCallback((fromIndex, toIndex) => {
    setRankedProducts(prev => {
      const newRankings = [...prev];
      const [moved] = newRankings.splice(fromIndex, 1);
      newRankings.splice(toIndex, 0, moved);
      
      // Renumber all rankings
      const renumbered = newRankings.map((r, index) => ({
        ...r,
        ranking: index + 1
      }));
      
      console.log(`🔄 Reordered: position ${fromIndex + 1} → ${toIndex + 1}`);
      
      // Trigger auto-save
      scheduleAutoSave(renumbered);
      
      return renumbered;
    });
  }, []);
  
  /**
   * Schedule auto-save with 800ms debounce
   */
  const scheduleAutoSave = (rankings, position = null) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Immediately persist to IndexedDB
    persistToIndexedDB(rankings);
    
    // Schedule backend save after debounce
    saveTimeoutRef.current = setTimeout(() => {
      saveToBackend(rankings, null, position);
    }, 800);
  };
  
  /**
   * Immediately persist to IndexedDB (survives refresh)
   */
  const persistToIndexedDB = async (rankings) => {
    if (!persistentQueue.current) return;
    
    try {
      const operationId = generateUUID();
      currentOperationId.current = operationId;
      
      await persistentQueue.current.enqueue({
        operationId,
        rankings,
        rankingListId: 'default',
        timestamp: Date.now()
      });
      
      console.log(`💾 Persisted ${rankings.length} ranking(s) to IndexedDB`);
    } catch (error) {
      console.error('Failed to persist to IndexedDB:', error);
    }
  };
  
  /**
   * Save rankings to backend with retry
   */
  const saveToBackend = async (rankings, operationId = null, position = null) => {
    setSaveStatus({ state: 'saving', message: 'Saving...', position });
    
    const idToComplete = operationId || currentOperationId.current;
    
    try {
      // Retry logic for network failures
      await retryWithBackoff(
        async () => {
          await api.post('/rankings/products', {
            rankingListId: 'default',
            rankings: rankings.map(r => ({
              ranking: r.ranking,
              productData: r.productData
            }))
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          onRetry: (attempt, delay, error) => {
            console.log(`Retrying save (attempt ${attempt})...`);
            setSaveStatus({ state: 'saving', message: `Retrying... (${attempt})` });
          }
        }
      );
      
      // Clear from IndexedDB after successful save
      if (persistentQueue.current && idToComplete) {
        await persistentQueue.current.complete(idToComplete);
        console.log(`✅ Cleared persisted operation after successful save`);
        currentOperationId.current = null;
      }
      
      const message = rankings.length === 0 
        ? '✓ All rankings cleared' 
        : `✓ Saved ${rankings.length} ranking${rankings.length === 1 ? '' : 's'}`;
      
      setSaveStatus({ state: 'saved', message, position });
      
      // Notify parent component to refetch products (skip during recovery to avoid multiple fetches)
      if (onSaveComplete && !isRecovering.current) {
        onSaveComplete(rankings, position);
      }
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveStatus({ state: 'idle', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Failed to save rankings:', error);
      setSaveStatus({ 
        state: 'error', 
        message: error.message || 'Save failed. Will retry...' 
      });
      
      // Keep trying in background
      setTimeout(() => {
        console.log('🔄 Retrying save in background...');
        saveToBackend(rankings, idToComplete);
      }, 5000);
    }
  };
  
  /**
   * Get list of ranked product IDs (for filtering available products)
   */
  const getRankedProductIds = useCallback(() => {
    return rankedProducts.map(r => r.productData.id);
  }, [rankedProducts]);
  
  return {
    rankedProducts,
    slotCount,
    saveStatus,
    isLoading,
    addRanking,
    removeRanking,
    reorderRankings,
    getRankedProductIds,
    refresh: loadRankings
  };
}
