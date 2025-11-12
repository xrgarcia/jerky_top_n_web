import React, { forwardRef } from 'react';
import JourneyFilmStrip from './JourneyFilmStrip';
import './JourneyTwoColumn.css';

const JourneyTwoColumn = forwardRef(({ userHandle, milestones, journeyStage, explorationBreadth, userCreatedAt }, ref) => {
  return (
    <div className="journey-two-column" ref={ref}>
      <div className="journey-grid">
        <div className="journey-left">
          <h2 className="journey-section-title">
            The Flavor Journey
          </h2>
          <p className="journey-section-description">
            Every product ranked, every flavor discovered, every milestone reached—this is the story of {userHandle ? `${userHandle}'s` : 'their'} path from first bite to flavor expert. Scroll through the moments that shaped {userHandle ? 'their' : 'this'} jerky obsession.
          </p>
        </div>
        
        <div className="journey-separator"></div>
        
        <div className="journey-right">
          <JourneyFilmStrip 
            milestones={milestones}
            journeyStage={journeyStage}
            explorationBreadth={explorationBreadth}
            userCreatedAt={userCreatedAt}
          />
        </div>
      </div>
    </div>
  );
});

JourneyTwoColumn.displayName = 'JourneyTwoColumn';

export default JourneyTwoColumn;
