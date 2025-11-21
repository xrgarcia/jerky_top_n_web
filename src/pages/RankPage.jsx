import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useRanking } from '../hooks/useRanking';
import { useRankingCommentary } from '../hooks/useRankingCommentary';
import { useCollectionProgress } from '../hooks/useCollectionProgress';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { addBreadcrumb, captureError } from '../utils/sentry';
import { renderAchievementIcon } from '../utils/iconUtils';
import { RankSlot } from '../components/rank/RankSlot';
import { DraggableProduct } from '../components/rank/DraggableProduct';
import { FlavorCard } from '../components/rank/FlavorCard';
import { RankedFlavorItem } from '../components/rank/RankedFlavorItem';
import { RankingModal } from '../components/rank/RankingModal';
import '../styles/hero-headers.css';
import './RankPage.css';

/**
 * Custom collision detection that uses pointer position instead of dragged element's center.
 * This ensures highlighting follows the cursor exactly, not the center of the dragged item.
 */
function pointerClosestCenter(args) {
  const { pointerCoordinates, droppableContainers } = args;
  
  if (!pointerCoordinates) {
    return [];
  }

  const collisions = [];
  
  // droppableContainers is a Map, so we iterate over its values
  for (const droppableContainer of droppableContainers.values()) {
    const { id, rect, disabled } = droppableContainer;
    
    // Skip disabled droppables
    if (disabled || !rect.current) {
      continue;
    }

    const droppableRect = rect.current;
    
    // Calculate center of droppable zone
    const centerX = droppableRect.left + droppableRect.width / 2;
    const centerY = droppableRect.top + droppableRect.height / 2;
    
    // Calculate distance from pointer to droppable center
    const deltaX = pointerCoordinates.x - centerX;
    const deltaY = pointerCoordinates.y - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    collisions.push({
      id,
      data: { droppableContainer, value: distance }
    });
  }
  
  // Sort by distance and return only the closest one
  collisions.sort((a, b) => a.data.value - b.data.value);
  
  return collisions.length > 0 ? [collisions[0]] : [];
}

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Mobile-specific: collapsible rankings state
  // Initialize based on current screen size to avoid flash
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  const [isRankingsCollapsed, setIsRankingsCollapsed] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  // Detect mobile screen size changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    const handleMediaChange = (e) => {
      setIsMobile(e.matches);
      // Collapse rankings by default on mobile, expand on desktop
      setIsRankingsCollapsed(e.matches);
    };
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleMediaChange);
    
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);
  
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
  
  // Auto-search after typing 3+ characters (debounced), or when clearing search
  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    
    // Auto-search if:
    // 1. User typed 3+ characters and it's different from last search, OR
    // 2. User cleared the search (empty string) and there was a previous search
    const shouldSearch = 
      (trimmedTerm.length >= 3 && trimmedTerm !== lastSearchedTerm) ||
      (trimmedTerm.length === 0 && lastSearchedTerm !== '');
    
    if (shouldSearch) {
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
  
  // Ranking state management - uses pure optimistic UI (no refetch needed)
  const {
    rankedProducts,
    slotCount,
    saveStatus,
    isLoading: rankingsLoading,
    addRanking,
    reorderRankings,
    replaceRanking,
    insertRanking,
    getRankedProductIds
  } = useRanking({
    maxRankableCount,
    onSaveComplete: (rankings, position) => {
      // Pure optimistic UI - no refetch needed, just invalidate progress queries
      queryClient.invalidateQueries({ queryKey: ['rankingCommentary'] });
      queryClient.invalidateQueries({ queryKey: ['collectionProgress'] });
    }
  });
  
  // Fetch ranking progress commentary from backend
  const { data: commentary } = useRankingCommentary();
  
  // Fetch collection progress for Available Products section
  const { data: collectionProgress } = useCollectionProgress('available_products');
  
  // Modal handlers
  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };
  
  const handleReplace = (product, position) => {
    replaceRanking(product, position);
  };
  
  const handleInsert = (product, position) => {
    insertRanking(product, position);
  };
  
  // Generate celebratory message based on position
  const getCelebratoryMessage = (state, position) => {
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
      
      // Clear the IndexedDB queue after successful sync
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
    // Check if reordering within slots (draggable ID format: draggable-slot-{position})
    // CRITICAL: Only process if dropped on a slot drop zone (slot-), not on the draggable itself (draggable-slot-)
    else if (activeId.startsWith('draggable-slot-') && overId.startsWith('slot-') && !overId.startsWith('draggable-slot-')) {
      const fromPos = parseInt(activeId.replace('draggable-slot-', ''));
      const toPos = parseInt(overId.replace('slot-', ''));
      
      if (fromPos !== toPos && Array.isArray(rankedProducts)) {
        // Find the product at the source position
        const fromProduct = rankedProducts.find(r => r && r.ranking === fromPos);
        
        if (fromProduct) {
          // Check if target position is occupied
          const toProduct = rankedProducts.find(r => r && r.ranking === toPos);
          
          if (toProduct) {
            // Both positions have products - swap them using reorderRankings
            const fromIndex = rankedProducts.findIndex(r => r && r.ranking === fromPos);
            const toIndex = rankedProducts.findIndex(r => r && r.ranking === toPos);
            reorderRankings(fromIndex, toIndex);
          } else {
            // Target is empty - move product to that position
            // addRanking has deduplication logic that removes existing entry before adding
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
      collisionDetection={pointerClosestCenter}
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
        {/* Hero Section */}
        <div className="rank-hero">
          <h1 className="hero-title">Rank Your Flavors</h1>
          <p className="hero-subtitle">Drag to reorder. Your rankings fuel the Flavor Index.</p>
        </div>

        {/* Two Column Layout - Matches Mockup */}
        <div className="rank-widget-section">
          <div className="rank-container">
            
            {/* Utility Panel - Search, Commentary, Progress */}
            <div className="utility-panel">
              <div className="utility-content">
                {/* Search Box */}
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

                {/* Commentary and Progress */}
                {commentary && (
                  <div className="ranking-commentary">
                    <span className="commentary-icon">{commentary.icon}</span>
                    <span className="commentary-message">{commentary.message}</span>
                  </div>
                )}

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
              </div>
            </div>

            {/* Two Column Grid - Mockup Design */}
            <div className="rank-grid">
              
              {/* LEFT COLUMN: Unranked Flavors */}
              <div className="rank-column">
                <h2 className="column-header">Unranked Flavors</h2>
                <div className="scrollable">
                  <div className="flavor-list">
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
                        <div className="empty-state-icon">🔍</div>
                        <div className="empty-state-text">
                          No products found. Try a different search.
                        </div>
                      </div>
                    )}

                    {!loading && !error && availableProducts.length > 0 && availableProducts.map(product => (
                      <FlavorCard 
                        key={product.id} 
                        product={product}
                        isDragging={activeId === `product-${product.id}`}
                        variant="unranked"
                        onRankClick={handleOpenModal}
                      />
                    ))}
                    
                    {!loading && !error && hasSearched && availableProducts.length === 0 && products.length > 0 && (
                      <div className="empty-state">
                        <div className="empty-state-icon">✓</div>
                        <div className="empty-state-text">
                          All matching products have been ranked!
                        </div>
                      </div>
                    )}

                    {!hasSearched && (
                      <div className="empty-state">
                        <div className="empty-state-icon">👆</div>
                        <div className="empty-state-text">
                          Search for products to start ranking
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Your Rankings */}
              <div className="rank-column">
                <h2 className="column-header">Your Rankings</h2>
                <div className="scrollable">
                  <div className="flavor-list">
                    {rankingsLoading ? (
                      <div className="loading-state">Loading rankings...</div>
                    ) : (
                      <>
                        {slots.map(slot => (
                          <RankedFlavorItem
                            key={slot.position}
                            position={slot.position}
                            product={slot.product}
                            isDragging={activeId === `draggable-slot-${slot.position}`}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sticky Save Bar */}
        {saveStatus.state !== 'idle' && (
          <div className="save-bar">
            <div className="save-bar-content">
              <div className={`save-status save-status-${saveStatus.state}`}>
                {getCelebratoryMessage(saveStatus.state, saveStatus.position)}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <RankingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={selectedProduct}
        rankedProducts={rankedProducts}
        slotCount={slotCount}
        onReplace={handleReplace}
        onInsert={handleInsert}
      />
    </DndContext>
  );
}
