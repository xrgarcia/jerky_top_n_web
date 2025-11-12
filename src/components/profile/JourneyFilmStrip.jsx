import React, { useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import WhatsNextCard from './WhatsNextCard';
import './JourneyFilmStrip.css';

function JourneyFilmStrip({ milestones, journeyStage, explorationBreadth, userCreatedAt }) {
  const scrollContainerRef = useRef(null);

  const getTenureSubtitle = () => {
    if (!userCreatedAt) return '';
    const tenure = formatDistanceToNow(new Date(userCreatedAt), { addSuffix: false });
    return `Member for ${tenure}`;
  };

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
      <div className="film-strip-header">
        <div className="film-strip-title-section">
          <h2 className="film-strip-title">Your Flavor Journey</h2>
          {userCreatedAt && (
            <p className="film-strip-subtitle">{getTenureSubtitle()}</p>
          )}
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

      <div className="film-scroll-container" ref={scrollContainerRef}>
        <div className="film-reel">
          {milestones.map((milestone, index) => renderMilestone(milestone, index))}
          <WhatsNextCard 
            journeyStage={journeyStage} 
            explorationBreadth={explorationBreadth} 
          />
        </div>
      </div>
    </div>
  );
}

export default JourneyFilmStrip;
