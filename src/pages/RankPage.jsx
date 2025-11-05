import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useRanking } from '../hooks/useRanking';
import { useRankingCommentary } from '../hooks/useRankingCommentary';
import { useCollectionProgress } from '../hooks/useCollectionProgress';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { addBreadcrumb, captureError } from '../utils/sentry';
import { SortableSlot } from '../components/rank/SortableSlot';
import { DraggableProduct } from '../components/rank/DraggableProduct';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import PersonalizedGuidance from '../components/personalized/PersonalizedGuidance';
import './RankPage.css';

export default function RankPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { role } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [lastSearchedTerm, setLastSearchedTerm] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [maxRankableCount, setMaxRankableCount] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Fetch total rankable product count on mount
  useEffect(() => {
    const fetchMaxRankableCount = async () => {
      try {
        const data = await api.get('/products/rankable/count');
        setMaxRankableCount(data.totalRankable);
        console.log(`📊 User can rank up to ${data.totalRankable} products`);
      } catch (err) {
        console.error('Failed to fetch max rankable count:', err);
      }
    };
    fetchMaxRankableCount();
  }, []);
  
  // Auto-search after typing 3+ characters (debounced)
  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    
    // Only auto-search if 3+ characters and different from last searched term
    if (trimmedTerm.length >= 3 && trimmedTerm !== lastSearchedTerm) {
      const timer = setTimeout(() => {
        setLoading(true);
        setError(null);
        setHasSearched(true);
        setLastSearchedTerm(trimmedTerm);
        
        if (trimmedTerm) {
          setSearchParams({ search: trimmedTerm });
        } else {
          setSearchParams({});
        }

        const params = new URLSearchParams({
          excludeRanked: 'true',
          limit: '50',
          sort: 'name-asc'
        });
        
        if (trimmedTerm) {
          params.set('query', trimmedTerm);
        }

        api.get(`/products/rankable?${params.toString()}`)
          .then(data => {
            setProducts(Array.isArray(data) ? data : (data?.products ?? []));
            setLoading(false);
          })
          .catch(err => {
            setError(err.message || 'Failed to load products');
            setProducts([]);
            setLoading(false);
          });
      }, 400); // 400ms debounce
      
      return () => clearTimeout(timer);
    }
  }, [searchTerm, lastSearchedTerm, setSearchParams]);
  
  // Ranking state management with callback to refetch products after save
  const {
    rankedProducts,
    slotCount,
    saveStatus,
    isLoading: rankingsLoading,
    addRanking,
    removeRanking,
    reorderRankings,
    getRankedProductIds
  } = useRanking({
    maxRankableCount,
    onSaveComplete: (rankings, position) => {
      console.log('🔄 onSaveComplete called - refetching products with search term:', lastSearchedTerm || searchParams.get('search') || '(none)');
      
      // Silently refetch to replenish available products without visual flashing
      // The optimistic UI keeps the list stable while fetching happens in background
      handleSearchSilent();
      
      // Always invalidate commentaries to update progress
      queryClient.invalidateQueries({ queryKey: ['rankingCommentary'] });
      queryClient.invalidateQueries({ queryKey: ['collectionProgress'] });
    }
  });
  
  // Fetch ranking progress commentary from backend
  const { data: commentary } = useRankingCommentary();
  
  // Fetch collection progress for Available Products section
  const { data: collectionProgress } = useCollectionProgress('available_products');
  
  // Generate celebratory message based on position
  const getCelebratoryMessage = (state, position) => {
    // Removal messages (position is negative)
    if (position && position < 0) {
      const absPosition = Math.abs(position);
      
      if (state === 'saving') {
        const removalMessages = [
          `Need to rethink that #${absPosition}?`,
          `#${absPosition} back to the list!`,
          `Second thoughts on #${absPosition}?`,
          `Removing #${absPosition}...`
        ];
        return removalMessages[absPosition % removalMessages.length];
      }
      
      if (state === 'saved') {
        const removedMessages = [
          `✓ #${absPosition} removed!`,
          `✓ Back to the drawing board!`,
          `✓ Unranked!`,
          `✓ Removed from list!`
        ];
        return removedMessages[absPosition % removedMessages.length];
      }
    }
    
    // Addition messages (position is positive)
    if (state === 'saving' && position && position > 0) {
      const messages = {
        1: ['🏆 Ranking your #1 favorite...', '👑 Crowning your champion...', '⭐ Marking your top pick...'],
        2: ['🥈 Ranking your runner-up...', '⭐ Placing your #2...', '✨ Second best ranked...'],
        3: ['🥉 Ranking your bronze medal...', '✨ Top 3 choice...', '⭐ Third place locked in...'],
        4: ['Great choice! Ranking #4...', '✓ Adding to top 5...', '⭐ Ranking...'],
        5: ['Nice pick! Ranking #5...', '✓ Top 5 complete...', '⭐ Ranking...'],
      };
      
      const tier = position <= 5 ? position : 'default';
      const defaultMsg = ['✓ Ranking...', '⭐ Adding to your list...'];
      const options = messages[tier] || defaultMsg;
      
      // Use position as seed for consistent message per position
      return options[(position - 1) % options.length];
    }
    
    if (state === 'saved' && position && position > 0) {
      const messages = {
        1: ['✓ Champion ranked!', '✓ #1 saved!', '✓ Your favorite crowned!'],
        2: ['✓ Runner-up ranked!', '✓ #2 saved!', '✓ Silver medal locked!'],
        3: ['✓ Bronze ranked!', '✓ #3 saved!', '✓ Top 3 complete!'],
        4: ['✓ Ranked!', '✓ #4 saved!', '✓ Added!'],
        5: ['✓ Ranked!', '✓ #5 saved!', '✓ Added!'],
      };
      
      const tier = position <= 5 ? position : 'default';
      const defaultMsg = ['✓ Ranked!', '✓ Saved!'];
      const options = messages[tier] || defaultMsg;
      
      return options[(position - 1) % options.length];
    }
    
    return saveStatus.message;
  };
  
  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter out already-ranked products (optimistic UI)
  // BUT keep product visible during drag (don't filter out activeId)
  const availableProducts = useMemo(() => {
    if (!Array.isArray(products) || !getRankedProductIds) return [];
    const rankedIds = new Set(getRankedProductIds());
    const activeDragProductId = activeId?.startsWith('product-') ? activeId.replace('product-', '') : null;
    
    return products.filter(p => {
      if (!p) return false;
      // Keep product visible if it's being dragged (even if ranked)
      if (activeDragProductId && p.id === activeDragProductId) return true;
      // Otherwise filter out ranked products
      return !rankedIds.has(p.id);
    });
  }, [products, getRankedProductIds, activeId]);
  
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    // Update URL params and track what we're actually searching for
    const termToSearch = searchTerm.trim();
    setLastSearchedTerm(termToSearch);
    
    if (termToSearch) {
      setSearchParams({ search: termToSearch });
    } else {
      setSearchParams({});
    }

    addBreadcrumb(
      `User searched for products: "${termToSearch || '(all)'}"`,
      'user_action',
      { searchTerm: termToSearch, page: 'RankPage' }
    );

    try {
      const params = new URLSearchParams({
        excludeRanked: 'true',
        limit: '50',
        sort: 'name-asc'  // Alphabetical sorting for predictable order
      });
      
      if (termToSearch) {
        params.set('query', termToSearch);
      }

      const data = await api.get(`/products/rankable?${params.toString()}`);
      // API returns { products: [...] } not a bare array
      setProducts(Array.isArray(data) ? data : (data?.products ?? []));
      
      addBreadcrumb(
        `Search returned ${Array.isArray(data) ? data.length : (data?.products?.length || 0)} products`,
        'api_response',
        { resultCount: Array.isArray(data) ? data.length : (data?.products?.length || 0) }
      );
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setProducts([]);
      
      const { user, userRole } = useAuthStore.getState();
      captureError(err, {
        page: 'RankPage',
        user: user ? { id: user.id, email: user.email, role: userRole } : undefined,
        operation: 'handleSearch',
        result: 'failure',
        message: `Failed to search for rankable products: ${err.message}`,
        errorType: err.name || 'ProductSearchError',
        searchTerm: termToSearch,
        apiEndpoint: '/products/rankable',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Silent refetch to replenish available products without showing loading state
   * Uses lastSearchedTerm to ensure we refetch the same query that's currently displayed
   * This prevents visual flashing while keeping the list up-to-date
   */
  const handleSearchSilent = async () => {
    try {
      const params = new URLSearchParams({
        excludeRanked: 'true',
        limit: '50',
        sort: 'name-asc'
      });
      
      // CRITICAL FIX: Check both lastSearchedTerm AND URL params to preserve search
      // This handles the case where user loaded page with ?search=term but hasn't triggered a search yet
      const searchTermToUse = lastSearchedTerm || searchParams.get('search') || '';
      
      console.log('🔍 handleSearchSilent - searchTermToUse:', searchTermToUse);
      console.log('🔍 handleSearchSilent - lastSearchedTerm:', lastSearchedTerm);
      console.log('🔍 handleSearchSilent - URL search param:', searchParams.get('search'));
      
      if (searchTermToUse) {
        params.set('query', searchTermToUse);
      }

      const apiUrl = `/products/rankable?${params.toString()}`;
      console.log('🔍 handleSearchSilent - Fetching:', apiUrl);
      
      const data = await api.get(apiUrl);
      const productsArray = Array.isArray(data) ? data : (data?.products ?? []);
      
      console.log('🔍 handleSearchSilent - Received', productsArray.length, 'products');
      
      // Silently update products without triggering loading state
      setProducts(productsArray);
    } catch (err) {
      // Silent failure - don't show error to user
      console.error('Background refetch failed:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // Force sync all rankings from IndexedDB to backend
  const handleForceSync = async () => {
    setIsSyncing(true);
    
    addBreadcrumb(
      'User initiated Force Sync',
      'user_action',
      { page: 'RankPage', inMemoryCount: rankedProducts.length }
    );
    
    try {
      // CRITICAL: Read from IndexedDB (persistent queue), NOT from rankedProducts state
      // rankedProducts state might be stale (loaded from backend with missing items)
      // IndexedDB has the authoritative local state
      const { getPersistentQueue } = await import('../utils/PersistentQueue');
      const queue = getPersistentQueue();
      const pending = await queue.getPending();
      
      if (!pending || pending.length === 0) {
        alert('No pending rankings in IndexedDB to sync. Try ranking some products first!');
        setIsSyncing(false);
        return;
      }
      
      // Get the most complete snapshot from IndexedDB
      const sorted = [...pending].sort((a, b) => b.timestamp - a.timestamp);
      const mostRecentOperation = sorted[0];
      const rankingsToSync = mostRecentOperation.rankings;
      
      if (!rankingsToSync || rankingsToSync.length === 0) {
        alert('IndexedDB snapshot is empty. Cannot sync.');
        setIsSyncing(false);
        return;
      }
      
      console.log(`🔍 Force Sync: Found ${rankingsToSync.length} products in IndexedDB`);
      console.log(`🔍 In-memory state has: ${rankedProducts.length} products`);
      
      addBreadcrumb(
        `Force Sync: Found ${rankingsToSync.length} rankings in IndexedDB`,
        'sync',
        { indexedDBCount: rankingsToSync.length, inMemoryCount: rankedProducts.length }
      );
      
      // Check reconciliation status
      const productIds = rankingsToSync.map(r => r.productData.id);
      const reconcileResult = await api.post('/rankings/reconcile', { productIds });
      
      console.log('🔍 Reconciliation result:', reconcileResult);
      
      addBreadcrumb(
        `Reconciliation complete`,
        'api_response',
        { 
          backendCount: reconcileResult.backendCount,
          missingCount: reconcileResult.missingFromBackend.length,
          extraCount: reconcileResult.extraInBackend.length
        }
      );
      
      const message = `Force Sync Analysis:
      
IndexedDB has: ${rankingsToSync.length} products
Backend has: ${reconcileResult.backendCount} products
Missing from backend: ${reconcileResult.missingFromBackend.length}
Extra in backend: ${reconcileResult.extraInBackend.length}

This will overwrite the backend with your IndexedDB state.

Continue?`;
      
      if (!confirm(message)) {
        addBreadcrumb('User cancelled Force Sync', 'user_action');
        setIsSyncing(false);
        return;
      }
      
      addBreadcrumb('User confirmed Force Sync', 'user_action');
      
      // Force save all rankings from IndexedDB to backend
      await api.post('/rankings/products', {
        rankingListId: 'default',
        rankings: rankingsToSync.map(r => ({
          productId: r.productData.id,
          ranking: r.ranking,
          productData: r.productData
        }))
      });
      
      // CRITICAL FIX: Update local state to reflect synced rankings
      // This ensures the UI shows the correct count immediately
      setRankedProducts(rankingsToSync);
      console.log(`✅ Updated local state with ${rankingsToSync.length} synced rankings`);
      
      // Clear the IndexedDB queue after successful sync AND state update
      await queue.clear();
      
      // Invalidate all caches to force refresh
      queryClient.invalidateQueries({ queryKey: ['rankingCommentary'] });
      queryClient.invalidateQueries({ queryKey: ['collectionProgress'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
      
      addBreadcrumb(
        `Force Sync successful: Synced ${rankingsToSync.length} rankings`,
        'sync',
        { syncedCount: rankingsToSync.length, recoveredCount: reconcileResult.missingFromBackend.length }
      );
      
      alert(`✅ Successfully synced ${rankingsToSync.length} products from IndexedDB to backend!\n\nMissing products recovered: ${reconcileResult.missingFromBackend.length}\n\nPage will reload to refresh all data.`);
      
      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error('Force sync failed:', error);
      
      const { user, userRole } = useAuthStore.getState();
      captureError(error, {
        page: 'RankPage',
        user: user ? { id: user.id, email: user.email, role: userRole } : undefined,
        operation: 'handleForceSync',
        result: 'failure',
        message: `Force sync failed when syncing IndexedDB rankings to backend: ${error.message}`,
        errorType: error.name || 'ForceSyncError',
        inMemoryCount: rankedProducts.length,
        apiEndpoint: '/rankings/products',
      });
      
      alert(`❌ Force sync failed: ${error.message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      setIsSyncing(false);
    }
  };
  
  /**
   * Handle product unranking with optimistic UI
   * Immediately adds product back to available products list (alphabetically sorted)
   */
  const handleRemoveRanking = (productId) => {
    // Find the product data before removing
    const rankedProduct = rankedProducts.find(r => r.productData.id === productId);
    
    if (rankedProduct) {
      // Remove from rankings
      removeRanking(productId);
      
      // Optimistically add back to products list in alphabetical order (with deduplication)
      setProducts(prev => {
        // Check if product already exists to avoid duplicates
        if (prev.some(p => p.id === productId)) {
          return prev; // Already in list, no need to add
        }
        
        // Add and sort alphabetically
        const newList = [...prev, rankedProduct.productData];
        return newList.sort((a, b) => 
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        );
      });
    } else {
      // Fallback if product data not found
      removeRanking(productId);
    }
  };

  useEffect(() => {
    // Load products on mount (using search term from URL if present)
    handleSearch();
  }, []);
  
  // Generate empty slots
  const slots = useMemo(() => {
    if (!Array.isArray(rankedProducts)) return [];
    const slotsArray = [];
    for (let i = 1; i <= slotCount; i++) {
      const rankedProduct = rankedProducts.find(r => r && r.ranking === i);
      slotsArray.push({
        position: i,
        product: rankedProduct?.productData || null
      });
    }
    return slotsArray;
  }, [slotCount, rankedProducts]);
  
  // Drag handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) {
      // Drag cancelled - product stays in available list
      return;
    }
    
    const activeId = active.id;
    const overId = over.id;
    
    // Check if dragging from products to slot
    if (activeId.startsWith('product-')) {
      const productId = activeId.replace('product-', '');
      const product = Array.isArray(products) ? products.find(p => p && p.id === productId) : null;
      
      if (product && overId.startsWith('slot-')) {
        const position = parseInt(overId.replace('slot-', ''));
        // Product gets added to ranking and automatically removed from available list
        // by the useMemo filter (rankedIds check)
        addRanking(product, position);
      }
      // If dropped outside a slot, product stays in available list (no action needed)
    }
    // Check if reordering within slots
    else if (activeId.startsWith('slot-') && overId.startsWith('slot-')) {
      const fromPos = parseInt(activeId.replace('slot-', ''));
      const toPos = parseInt(overId.replace('slot-', ''));
      
      if (fromPos !== toPos && Array.isArray(rankedProducts)) {
        // Find the product at the source position
        const fromProduct = rankedProducts.find(r => r && r.ranking === fromPos);
        
        if (fromProduct) {
          // Check if target position is occupied
          const toProduct = rankedProducts.find(r => r && r.ranking === toPos);
          
          if (toProduct) {
            // Both positions have products - use reorderRankings
            const fromIndex = rankedProducts.findIndex(r => r && r.ranking === fromPos);
            const toIndex = rankedProducts.findIndex(r => r && r.ranking === toPos);
            reorderRankings(fromIndex, toIndex);
          } else {
            // Target is empty - use addRanking to move to that position
            addRanking(fromProduct.productData, toPos);
          }
        }
      }
    }
  };
  
  const handleDragCancel = () => {
    setActiveId(null);
  };

  // WebSocket listener: Invalidate commentary when ranking achievements are earned or tiers upgraded
  useEffect(() => {
    if (!socket) return;

    const handleAchievementsEarned = (data) => {
      // Only invalidate commentary if a RANKING category achievement was earned
      if (data.achievements && data.achievements.length > 0) {
        const hasRankingAchievement = data.achievements.some(
          achievement => achievement.category === 'ranking'
        );
        
        if (hasRankingAchievement) {
          // Invalidate commentary to fetch the NEW next milestone
          queryClient.invalidateQueries({ queryKey: ['rankingCommentary'] });
        }
      }
    };
    
    const handleTierUpgrade = (data) => {
      // Invalidate commentary when tier upgrades happen
      // This ensures the commentary reflects the new tier and next milestone
      console.log('🔼 Tier upgrade detected, refreshing ranking commentary:', data);
      queryClient.invalidateQueries({ queryKey: ['rankingCommentary'] });
    };

    socket.on('achievements:earned', handleAchievementsEarned);
    socket.on('tier:upgrade', handleTierUpgrade);

    return () => {
      socket.off('achievements:earned', handleAchievementsEarned);
      socket.off('tier:upgrade', handleTierUpgrade);
    };
  }, [socket, queryClient]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      autoScroll={{
        acceleration: 3,
        interval: 10,
        threshold: {
          x: 0.2,
          y: 0.2
        }
      }}
    >
      <div className="rank-page">
        <div className="rank-container">
          {/* Personalized Guidance - Shows user-specific tips and recommendations */}
          <PersonalizedGuidance page="rank" />
          
          {/* Coin Book Widget - Shows user's achievement progress */}
          <CoinBookWidget defaultCollapsed={true} />
          
          <div className="rank-columns-grid">
            <div className="rank-column ranks-column">
              <div className="header-with-status">
              <h2>Your Rankings</h2>
              {saveStatus.state !== 'idle' && (
                <div className={`save-status-inline save-status-${saveStatus.state}`}>
                  {getCelebratoryMessage(saveStatus.state, saveStatus.position)}
                </div>
              )}
            </div>
            <div className="sub-header">
              {commentary ? (
                <div className="ranking-commentary">
                  <span className="commentary-icon">{commentary.icon}</span>
                  <span className="commentary-message">{commentary.message}</span>
                  {commentary.nextMilestone && (
                    <div className="milestone-hint">
                      {commentary.nextMilestone.iconType === 'image' ? (
                        <img 
                          src={commentary.nextMilestone.icon} 
                          alt={commentary.nextMilestone.name}
                          title={commentary.nextMilestone.name}
                          className="milestone-icon-image"
                          style={{ width: '20px', height: '20px', marginRight: '4px', verticalAlign: 'middle', cursor: 'help' }}
                        />
                      ) : (
                        <span 
                          className="milestone-icon-emoji" 
                          title={commentary.nextMilestone.name}
                          style={{ cursor: 'help' }}
                        >
                          {commentary.nextMilestone.icon}
                        </span>
                      )}{' '}
                      {commentary.nextMilestone.current}/{commentary.nextMilestone.target}
                      {commentary.nextMilestone.metricLabel && ` ${commentary.nextMilestone.metricLabel}`}
                    </div>
                  )}
                </div>
              ) : (
                <div className="ranking-progress">
                  {rankedProducts.length} product{rankedProducts.length !== 1 ? 's' : ''} ranked
                </div>
              )}
            </div>
            
            <div className="slots-container">
              {rankingsLoading ? (
                <div className="loading-state">Loading rankings...</div>
              ) : (
                <SortableContext items={slots.map(s => `slot-${s.position}`)} strategy={verticalListSortingStrategy}>
                  {slots.map(slot => (
                    <SortableSlot
                      key={slot.position}
                      position={slot.position}
                      product={slot.product}
                      onRemove={handleRemoveRanking}
                      isDragging={activeId === `slot-${slot.position}`}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
          </div>
          
            <div className="rank-column products-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2>Purchased Products</h2>
            {role === 'employee_admin' && rankedProducts.length > 0 && (
              <button 
                onClick={handleForceSync}
                className="force-sync-button"
                disabled={isSyncing}
                title="Force sync all rankings from browser to backend"
              >
                {isSyncing ? '⏳ Syncing...' : '🔄 Force Sync'}
              </button>
            )}
          </div>
          {collectionProgress && (
            <div className="collection-progress-bar">
              <div className="progress-header">
                <span className="progress-icon">{collectionProgress.icon}</span>
                <span className="progress-message">{collectionProgress.message}</span>
              </div>
              <div className="collection-progress-stats">
                <div className="collection-progress-track">
                  <div 
                    className={`collection-progress-fill progress-${collectionProgress.progressColor}`}
                    style={{ width: `${collectionProgress.percentage}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {collectionProgress.rankedCount}/{collectionProgress.totalProducts} ranked ({collectionProgress.percentage}%)
                </span>
              </div>
            </div>
          )}
          
          <div className="search-box">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="rank-search-input"
            />
            <button 
              onClick={handleSearch}
              className="search-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Search
                </>
              ) : 'Search'}
            </button>
          </div>

          <div className="products-display">
            {loading && (
              <div className="loading-state">Loading products...</div>
            )}

            {error && (
              <div className="error-state">
                <p>{error}</p>
                <button onClick={handleSearch} className="retry-button">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && hasSearched && products.length === 0 && (
              <div className="empty-state">
                No products found. Try a different search term or click Search to see all purchased products.
              </div>
            )}

            {!loading && !error && availableProducts.length > 0 && (
              <div className="products-grid">
                {availableProducts.map(product => (
                  <DraggableProduct 
                    key={product.id} 
                    product={product}
                    isDragging={activeId === `product-${product.id}`}
                  />
                ))}
              </div>
            )}
            
            {!loading && !error && hasSearched && availableProducts.length === 0 && products.length > 0 && (
              <div className="empty-state">
                All matching products have been ranked!
              </div>
            )}

            {!hasSearched && (
              <div className="initial-state">
                <p>Search for products or click "Search" to see all purchased products you can rank.</p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </DndContext>
  );
}
