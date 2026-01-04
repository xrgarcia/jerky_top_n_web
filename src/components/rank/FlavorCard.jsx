import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import './FlavorCard.css';

/**
 * Shared flavor card component matching mockup design
 * Supports both ranked and unranked variants with drag-and-drop
 */
export function FlavorCard({ 
  product, 
  isDragging, 
  variant = 'unranked', // 'unranked' or 'ranked'
  rankNumber = null,
  onRankClick 
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: variant === 'ranked' ? `draggable-slot-${rankNumber}` : `product-${product.id}`,
    disabled: variant === 'ranked' && !product,
    data: variant === 'ranked' ? { product, position: rankNumber } : undefined
  });

  // Determine the icon to display
  const getFlavorIcon = () => {
    // Priority 1: Flavor icon (more specific)
    if (product.flavorIcon) return product.flavorIcon;
    // Priority 2: Animal icon (meat type)
    if (product.animalIcon) return product.animalIcon;
    // Fallback: First letter of title
    return product.title?.charAt(0) || '?';
  };

  const icon = getFlavorIcon();
  const meatType = product.animalDisplay || product.animalType || 'Unknown';

  const handleViewClick = (e) => {
    // Link will handle navigation
  };

  const handleRankButtonClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRankClick) {
      onRankClick(product);
    }
  };

  return (
    <div
      ref={variant === 'unranked' ? setNodeRef : undefined}
      className={`flavor-card ${isDragging ? 'dragging' : ''} ${variant}`}
      {...(variant === 'unranked' ? { ...listeners, ...attributes } : {})}
    >
      {/* Drag Handle */}
      <div className="drag-handle" {...(variant === 'ranked' ? { ...listeners, ...attributes, ref: setNodeRef } : {})}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Flavor Coin */}
      <div className="flavor-coin">
        {icon}
      </div>

      {/* Flavor Info */}
      <div className="flavor-info">
        <div className="flavor-name">{product.title}</div>
        <div className="meat-chip">{meatType}</div>
      </div>

      {/* View Icon - Links to product detail page */}
      <Link 
        to={`/products/${product.id}`} 
        className="view-icon"
        onClick={(e) => e.stopPropagation()}
        aria-label={`View ${product.title}`}
      >
        →
      </Link>

      {/* Rank Button for unranked items */}
      {variant === 'unranked' && onRankClick && (
        <button 
          className="rank-button-mobile"
          onClick={handleRankButtonClick}
          aria-label={`Rank ${product.title}`}
        >
          Rank
        </button>
      )}
    </div>
  );
}
