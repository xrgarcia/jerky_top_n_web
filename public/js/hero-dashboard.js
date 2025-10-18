/**
 * Hero Dashboard - Gamification Stats Display
 * Manages live stats counters, user progress, and achievement slider
 */

class HeroDashboard {
  constructor() {
    this.stats = null;
    this.currentAchievementIndex = 0;
    this.sliderInterval = null;
    this.userSession = null;
  }

  /**
   * Initialize hero dashboard
   */
  async init() {
    console.log('🎮 Initializing Hero Dashboard...');
    
    // Load initial stats
    await this.loadStats();
    
    // Start achievement slider
    this.startAchievementSlider();
    
    // Setup CTAs
    this.setupCTAs();
    
    // Check user session and load user-specific data
    await this.loadUserProgress();
    
    // Listen for WebSocket updates
    this.setupWebSocketListeners();
    
    console.log('✅ Hero Dashboard initialized');
  }

  /**
   * Load hero statistics from API
   */
  async loadStats() {
    try {
      console.log('📊 Loading hero dashboard stats...');
      const response = await fetch('/api/gamification/hero-stats');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      this.stats = await response.json();
      console.log('✅ Hero stats loaded:', this.stats);
      
      // Update UI with stats
      this.updateStatsDisplay();
      
    } catch (error) {
      console.error('❌ Error loading hero stats:', error);
      // Show fallback values
      this.showFallbackStats();
    }
  }

  /**
   * Update stats display with animation
   */
  updateStatsDisplay() {
    if (!this.stats) return;
    
    // Animate counters
    this.animateCounter('heroActiveRankers', this.stats.activeRankersToday);
    this.animateCounter('heroAchievementsWeek', this.stats.achievementsThisWeek);
    this.animateCounter('heroTotalRankings', this.stats.totalRankings);
  }

