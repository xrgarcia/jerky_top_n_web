import { useEffect } from 'react';
import './RankingModal.css';

export function RankingModal({ 
  isOpen, 
  onClose, 
  product, 
  rankedProducts, 
  slotCount,
  onReplace, 
  onInsert 
}) {
  
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen || !product) return null;
  
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  const handleReplace = (position) => {
    onReplace(product, position);
    onClose();
  };
  
  const handleInsert = (position) => {
    onInsert(product, position);
    onClose();
  };
  
  const positions = [];
  for (let i = 1; i <= slotCount; i++) {
    const rankedProduct = rankedProducts.find(r => r.ranking === i);
    positions.push({
      position: i,
      product: rankedProduct?.productData || null,
      isFilled: !!rankedProduct
    });
  }
  
  return (
    <div className="ranking-modal-backdrop" onClick={handleBackdropClick}>
      <div className="ranking-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="ranking-modal-header">
          <div className="modal-product-info">
            <div className="modal-product-thumbnail">
              {product.image ? (
                <img src={product.image} alt={product.title} />
              ) : (
                <div className="no-image">No Image</div>
              )}
            </div>
            <h2 id="modal-title" className="modal-product-title">
              {product.title.length > 40 ? `${product.title.substring(0, 40)}...` : product.title}
            </h2>
          </div>
          <button 
            className="modal-close-button" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        
        <div className="ranking-modal-body">
          {positions.map(({ position, product: currentProduct, isFilled }) => (
            <div key={position} className="position-item">
              <div className="position-header">
                <span className="position-number">Position #{position}</span>
                <span className={`position-badge ${isFilled ? 'filled' : 'empty'}`}>
                  {isFilled ? 'FILLED' : 'EMPTY'}
                </span>
              </div>
              
              {isFilled && currentProduct && (
                <div className="position-current-product">
                  <div className="position-product-thumbnail">
                    {currentProduct.image ? (
                      <img src={currentProduct.image} alt={currentProduct.title} />
                    ) : (
                      <div className="no-image-small">No Image</div>
                    )}
                  </div>
                  <span className="position-product-name">
                    {currentProduct.title}
                  </span>
                </div>
              )}
              
              <div className="position-actions">
                <button
                  className="action-button replace-button"
                  onClick={() => handleReplace(position)}
                  disabled={!isFilled}
                  aria-label={`Replace position ${position}`}
                >
                  REPLACE
                </button>
                <button
                  className="action-button insert-button"
                  onClick={() => handleInsert(position)}
                  aria-label={`Insert at position ${position}`}
                >
                  INSERT
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
