import { useDraggable } from '@dnd-kit/core';
import './DraggableProduct.css';
import './DragStyles.css';

export function DraggableProduct({ product, isDragging: isBeingDragged }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `product-${product.id}`,
  });

  // No transform - keep product in original position
  // DragOverlay handles the visual feedback of dragging
  const style = {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`product-card ${isBeingDragged ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="product-image">
        {product.image ? (
          <img src={product.image} alt={product.title} />
        ) : (
          <div className="no-image">No Image</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.title}</h3>
        {product.vendor && (
          <p className="product-vendor">{product.vendor}</p>
        )}
        {product.price && (
          <p className="product-price">${product.price}</p>
        )}
      </div>
    </div>
  );
}
