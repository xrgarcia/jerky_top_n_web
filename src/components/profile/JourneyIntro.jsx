import React, { forwardRef } from 'react';
import './JourneyIntro.css';

const JourneyIntro = forwardRef(({ userHandle, journeyStage }, ref) => {
  return (
    <div className="journey-intro" ref={ref}>
      <div className="journey-intro-content">
        <h2 className="journey-intro-title">
          The Flavor Journey
        </h2>
        <p className="journey-intro-description">
          Every product ranked, every flavor discovered, every milestone reached—this is the story of {userHandle ? `${userHandle}'s` : 'their'} path from first bite to flavor expert. Scroll through the moments that shaped {userHandle ? 'their' : 'this'} jerky obsession.
        </p>
      </div>
    </div>
  );
});

JourneyIntro.displayName = 'JourneyIntro';

export default JourneyIntro;
