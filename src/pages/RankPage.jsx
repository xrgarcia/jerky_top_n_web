import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useRanking } from '../hooks/useRanking';
import { useRankingCommentary } from '../hooks/useRankingCommentary';
import { useCollectionProgress } from '../hooks/useCollectionProgress';
import { useSocket } from '../hooks/useSocket';
import { api } from '../utils/api';
import { SortableSlot } from '../components/rank/SortableSlot';
import { DraggableProduct } from '../components/rank/DraggableProduct';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import PersonalizedGuidance from '../components/personalized/PersonalizedGuidance';
import './RankPage.css';

export default function RankPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [lastSearchedTerm, setLastSearchedTerm] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [maxRankableCount, setMaxRankableCount] = useState(null);
  
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
        handleSearch();
      }, 400); // 400ms debounce
      
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);
  
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
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setProducts([]);
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
      
      // Use the last searched term, not current searchTerm (which might be mid-edit)
      if (lastSearchedTerm) {
        params.set('query', lastSearchedTerm);
      }

      const data = await api.get(`/products/rankable?${params.toString()}`);
      // Silently update products without triggering loading state
      setProducts(Array.isArray(data) ? data : (data?.products ?? []));
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
          <PersonalizedGuidance />
          
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
              <h2>Purchased Products</h2>
          {collectionProgress && (
            <div className="collection-progress-bar">
              <div className="progress-header">
                <span className="progress-icon">{collectionProgress.icon}</span>
                <span className="progress-message">{collectionProgress.message}</span>
              </div>
              <div className="progress-stats">
                <div className="progress-track">
                  <div 
                    className={`progress-fill progress-${collectionProgress.progressColor}`}
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
              {loading ? 'Searching...' : 'Search'}
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
