import { useDraggable } from '@dnd-kit/core';
import './DraggableProduct.css';

export function DraggableProduct({ product }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `product-${product.id}`,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`product-card ${isDragging ? 'dragging' : ''}`}
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
