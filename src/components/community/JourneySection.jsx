import React from 'react';
import './JourneySection.css';

function JourneySection() {
  return (
    <div className="journey-section">
      <h2 className="journey-title">
        Your Journey: <span className="journey-start">Curious Newbie</span> → <span className="journey-end">Flavor Legend</span>
      </h2>
      <p className="journey-description">
        Every product you rank fuels your climb from rookie to podium royalty. Here's how flavor fanatics make their mark:
      </p>
      <div className="journey-steps">
        <div className="journey-step">
          <span className="step-icon">💎</span>
          <div className="step-content">
            <h3 className="step-title">Build Your Collection</h3>
            <p className="step-description">Unlock flavor coins & achievements</p>
          </div>
        </div>
        <div className="journey-step">
          <span className="step-icon">🏅</span>
          <div className="step-content">
            <h3 className="step-title">Earn Your Stripes</h3>
            <p className="step-description">Progress from bronze to diamond tiers</p>
          </div>
        </div>
        <div className="journey-step">
          <span className="step-icon">🤝</span>
          <div className="step-content">
            <h3 className="step-title">Find Your Tribe</h3>
            <p className="step-description">Join flavor communities (savory, sweet, exotic)</p>
          </div>
        </div>
        <div className="journey-step">
          <span className="step-icon">🏆</span>
          <div className="step-content">
            <h3 className="step-title">Claim the Podium</h3>
            <p className="step-description">Prove you've got what it takes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JourneySection;
