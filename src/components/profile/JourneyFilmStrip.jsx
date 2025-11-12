import React, { useRef, useEffect } from 'react';
import { format } from 'date-fns';
import WhatsNextCard from './WhatsNextCard';
import { renderAchievementIcon } from '../../utils/iconUtils';
import './JourneyFilmStrip.css';

function JourneyFilmStrip({ milestones, journeyStage, explorationBreadth }) {
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      console.log('🎬 Film Strip Mounted:', {
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        isScrollable: container.scrollWidth > container.clientWidth,
        scrollLeft: container.scrollLeft
      });
    }
  }, [milestones]);

  if (!milestones || milestones.length === 0) {
    return (
      <div className="film-strip-empty">
        <p>No journey moments yet</p>
      </div>
    );
  }

  const handleScrollLeft = () => {
    console.log('⬅️ Left arrow clicked');
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      console.log('Before scroll:', {
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth
      });
      container.scrollBy({ left: -450, behavior: 'smooth' });
      setTimeout(() => {
        console.log('After scroll:', { scrollLeft: container.scrollLeft });
      }, 100);
    } else {
      console.error('❌ scrollContainerRef.current is null!');
    }
  };

  const handleScrollRight = () => {
    console.log('➡️ Right arrow clicked');
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      console.log('Before scroll:', {
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth
      });
      container.scrollBy({ left: 450, behavior: 'smooth' });
      setTimeout(() => {
        console.log('After scroll:', { scrollLeft: container.scrollLeft });
      }, 100);
    } else {
      console.error('❌ scrollContainerRef.current is null!');
    }
  };

  const renderMilestone = (milestone, index) => {
    const formattedDate = format(new Date(milestone.date), 'MMM d, yyyy');

    const renderMilestoneImage = () => {
      if (milestone.product?.image) {
        return (
          <img 
            src={milestone.product.image} 
            alt={milestone.product.title} 
            className="reel-image"
          />
        );
      }
      
      if (milestone.type === 'achievement' && milestone.badge) {
        const iconElement = renderAchievementIcon(
          { icon: milestone.badge, iconType: milestone.iconType },
          80
        );
        return (
          <div className="reel-image-placeholder">
            <span className="reel-badge">{iconElement}</span>
          </div>
        );
      }
      
      return (
        <div className="reel-image-placeholder">
          <span className="reel-badge">{milestone.badge}</span>
        </div>
      );
    };

    return (
      <div key={`${milestone.type}-${index}`} className="reel-canister">
        <div className="reel-inner-disc">
          {renderMilestoneImage()}
        </div>
        <div className="vintage-label">
          <div className="label-title">{milestone.headline}</div>
          <div className="label-date">{formattedDate}</div>
        </div>
      </div>
    );
  };

  const renderHeaderCard = () => {
    return (
      <div className="reel-canister header-card">
        <div className="reel-inner-disc">
          <div className="reel-image-placeholder">
            <span className="reel-badge">🎬</span>
          </div>
        </div>
        <div className="vintage-label">
          <div className="label-title">Your Flavor Journey</div>
          <div className="label-date">Scroll to explore →</div>
        </div>
      </div>
    );
  };

  const topSprocketRef = useRef(null);
  const bottomSprocketRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const topSprocket = topSprocketRef.current;
    const bottomSprocket = bottomSprocketRef.current;

    if (container && topSprocket && bottomSprocket) {
      const handleScroll = () => {
        const scrollLeft = container.scrollLeft;
        topSprocket.scrollLeft = scrollLeft;
        bottomSprocket.scrollLeft = scrollLeft;
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [milestones]);

  const renderSprocketHoles = (ref) => {
    const holeCount = 100;
    return (
      <div className="sprocket-holes" ref={ref}>
        {Array.from({ length: holeCount }).map((_, index) => (
          <div key={index} className="sprocket-hole" />
        ))}
      </div>
    );
  };

  return (
    <div className="journey-film-strip">
      {renderSprocketHoles(topSprocketRef)}
      <div className="film-scroll-container" ref={scrollContainerRef}>
        <div className="film-reel">
          {renderHeaderCard()}
          {milestones.map((milestone, index) => renderMilestone(milestone, index))}
          <WhatsNextCard 
            journeyStage={journeyStage} 
            explorationBreadth={explorationBreadth} 
          />
        </div>
      </div>
      {renderSprocketHoles(bottomSprocketRef)}

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
