import React, { useRef } from 'react';
import { format } from 'date-fns';
import './FlavorJourneyTimeline.css';

/**
 * FlavorJourneyTimeline - Horizontal swipeable timeline showing user's flavor journey
 * Displays purchase and ranking moments in chronological order
 */
function FlavorJourneyTimeline({ timeline }) {
  const scrollContainerRef = useRef(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div className="timeline-empty">
        <p>No journey moments yet</p>
      </div>
    );
  }

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const renderMoment = (moment, index) => {
    const formattedDate = format(new Date(moment.date), 'MMM d, yyyy');

    if (moment.type === 'purchase') {
      return (
        <div key={`${moment.type}-${moment.orderNumber}-${index}`} className="timeline-moment purchase-moment">
          <div className="moment-date">{formattedDate}</div>
          <div className="moment-content">
            <div className="moment-header">
              <span className="moment-icon">📦</span>
              <h3 className="moment-title">Order Delivered</h3>
            </div>
            <p className="moment-description">{moment.count} flavor{moment.count !== 1 ? 's' : ''} received</p>
            <div className="moment-products">
              {moment.products.slice(0, 3).map((product, idx) => (
                <div key={idx} className="moment-product">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="product-thumb" />
                  ) : (
                    <div className="product-thumb-placeholder">{product.title?.charAt(0)}</div>
                  )}
                </div>
              ))}
              {moment.products.length > 3 && (
                <div className="product-more">+{moment.products.length - 3}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (moment.type === 'ranking') {
      return (
        <div key={`${moment.type}-${index}`} className="timeline-moment ranking-moment">
          <div className="moment-date">{formattedDate}</div>
          <div className="moment-content">
            <div className="moment-header">
              <span className="moment-icon">⭐</span>
              <h3 className="moment-title">Ranked Flavors</h3>
            </div>
            <p className="moment-description">{moment.count} ranking{moment.count !== 1 ? 's' : ''} updated</p>
            <div className="moment-products">
              {moment.products.slice(0, 3).map((product, idx) => (
                <div key={idx} className="moment-product ranking-product">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="product-thumb" />
                  ) : (
                    <div className="product-thumb-placeholder">{product.title?.charAt(0)}</div>
                  )}
                  <div className="product-rank">#{product.rankPosition}</div>
                </div>
              ))}
              {moment.products.length > 3 && (
                <div className="product-more">+{moment.products.length - 3}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flavor-journey-timeline">
      <div className="timeline-header">
        <h2 className="timeline-title">Your Flavor Journey</h2>
        <div className="timeline-nav">
          <button 
            onClick={handleScrollLeft} 
            className="timeline-nav-btn"
            aria-label="Scroll left"
          >
            ←
          </button>
          <button 
            onClick={handleScrollRight} 
            className="timeline-nav-btn"
            aria-label="Scroll right"
          >
            →
          </button>
        </div>
      </div>

      <div className="timeline-scroll-container" ref={scrollContainerRef}>
        <div className="timeline-track">
          {timeline.map((moment, index) => renderMoment(moment, index))}
        </div>
      </div>
    </div>
  );
}

export default FlavorJourneyTimeline;
