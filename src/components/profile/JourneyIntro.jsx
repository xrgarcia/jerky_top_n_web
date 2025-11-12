import React from 'react';
import './JourneyIntro.css';

function JourneyIntro({ userHandle, journeyStage }) {
  return (
    <div className="journey-intro">
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
}

export default JourneyIntro;
