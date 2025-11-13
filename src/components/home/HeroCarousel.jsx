import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderAchievementIcon } from '../../utils/iconUtils';
import './HeroCarousel.css';

export default function HeroCarousel({ heroStats, homeStats, isLoading }) {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slides = [
    {
      id: 'discover',
      title: 'DISCOVER YOUR FLAVOR PROFILE',
      subtitle: `Join ${homeStats?.communityStats?.totalRankers?.toLocaleString() || '...'} rankers exploring ${homeStats?.communityStats?.totalProducts || '...'} jerky products`,
      metrics: [
        { 
          label: 'Active Today', 
          value: homeStats?.communityStats?.activeToday || 0,
          icon: '🔥'
        },
        { 
          label: 'Total Rankings', 
          value: homeStats?.communityStats?.totalRankings?.toLocaleString() || 0,
          icon: '⭐'
        }
      ],
      cta: {
        text: 'Start Ranking',
        action: () => navigate('/rank'),
        primary: true
      }
    },
    {
      id: 'trending',
      title: "SEE WHAT'S TRENDING",
      subtitle: 'Discover what the community loves this week',
      trendingProducts: homeStats?.trending?.slice(0, 3) || [],
      cta: {
        text: 'Explore Flavors',
        action: () => navigate('/flavors'),
        primary: true
      }
    },
    {
      id: 'achievements',
      title: 'COLLECT FLAVOR COINS',
      subtitle: 'Every ranking earns rewards. Bronze to Diamond.',
      latestAchievement: heroStats?.recentAchievements?.[0],
      achievementsThisWeek: heroStats?.achievementsThisWeek || 0,
      cta: {
        text: 'View Coin Book',
        action: () => navigate('/coin-book'),
        primary: true
      }
    },
    {
      id: 'leaderboard',
      title: 'CLIMB THE LEADERBOARD',
      subtitle: `Join ${homeStats?.communityStats?.totalRankers?.toLocaleString() || '...'} jerky enthusiasts ranking their favorites`,
      topRankers: homeStats?.topRankers?.slice(0, 3) || [],
      cta: {
        text: 'View Leaderboard',
        action: () => navigate('/leaderboard'),
        primary: true
      }
    }
  ];

  // Auto-advance slides every 8 seconds
  useEffect(() => {
    if (isPaused || isLoading) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isPaused, isLoading, slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsPaused(true);
    // Resume auto-advance after 15 seconds of manual interaction
    setTimeout(() => setIsPaused(false), 15000);
  };

  const nextSlide = () => {
    goToSlide((currentSlide + 1) % slides.length);
  };

  const prevSlide = () => {
    goToSlide((currentSlide - 1 + slides.length) % slides.length);
  };

  if (isLoading) {
    return (
      <div className="hero-carousel loading">
        <div className="hero-background">
          <div className="hero-glow"></div>
        </div>
        <div className="carousel-content">
          <h1 className="carousel-title">Loading...</h1>
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div className="hero-carousel">
      <div className="hero-background">
        <div className="hero-glow"></div>
      </div>

      <div className="carousel-content">
        {/* Slide Content */}
        <div className="slide-wrapper" key={slide.id}>
          <h1 className="carousel-title">{slide.title}</h1>
          <p className="carousel-subtitle">{slide.subtitle}</p>

          {/* Slide 1: Discovery Metrics */}
          {slide.id === 'discover' && slide.metrics && (
            <div className="metrics-grid">
              {slide.metrics.map((metric, index) => (
                <div key={index} className="metric-card">
                  <div className="metric-icon">{metric.icon}</div>
                  <div className="metric-value">{metric.value}</div>
                  <div className="metric-label">{metric.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Slide 2: Trending Products */}
          {slide.id === 'trending' && slide.trendingProducts && slide.trendingProducts.length > 0 && (
            <div className="trending-products">
              {slide.trendingProducts.map((product, index) => (
                <div key={index} className="trending-card" onClick={() => navigate(`/product/${product.productId}`)}>
                  {product.productData?.image && (
                    <img 
                      src={product.productData.image} 
                      alt={product.productData.title}
                      className="trending-image"
                    />
                  )}
                  <div className="trending-info">
                    <div className="trending-name">{product.productData?.title}</div>
                    <div className="trending-badge">🔥 {product.recentRankCount} rankings this week</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Slide 3: Achievements */}
          {slide.id === 'achievements' && (
            <div className="achievements-showcase">
              {slide.latestAchievement && (
                <div className="latest-achievement">
                  <span className="achievement-icon-large">
                    {renderAchievementIcon(slide.latestAchievement, 48)}
                  </span>
                  <div className="achievement-details">
                    <span className="achievement-user-name">{slide.latestAchievement.userName}</span>
                    <span className="achievement-action"> just earned </span>
                    <span className="achievement-coin-name">"{slide.latestAchievement.achievementName}"</span>
                  </div>
                </div>
              )}
              <div className="achievements-count">
                <span className="count-number">{slide.achievementsThisWeek}</span> achievements unlocked this week
              </div>
            </div>
          )}

          {/* Slide 4: Leaderboard */}
          {slide.id === 'leaderboard' && slide.topRankers && slide.topRankers.length > 0 && (
            <div className="leaderboard-preview">
              {slide.topRankers.map((ranker, index) => (
                <div 
                  key={ranker.userId || index} 
                  className="ranker-card" 
                  onClick={() => navigate(`/community/${ranker.handle || ranker.userId}`)}
                >
                  <div className="ranker-position">#{index + 1}</div>
                  
                  <div className="avatar-wrapper">
                    <div className="avatar avatar-small">
                      {ranker.avatarUrl ? (
                        <img src={ranker.avatarUrl} alt={ranker.displayName} className="avatar-image" />
                      ) : (
                        <div className="avatar-initials">{ranker.initials || ranker.displayName?.[0] || '?'}</div>
                      )}
                    </div>
                  </div>

                  <div className="ranker-info">
                    <div className="ranker-name">{ranker.displayName}</div>
                    <div className="ranker-score">{ranker.engagementScore?.toLocaleString() || 0} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CTA Button */}
          <button 
            className={`carousel-cta ${slide.cta.primary ? 'primary' : 'secondary'}`}
            onClick={slide.cta.action}
          >
            {slide.cta.text}
            <span className="cta-arrow">→</span>
          </button>
        </div>

        {/* Navigation Controls */}
        <div className="carousel-controls">
          <button className="carousel-arrow prev" onClick={prevSlide} aria-label="Previous slide">
            ‹
          </button>
          
          <div className="carousel-dots">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button className="carousel-arrow next" onClick={nextSlide} aria-label="Next slide">
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
