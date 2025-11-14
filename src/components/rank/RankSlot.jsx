import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import './SortableSlot.css';
import './DragStyles.css';

export function RankSlot({ position, product, isDragging }) {
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

  // Keep content in place - just apply opacity via CSS when dragging
  // This matches DraggableProduct behavior for consistency
  const style = {};

  return (
    <div
      ref={setDropRef}
      className={`ranking-slot ${product ? 'filled' : 'empty'} ${isOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="slot-number">#{position}</div>
      
      {product ? (
        <div
          ref={setDragRef}
          style={style}
          {...attributes}
          {...listeners}
          className="slot-content"
        >
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
        </div>
      ) : (
        <div className="slot-placeholder">
          Drop a product here to rank #{position}
        </div>
      )}
    </div>
  );
}
