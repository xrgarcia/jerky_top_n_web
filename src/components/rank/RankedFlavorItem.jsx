import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';
import './RankedFlavorItem.css';

/**
 * Ranked flavor item with rank number displayed outside the card
 * Matches mockup design while supporting drag-and-drop
 */
export function RankedFlavorItem({ position, product, isDragging }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${position}`
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef
  } = useDraggable({
    id: `draggable-slot-${position}`,
    disabled: !product,
    data: { product, position }
  });

  if (!product) {
    // Empty slot - just show the droppable area
    return (
      <div
        ref={setDropRef}
        className={`ranked-item empty ${isOver ? 'drag-over' : ''}`}
      >
        <div className="rank-number">#{position}</div>
        <div className="flavor-card empty-slot">
          <div className="empty-slot-content">
            Drop a product here to rank #{position}
          </div>
        </div>
      </div>
    );
  }

  // Determine the icon to display
  const getFlavorIcon = () => {
    if (product.flavorIcon) return product.flavorIcon;
    if (product.animalIcon) return product.animalIcon;
    return product.title?.charAt(0) || '?';
  };

  const icon = getFlavorIcon();
  const meatType = product.animalDisplay || product.animalType || 'Unknown';

  return (
    <div
      ref={setDropRef}
      className={`ranked-item ${isOver ? 'drag-over' : ''}`}
    >
      <div className="rank-number">#{position}</div>
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        className={`flavor-card ranked ${isDragging ? 'dragging' : ''}`}
      >
        {/* Drag Handle */}
        <div className="drag-handle">
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

        {/* View Icon */}
        <Link 
          to={`/products/${product.id}`} 
          className="view-icon"
          onClick={(e) => e.stopPropagation()}
          aria-label={`View ${product.title}`}
        >
          →
        </Link>
      </div>
    </div>
  );
}
