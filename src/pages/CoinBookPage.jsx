import React from 'react';
import { Link } from 'react-router-dom';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import './CoinBookPage.css';

function CoinBookPage() {
  return (
    <div className="coinbook-page">
      {/* Hero: The Coin Book */}
      <section className="coinbook-hero">
        <div className="hero-background">
          <div className="hero-glow"></div>
        </div>
        <div className="coinbook-container">
          <div className="hero-intro">
            <h1 className="hero-title">Your Coin Book</h1>
            <p className="hero-subtitle">
              Like collecting state quarters, your Coin Book shows both what you've earned and what's waiting to be discovered. 
              Each coin tells a story of exploration, discovery, and mastery.
            </p>
          </div>
          <CoinBookWidget defaultCollapsed={false} />
        </div>
      </section>

      {/* Act 1: First Bite - Starting Your Collection */}
      <section className="act-one">
        <div className="coinbook-container">
          <div className="act-header">
            <span className="act-label">Act I</span>
            <h2 className="act-title">First Bite</h2>
            <p className="act-subtitle">Every jerky lover's journey begins with curiosity and that first taste</p>
          </div>

          <div className="story-grid">
            <div className="story-card flavor-coins">
              <div className="card-accent"></div>
              <h3 className="card-title">Flavor Coins</h3>
              <p className="card-description">
                Each time you <strong>purchase AND rank</strong> a unique flavor, you earn its coin—a badge of honor 
                for trying something new. Both actions are required: the flavor must be purchased from the store 
                and then ranked by you.
              </p>
              <p className="card-detail">
                Each coin represents both participation (your journey) and flavor history (what you've tasted).
              </p>
            </div>

            <div className="story-card engagement-coins">
              <div className="card-accent"></div>
              <h3 className="card-title">Engagement Coins</h3>
              <p className="card-description">
                Earned through site activities like searches, logins, ranking streaks, and milestones. 
                These coins demonstrate both your exploration (breadth of trying new things) 
                and discovery (depth of refining preferences).
              </p>
              <p className="card-detail">
                Your engagement builds the foundation for everything that follows.
              </p>
            </div>
          </div>

          <div className="act-cta">
            <Link to="/rank" className="story-button primary">
              Rank Your First Flavor
            </Link>
            <Link to="/flavors" className="story-button secondary">
              Explore All Flavors
            </Link>
          </div>
        </div>
      </section>

      {/* Act 2: Building Mastery - The Collections */}
      <section className="act-two">
        <div className="coinbook-container">
          <div className="act-header">
            <span className="act-label">Act II</span>
            <h2 className="act-title">Building Mastery</h2>
            <p className="act-subtitle">As you explore more flavors, you start building themed collections and discovering your preferences</p>
          </div>

          <div className="collection-showcase">
            <div className="collection-type static">
              <div className="collection-header">
                <h3 className="type-title">Static Collection Coins</h3>
                <span className="type-badge">One-time achievements</span>
              </div>
              <p className="type-description">
                Complete specific sets like <strong>"Classic Beef"</strong> or <strong>"Original Master"</strong>. 
                These fixed, finite challenges never change—but they're yours forever once earned.
              </p>
            </div>

            <div className="collection-type dynamic featured">
              <div className="collection-header">
                <h3 className="type-title">Dynamic Collection Coins</h3>
                <span className="type-badge">Living challenges</span>
              </div>
              <p className="type-description">
                Living collections like <strong>"All Beef"</strong> or <strong>"All Poultry"</strong> update 
                automatically as new flavors are released or retired. Your tier shows how much of each collection you've mastered.
              </p>
              
              <div className="tier-progression">
                <div className="tier-step">
                  <span className="tier-emoji">🥉</span>
                  <span className="tier-name">Bronze</span>
                  <span className="tier-percent">40%</span>
                </div>
                <div className="tier-arrow">→</div>
                <div className="tier-step">
                  <span className="tier-emoji">🥈</span>
                  <span className="tier-name">Silver</span>
                  <span className="tier-percent">60%</span>
                </div>
                <div className="tier-arrow">→</div>
                <div className="tier-step">
                  <span className="tier-emoji">🥇</span>
                  <span className="tier-name">Gold</span>
                  <span className="tier-percent">75%</span>
                </div>
                <div className="tier-arrow">→</div>
                <div className="tier-step">
                  <span className="tier-emoji">🏆</span>
                  <span className="tier-name">Platinum</span>
                  <span className="tier-percent">90%</span>
                </div>
                <div className="tier-arrow">→</div>
                <div className="tier-step">
                  <span className="tier-emoji">💎</span>
                  <span className="tier-name">Diamond</span>
                  <span className="tier-percent">100%</span>
                </div>
              </div>
            </div>

            <div className="collection-type hidden">
              <div className="collection-header">
                <h3 className="type-title">Hidden Collection Coins</h3>
                <span className="type-badge mystery">???</span>
              </div>
              <p className="type-description">
                Secret achievements are hiding in your Coin Book... 
                Can you unlock <strong>"BBQ Lovers"</strong>, <strong>"Sweet Tooth"</strong>, or <strong>"Heat Seeker"</strong>? 
                Meet hidden criteria to reveal these themed treasures.
              </p>
            </div>
          </div>

          <div className="act-cta">
            <Link to="/flavors" className="story-button primary">
              Start a Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Act 3: The Masters - Elite Status */}
      <section className="act-three">
        <div className="coinbook-container">
          <div className="act-header">
            <span className="act-label">Act III</span>
            <h2 className="act-title">The Masters</h2>
            <p className="act-subtitle">The ultimate goal—becoming a true master of your favorite protein categories</p>
          </div>

          <div className="masters-grid">
            <div className="master-card beef">
              <div className="master-accent"></div>
              <h3 className="master-title">Beef Master</h3>
              <p className="master-description">
                Master every beef flavor as they're released. From classic cuts to exotic preparations, 
                prove your expertise with cattle-based jerky.
              </p>
            </div>

            <div className="master-card game">
              <div className="master-accent"></div>
              <h3 className="master-title">Game Master</h3>
              <p className="master-description">
                Conquer the wild frontier—elk, venison, wild boar, and beyond. 
                Only the adventurous earn this living badge.
              </p>
            </div>

            <div className="master-card pork">
              <div className="master-accent"></div>
              <h3 className="master-title">Pork Master</h3>
              <p className="master-description">
                From traditional to innovative, master every pork-based flavor. 
                A timeless challenge for classic jerky enthusiasts.
              </p>
            </div>

            <div className="master-card poultry">
              <div className="master-accent"></div>
              <h3 className="master-title">Poultry Master</h3>
              <p className="master-description">
                Chicken and turkey in all their glory. 
                Lighter, leaner, and just as rewarding to master.
              </p>
            </div>

            <div className="master-card exotic">
              <div className="master-accent"></div>
              <h3 className="master-title">Exotic Master</h3>
              <p className="master-description">
                Alligator, alpaca, kangaroo, ostrich, lamb—dare to taste the extraordinary. 
                The rarest mastery of all.
              </p>
            </div>
          </div>

          <div className="masters-note">
            <div className="note-content">
              <h4>Master Collections Are Living Challenges</h4>
              <p>
                Every new flavor released adds to your journey. Your tier shows your current mastery level, 
                and there's always a new peak to reach. Bronze → Silver → Gold → Platinum → Diamond.
              </p>
              <p className="note-highlight">
                The path to Diamond is long, but every coin earned brings you closer to legend status.
              </p>
            </div>
          </div>

          <div className="act-cta">
            <Link to="/leaderboard" className="story-button primary">
              See the Champions
            </Link>
            <Link to="/rank" className="story-button secondary">
              Continue Your Journey
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CoinBookPage;