  /**
   * Animate number counter with easing
   */
  animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const duration = 1000; // 1 second
    const startValue = 0;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);
      
      element.textContent = currentValue.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = targetValue.toLocaleString();
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Show fallback stats if API fails
   */
  showFallbackStats() {
    const fallbacks = {
      heroActiveRankers: '...',
      heroAchievementsWeek: '...',
      heroTotalRankings: '...',
    };
    
    Object.entries(fallbacks).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  /**
   * Start achievement slider animation
   */
  startAchievementSlider() {
    if (!this.stats || !this.stats.recentAchievements || this.stats.recentAchievements.length === 0) {
      this.showNoAchievementsMessage();
      return;
    }
    
    // Show first achievement immediately
    this.showAchievement(0);
    
    // Rotate achievements every 5 seconds
    this.sliderInterval = setInterval(() => {
      this.currentAchievementIndex = (this.currentAchievementIndex + 1) % this.stats.recentAchievements.length;
      this.showAchievement(this.currentAchievementIndex);
    }, 5000);
  }

  /**
   * Display specific achievement in slider
   */
  showAchievement(index) {
    const slider = document.getElementById('heroAchievementsSlider');
    if (!slider || !this.stats || !this.stats.recentAchievements[index]) return;
    
    const achievement = this.stats.recentAchievements[index];
    
    // Format time ago
    const timeAgo = this.getTimeAgo(achievement.earnedAt);
    
    // Build achievement HTML
    const html = `
      <div class="slider-item">
        <span class="achievement-badge">${achievement.achievementIcon}</span>
        <div class="achievement-text">
          <span class="achievement-user">${achievement.userName}</span>
          earned
          <span class="achievement-name">${achievement.achievementName}</span>
          <span class="achievement-tier ${achievement.achievementTier}">${achievement.achievementTier}</span>
          <span class="achievement-time">${timeAgo}</span>
        </div>
      </div>
    `;
    
    slider.innerHTML = html;
  }

  /**
   * Show message when no achievements available
   */
  showNoAchievementsMessage() {
    const slider = document.getElementById('heroAchievementsSlider');
    if (!slider) return;
    
    slider.innerHTML = '<div class="slider-item">🎯 Be the first to earn an achievement!</div>';
  }

  /**
   * Load user-specific progress (if logged in)
   */
  async loadUserProgress() {
    try {
      // Check if user is logged in (from global session)
      if (!window.currentUser) {
        // Hide user progress section
        const progressSection = document.getElementById('heroUserProgress');
        if (progressSection) progressSection.style.display = 'none';
        return;
      }
      
      // User is logged in - fetch their progress
      const [streakData, leaderboardData] = await Promise.all([
        fetch('/api/gamification/streaks').then(r => r.ok ? r.json() : null),
        fetch('/api/gamification/leaderboard/position').then(r => r.ok ? r.json() : null),
      ]);
      
      // Update user progress display
      this.updateUserProgress(streakData, leaderboardData);
      
      // Show progress section
      const progressSection = document.getElementById('heroUserProgress');
      if (progressSection) progressSection.style.display = 'block';
      
    } catch (error) {
      console.error('❌ Error loading user progress:', error);
    }
  }

  /**
   * Update user progress display
   */
  updateUserProgress(streakData, leaderboardData) {
    // Update streak
    const streakEl = document.getElementById('heroUserStreak');
    if (streakEl && streakData && streakData.streaks && streakData.streaks.length > 0) {
      const dailyStreak = streakData.streaks.find(s => s.streakType === 'daily_rank');
      if (dailyStreak) {
        streakEl.textContent = `Streak: ${dailyStreak.currentStreak} day${dailyStreak.currentStreak !== 1 ? 's' : ''}`;
      } else {
        streakEl.textContent = 'Streak: Start your journey!';
      }
    }
    
    // Update rank
    const rankEl = document.getElementById('heroUserRank');
    if (rankEl && leaderboardData) {
      const position = leaderboardData.position || 'Unranked';
      rankEl.textContent = `Rank: #${position}`;
    }
    
    // Update next achievement (placeholder for now)
    const nextEl = document.getElementById('heroUserNext');
    if (nextEl) {
      nextEl.textContent = 'Next: View Progress →';
    }
  }

  /**
   * Setup CTA button click handlers
   */
  setupCTAs() {
    const startRankingBtn = document.getElementById('heroStartRankingBtn');
    const leaderboardBtn = document.getElementById('heroLeaderboardBtn');
    
    if (startRankingBtn) {
      startRankingBtn.addEventListener('click', () => {
        // Navigate to rank page
        window.location.hash = '#rank';
      });
    }
    
    if (leaderboardBtn) {
      leaderboardBtn.addEventListener('click', () => {
        // Navigate to community page
        window.location.hash = '#community';
      });
    }
  }

  /**
   * Setup WebSocket listeners for real-time updates
   */
  setupWebSocketListeners() {
    if (!window.socket) {
      console.warn('⚠️ WebSocket not available for hero dashboard');
      return;
    }
    
    // Listen for achievement updates
    window.socket.on('achievement:earned', (data) => {
      console.log('🏆 Achievement earned event received:', data);
      // Reload stats to get latest achievements
      this.loadStats();
    });
    
    // Listen for ranking updates
    window.socket.on('ranking:saved', () => {
      // Reload stats to get latest counts
      this.loadStats();
    });
  }

  /**
   * Get time ago string from timestamp
   */
  getTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    try {
      const now = new Date();
      const then = new Date(timestamp);
      const diffMs = now - then;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 4) return `${diffWeeks}w ago`;
      
      return new Date(then).toLocaleDateString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Cleanup - stop slider
   */
  destroy() {
    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
      this.sliderInterval = null;
    }
  }
}

// Initialize hero dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.heroDashboard = new HeroDashboard();
    window.heroDashboard.init();
  });
} else {
  window.heroDashboard = new HeroDashboard();
  window.heroDashboard.init();
}
