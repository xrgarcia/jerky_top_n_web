import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './SortableSlot.css';
import './DragStyles.css';

export function SortableSlot({ position, product, onRemove, isDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver
  } = useSortable({ id: `slot-${position}` });

  // Remove transform/transition - keep items stationary like DraggableProduct
  // DragOverlay will show the visual feedback
  const style = {};

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(product.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ranking-slot ${product ? 'filled' : 'empty'} ${isOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="slot-number">#{position}</div>
      
      {product ? (
        <div className="slot-content">
          <div className="slot-product-image">
            {product.image ? (
              <img src={product.image} alt={product.title} />
            ) : (
              <div className="no-image">No Image</div>
            )}
          </div>
          <div className="slot-product-info">
            <h4 className="slot-product-name">{product.title}</h4>
            {product.vendor && (
              <p className="slot-product-vendor">{product.vendor}</p>
            )}
            {product.price && (
              <p className="slot-product-price">${product.price}</p>
            )}
          </div>
          <button
            className="remove-button"
            onClick={handleRemove}
            title="Remove from ranking"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="slot-placeholder">
          Drop a product here to rank #{position}
        </div>
      )}
    </div>
  );
}
