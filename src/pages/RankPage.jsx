import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useRanking } from '../hooks/useRanking';
import { api } from '../utils/api';
import { SortableSlot } from '../components/rank/SortableSlot';
import { DraggableProduct } from '../components/rank/DraggableProduct';
import './RankPage.css';

export default function RankPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeId, setActiveId] = useState(null);
  
  // Ranking state management
  const {
    rankedProducts,
    slotCount,
    saveStatus,
    isLoading: rankingsLoading,
    addRanking,
    removeRanking,
    reorderRankings,
    getRankedProductIds
  } = useRanking();
  
  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter out already-ranked products (optimistic UI)
  const availableProducts = useMemo(() => {
    const rankedIds = new Set(getRankedProductIds());
    return products.filter(p => !rankedIds.has(p.id));
  }, [products, getRankedProductIds]);
  
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    // Update URL params
    if (searchTerm.trim()) {
      setSearchParams({ search: searchTerm.trim() });
    } else {
      setSearchParams({});
    }

    try {
      const params = new URLSearchParams({
        excludeRanked: 'true',
        limit: '50'
      });
      
      if (searchTerm.trim()) {
        params.set('query', searchTerm.trim());
      }

      const data = await api.get(`/products/rankable?${params.toString()}`);
      // API returns array of products directly
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    // Load products on mount (using search term from URL if present)
    handleSearch();
  }, []);
  
  // Generate empty slots
  const slots = useMemo(() => {
    const slotsArray = [];
    for (let i = 1; i <= slotCount; i++) {
      const rankedProduct = rankedProducts.find(r => r.ranking === i);
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
    
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;
    
    // Check if dragging from products to slot
    if (activeId.startsWith('product-')) {
      const productId = activeId.replace('product-', '');
      const product = products.find(p => p.id === productId);
      
      if (product && overId.startsWith('slot-')) {
        const position = parseInt(overId.replace('slot-', ''));
        addRanking(product, position);
      }
    }
    // Check if reordering within slots
    else if (activeId.startsWith('slot-') && overId.startsWith('slot-')) {
      const fromPos = parseInt(activeId.replace('slot-', ''));
      const toPos = parseInt(overId.replace('slot-', ''));
      
      if (fromPos !== toPos) {
        // Find the actual indices in rankedProducts array
        const fromIndex = rankedProducts.findIndex(r => r.ranking === fromPos);
        const toIndex = rankedProducts.findIndex(r => r.ranking === toPos);
        
        if (fromIndex !== -1 && toIndex !== -1) {
          reorderRankings(fromIndex, toIndex);
        }
      }
    }
  };
  
  const handleDragCancel = () => {
    setActiveId(null);
  };
  
  // Find active item for drag overlay
  const activeItem = useMemo(() => {
    if (!activeId) return null;
    
    if (activeId.startsWith('product-')) {
      const productId = activeId.replace('product-', '');
      return products.find(p => p.id === productId);
    } else if (activeId.startsWith('slot-')) {
      const position = parseInt(activeId.replace('slot-', ''));
      return slots.find(s => s.position === position)?.product;
    }
    
    return null;
  }, [activeId, products, slots]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="rank-page">
        <div className="rank-container">
          <div className="rank-column ranks-column">
            <h2>Your Rankings</h2>
            <div className="sub-header">
              <div className="ranking-progress">
                {rankedProducts.length} product{rankedProducts.length !== 1 ? 's' : ''} ranked
              </div>
              {saveStatus.state !== 'idle' && (
                <div className={`save-status save-status-${saveStatus.state}`}>
                  {saveStatus.message}
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
                      onRemove={removeRanking}
                      isDragging={activeId === `slot-${slot.position}`}
                    />
                  ))}
                </SortableContext>
              )}
            </div>
          </div>
        
        <div className="rank-column products-column">
          <h2>Available Products</h2>
          <div className="sub-header">remaining products to rank bar</div>
          
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
                No products found. Try a different search term or click Search to see all available products.
              </div>
            )}

            {!loading && !error && availableProducts.length > 0 && (
              <div className="products-grid">
                {availableProducts.map(product => (
                  <DraggableProduct key={product.id} product={product} />
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
                <p>Search for products or click "Search" to see all available products you can rank.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      
    <DragOverlay>
        {activeItem && (
          <div className="product-card dragging">
            <div className="product-image">
              {activeItem.image ? (
                <img src={activeItem.image} alt={activeItem.title} />
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>
            <div className="product-info">
              <h3 className="product-name">{activeItem.title}</h3>
              {activeItem.vendor && (
                <p className="product-vendor">{activeItem.vendor}</p>
              )}
              {activeItem.price && (
                <p className="product-price">${activeItem.price}</p>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
