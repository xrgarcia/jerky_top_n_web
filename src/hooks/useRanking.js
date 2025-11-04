import { useState, useEffect, useCallback, useRef } from 'react';
import { getPersistentQueue } from '../utils/PersistentQueue';
import { generateUUID } from '../utils/uuid';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { api } from '../utils/api';
import { FEATURE_FLAGS } from '../../shared/constants/featureFlags.mjs';

export function useRanking(options = {}) {
  const { onSaveComplete, maxRankableCount } = options;
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
  
  // Clamp slotCount when maxRankableCount becomes available
  useEffect(() => {
    if (maxRankableCount && slotCount > maxRankableCount) {
      console.log(`📊 Clamping slots from ${slotCount} to ${maxRankableCount} (max rankable products)`);
      setSlotCount(maxRankableCount);
    }
  }, [maxRankableCount]);
  
  // Auto-expand slots when getting full (capped to maxRankableCount)
  useEffect(() => {
    if (rankedProducts.length >= slotCount - 3) {
      setSlotCount(prev => {
        const newCount = prev + 10;
        // Cap to maxRankableCount if available
        if (maxRankableCount && newCount > maxRankableCount) {
          console.log(`📊 Capped slots to ${maxRankableCount} (max rankable products)`);
          return maxRankableCount;
        }
        console.log(`📊 Expanded slots to ${newCount} (${rankedProducts.length} ranked)`);
        return newCount;
      });
    }
  }, [rankedProducts.length, slotCount, maxRankableCount]);
  
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
        
        // Set slot count to accommodate rankings + buffer (capped to maxRankableCount)
        if (sorted.length > 0) {
          const calculatedCount = Math.max(10, sorted.length + 5);
          if (maxRankableCount && calculatedCount > maxRankableCount) {
            setSlotCount(maxRankableCount);
            console.log(`📊 Initial slot count capped to ${maxRankableCount} (max rankable products)`);
          } else {
            setSlotCount(calculatedCount);
          }
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
   * CRITICAL FIX: Now works with single authoritative "current_state" snapshot
   * Includes backfill migration and safety checks to prevent data loss
   */
  const recoverPendingOperations = async () => {
    if (!persistentQueue.current) return;
    
    try {
      const pending = await persistentQueue.current.getPending();
      
      if (pending.length > 0) {
        console.log(`🔄 Found ${pending.length} pending operation(s), recovering...`);
        
        // Set recovery mode to skip individual callbacks
        isRecovering.current = true;
        
        let operationToSave;
        
        // BACKFILL MIGRATION: If multiple old-style operations exist, merge them
        if (pending.length > 1) {
          console.warn(`⚠️ Found ${pending.length} legacy operations - performing backfill merge`);
          
          // Sort by timestamp and take latest
          const sorted = [...pending].sort((a, b) => b.timestamp - a.timestamp);
          operationToSave = sorted[0];
          console.log(`📊 Using latest operation (${operationToSave.rankings.length} products) for backfill`);
        } else {
          // Single operation (expected after migration)
          operationToSave = pending[0];
        }
        
        const recoveredCount = operationToSave.rankings.length;
        const inMemoryCount = rankedProducts.length;
        
        // CRITICAL FIX: Prefer whichever source has MORE products to prevent data loss
        // If IndexedDB has more products than in-memory (which was loaded from backend),
        // that means IndexedDB has unflushed changes - use it!
        if (recoveredCount > inMemoryCount) {
          console.warn(`📊 IndexedDB has MORE products (${recoveredCount}) than in-memory (${inMemoryCount}) - using IndexedDB to prevent data loss!`);
          // Use operationToSave as-is (IndexedDB snapshot)
        } else if (inMemoryCount > recoveredCount) {
          console.warn(`📊 In-memory has MORE products (${inMemoryCount}) than IndexedDB (${recoveredCount}) - using in-memory state!`);
          // Override with in-memory state
          operationToSave = {
            operationId: 'current_state',
            rankings: rankedProducts,
            rankingListId: 'default',
            timestamp: Date.now()
          };
        } else if (inMemoryCount > 0 && recoveredCount === inMemoryCount) {
          console.log(`✅ IndexedDB and in-memory match (${recoveredCount} products) - using IndexedDB`);
          // They match, use IndexedDB (operationToSave as-is)
        } else {
          console.log(`📊 Using IndexedDB snapshot (${recoveredCount} products)`);
          // Use IndexedDB (operationToSave as-is)
        }
        
        console.log(`📤 Saving ${operationToSave.rankings.length} rankings to backend...`);
        
        try {
          // Send the authoritative state (throwOnError=true ensures we know if it fails)
          await saveToBackend(operationToSave.rankings, null, null, true);
          
          // CRITICAL FIX: Update local state to reflect recovered rankings
          // This ensures the UI shows the correct count immediately
          setRankedProducts(operationToSave.rankings);
          console.log(`✅ Updated local state with ${operationToSave.rankings.length} recovered rankings`);
          
          // Only clear ALL operations after CONFIRMED successful save AND state update
          for (const operation of pending) {
            await persistentQueue.current.complete(operation.operationId);
          }
          
          console.log(`✅ Cleared ${pending.length} operation(s) from queue`);
        } catch (error) {
          console.error('Failed to recover state, queue preserved for retry:', error);
          // Leave queue intact on error so retry can happen next load
          isRecovering.current = false;
          throw error; // Re-throw to prevent callback
        }
        
        // Recovery complete - trigger single callback with UPDATED state
        isRecovering.current = false;
        if (onSaveComplete) {
          console.log('✅ Recovery complete - triggering single refresh');
          // Pass the recovered rankings, not the old stale state
          onSaveComplete(operationToSave.rankings, null);
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
      let newRankings = [...prev];
      
      // Find if product already ranked
      const existingIndex = newRankings.findIndex(r => r.productData.id === product.id);
      
      if (existingIndex !== -1) {
        // Remove from old position
        newRankings.splice(existingIndex, 1);
      }
      
      // Check if push-down feature is enabled
      if (FEATURE_FLAGS.ALLOW_INSERT_TO_PUSH_DOWN_RANKINGS) {
        // Check if target position is occupied
        const targetOccupied = newRankings.some(r => r.ranking === position);
        
        if (targetOccupied) {
          // Get all items at or above target position, sorted ascending by rank
          const itemsToPush = newRankings
            .filter(r => r.ranking >= position)
            .sort((a, b) => a.ranking - b.ranking);
          
          // Use cursor to track next available position, shifting items sequentially
          // Stop when we hit a gap (non-contiguous ranks)
          let cursor = position;
          let pushedCount = 0;
          
          for (const item of itemsToPush) {
            // Check if this item is at the expected cursor position
            if (item.ranking === cursor) {
              // Shift it down by one
              item.ranking = cursor + 1;
              cursor++; // Move cursor to next position
              pushedCount++;
            } else {
              // Found a gap (item.ranking > cursor), stop pushing
              break;
            }
          }
          
          console.log(`🔽 Pushed down ${pushedCount} items starting from position ${position}`);
        }
      }
      
      // Insert at new position
      newRankings.push({
        ranking: position,
        productData: product
      });
      
      // Sort by ranking to maintain order
      newRankings.sort((a, b) => a.ranking - b.ranking);
      
      // Conditionally renumber based on feature flag
      const finalRankings = FEATURE_FLAGS.AUTO_FILL_RANKING_GAPS
        ? newRankings.map((r, index) => ({
            ...r,
            ranking: index + 1
          }))
        : newRankings; // Preserve original rankings with gaps
      
      console.log(`✅ Added/moved "${product.title}" to position ${position}`);
      
      // Trigger auto-save with position info
      scheduleAutoSave(finalRankings, position);
      
      return finalRankings;
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
      
      // Conditionally renumber based on feature flag
      const finalRankings = FEATURE_FLAGS.AUTO_FILL_RANKING_GAPS
        ? filtered.map((r, index) => ({
            ...r,
            ranking: index + 1
          }))
        : filtered; // Preserve original rankings with gaps
      
      console.log(`🗑️ Removed product ${productId} from position ${removedPosition}`);
      
      // Trigger auto-save with removed position (negative to indicate removal)
      scheduleAutoSave(finalRankings, removedPosition ? -removedPosition : null);
      
      return finalRankings;
    });
  }, []);
  
  /**
   * Reorder rankings (drag and drop within rankings column)
   * Delegates to addRanking to leverage push-down logic
   */
  const reorderRankings = useCallback((fromIndex, toIndex) => {
    setRankedProducts(prev => {
      // Get the product being moved and its target position
      const movedProduct = prev[fromIndex];
      if (!movedProduct) return prev;
      
      // Calculate target ranking position (toIndex is array index, need ranking number)
      const targetPosition = prev[toIndex]?.ranking;
      if (!targetPosition) return prev;
      
      console.log(`🔄 Reordering: Moving "${movedProduct.productData.title}" to position ${targetPosition}`);
      
      // Use addRanking which handles push-down logic automatically
      // This will remove the product from its current position and insert at target
      // No need to manually splice or renumber - addRanking handles it all
      return prev; // Return current state, addRanking will update via its own setRankedProducts
    });
    
    // Actually trigger the move via addRanking (outside setRankedProducts to avoid nesting)
    const movedProduct = rankedProducts[fromIndex];
    const targetPosition = rankedProducts[toIndex]?.ranking;
    if (movedProduct && targetPosition) {
      addRanking(movedProduct.productData, targetPosition);
    }
  }, [rankedProducts, addRanking]);
  
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
   * CRITICAL FIX: Store ONE authoritative snapshot with constant ID
   * This prevents data loss during recovery
   */
  const persistToIndexedDB = async (rankings) => {
    if (!persistentQueue.current) return;
    
    try {
      // ALWAYS use same operationId so we UPSERT instead of INSERT
      // This ensures we only ever have ONE current state snapshot
      const operationId = 'current_state';
      currentOperationId.current = operationId;
      
      await persistentQueue.current.enqueue({
        operationId,
        rankings,
        rankingListId: 'default',
        timestamp: Date.now()
      });
      
      console.log(`💾 Persisted ${rankings.length} ranking(s) to IndexedDB (current state)`);
    } catch (error) {
      console.error('Failed to persist to IndexedDB:', error);
    }
  };
  
  /**
   * Save rankings to backend with retry
   * @param {boolean} throwOnError - If true, throws errors instead of scheduling retries (used during recovery)
   */
  const saveToBackend = async (rankings, operationId = null, position = null, throwOnError = false) => {
    setSaveStatus({ state: 'saving', message: 'Saving...', position });
    
    const idToComplete = operationId || currentOperationId.current;
    
    try {
      // Retry logic for network failures
      await retryWithBackoff(
        async () => {
          await api.post('/rankings/products', {
            rankingListId: 'default',
            rankings: rankings.map(r => ({
              productId: r.productData.id,
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
      
      // During recovery, throw errors so caller knows save failed
      // During normal operation, schedule background retry
      if (throwOnError) {
        throw error;
      } else {
        // Keep trying in background
        setTimeout(() => {
          console.log('🔄 Retrying save in background...');
          saveToBackend(rankings, idToComplete);
        }, 5000);
      }
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
