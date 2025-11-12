import React from 'react';
import { Link } from 'react-router-dom';
import './WhatsNextCard.css';

function WhatsNextCard({ journeyStage, explorationBreadth }) {
  const getCtaContent = () => {
    if (journeyStage === 'explorer' || explorationBreadth === 'broad') {
      return {
        headline: "Keep Exploring",
        subtitle: "Discover new flavors",
        icon: "🌍",
        link: "/flavors",
        linkText: "Browse Flavors"
      };
    }

    if (journeyStage === 'collector' || journeyStage === 'completionist') {
      return {
        headline: "Collect 'Em All",
        subtitle: "Track your coin book",
        icon: "🪙",
        link: "/coinbook",
        linkText: "View Coin Book"
      };
    }

    if (journeyStage === 'enthusiast') {
      return {
        headline: "Join the Tribe",
        subtitle: "Find your flavor community",
        icon: "👥",
        link: "/community",
        linkText: "Explore Community"
      };
    }

    return {
      headline: "What's Next?",
      subtitle: "Continue your journey",
      icon: "✨",
      link: "/rank",
      linkText: "Rank Flavors"
    };
  };

  const content = getCtaContent();

  return (
    <div className="whats-next-card">
      <div className="next-card-perforations-top"></div>
      <div className="next-card-content">
        <div className="next-card-icon">{content.icon}</div>
        <div className="next-card-text">
          <h3 className="next-card-headline">{content.headline}</h3>
          <p className="next-card-subtitle">{content.subtitle}</p>
        </div>
        <Link to={content.link} className="next-card-cta">
          {content.linkText} →
        </Link>
      </div>
      <div className="next-card-perforations-bottom"></div>
    </div>
  );
}

export default WhatsNextCard;
