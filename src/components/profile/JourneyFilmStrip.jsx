import React, { useRef } from 'react';
import { format } from 'date-fns';
import WhatsNextCard from './WhatsNextCard';
import './JourneyFilmStrip.css';

function JourneyFilmStrip({ milestones, journeyStage, explorationBreadth }) {
  const scrollContainerRef = useRef(null);

  if (!milestones || milestones.length === 0) {
    return (
      <div className="film-strip-empty">
        <p>No journey moments yet</p>
      </div>
    );
  }

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -140, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };

  const renderMilestone = (milestone, index) => {
    const formattedDate = format(new Date(milestone.date), 'MMM d, yyyy');

    return (
      <div key={`${milestone.type}-${index}`} className="reel-canister">
        <div className="reel-inner-disc">
          {milestone.product?.image ? (
            <img 
              src={milestone.product.image} 
              alt={milestone.product.title} 
              className="reel-image"
            />
          ) : (
            <div className="reel-image-placeholder">
              <span className="reel-badge">{milestone.badge}</span>
            </div>
          )}
        </div>
        <div className="vintage-label">
          <div className="label-title">{milestone.headline}</div>
          <div className="label-date">{formattedDate}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="journey-film-strip">
      <div className="film-scroll-container" ref={scrollContainerRef}>
        <div className="film-reel">
          {milestones.map((milestone, index) => renderMilestone(milestone, index))}
          <WhatsNextCard 
            journeyStage={journeyStage} 
            explorationBreadth={explorationBreadth} 
          />
        </div>
      </div>

      <div className="film-nav">
        <button 
          onClick={handleScrollLeft} 
          className="film-nav-btn"
          aria-label="Scroll left"
        >
          ←
        </button>
        <button 
          onClick={handleScrollRight} 
          className="film-nav-btn"
          aria-label="Scroll right"
        >
          →
        </button>
      </div>
    </div>
  );
}

export default JourneyFilmStrip;
