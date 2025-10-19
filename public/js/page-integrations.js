/**
 * Page Integrations - Wire up gamification widgets to pages
 */

(function() {
  'use strict';

  const eventBus = window.appEventBus;
  const services = window.appServices;

  let progressWidget = null;
  let leaderboardWidget = null;
  let fullLeaderboardWidget = null;

  function initializeCommunityPage() {
    const communityPage = document.getElementById('communityPage');
    if (!communityPage) return;

    const leaderboardContainer = document.getElementById('communityLeaderboard');
    if (!leaderboardContainer) {
      console.warn('⚠️ Community leaderboard container not found');
      return;
    }

    if (!leaderboardWidget) {
      const leaderboardService = services.get('leaderboard');
      leaderboardWidget = new LeaderboardWidget('communityLeaderboard', leaderboardService, eventBus);
      console.log('✅ Leaderboard widget integrated into Community page');
    }
  }

  function initializeLeaderboardPage() {
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (!leaderboardPage) return;

    const fullLeaderboardContainer = document.getElementById('fullLeaderboard');
    if (!fullLeaderboardContainer) {
      console.warn('⚠️ Full leaderboard container not found');
      return;
    }

    if (!fullLeaderboardWidget) {
      const leaderboardService = services.get('leaderboard');
      fullLeaderboardWidget = new FullLeaderboardWidget('fullLeaderboard', leaderboardService, eventBus);
      console.log('✅ Full leaderboard widget integrated into Leaderboard page');
    }
  }

  function initializeRankPage() {
    const rankPage = document.getElementById('rankPage');
    if (!rankPage) {
      console.warn('⚠️ Rank page not found, skipping progress widget initialization');
      return;
    }

    let progressContainer = document.getElementById('rankPageProgress');
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'rankPageProgress';
      progressContainer.style.marginBottom = '20px';
      
      const pageHeader = rankPage.querySelector('.page-header-minimal');
      if (pageHeader) {
        pageHeader.after(progressContainer);
        console.log('✅ Progress container inserted after page header');
      } else {
        // If no page header, insert at the top of rank page
        rankPage.insertBefore(progressContainer, rankPage.firstChild);
        console.log('⚠️ Progress container inserted at top of rank page (no header found)');
      }
    }

    if (!progressWidget) {
      const progressService = services.get('progressTracking');
      progressWidget = new ProgressWidget('rankPageProgress', progressService, eventBus);
      console.log('✅ Progress widget integrated into Rank page');
    }
    
    // Always reload progress, achievements and streaks when rank page is shown
    const gamificationService = services.get('gamification');
    const progressService = services.get('progressTracking');
    if (gamificationService) {
      gamificationService.loadAchievements();
      gamificationService.loadStreaks();
    }
    if (progressService) {
      progressService.loadProgress();
    }
    if (gamificationService || progressService) {
      console.log('🔄 Reloading achievements, streaks, and progress for rank page');
    }
  }

  eventBus.on('page:shown', (data) => {
    if (data.page === 'community') {
      initializeCommunityPage();
    } else if (data.page === 'leaderboard') {
      initializeLeaderboardPage();
    } else if (data.page === 'rank') {
      initializeRankPage();
    }
  });

  eventBus.on('user:authenticated', () => {
    const currentPage = sessionStorage.getItem('currentPage');
    if (currentPage === 'community') {
      initializeCommunityPage();
    } else if (currentPage === 'leaderboard') {
      initializeLeaderboardPage();
    } else if (currentPage === 'rank') {
      initializeRankPage();
    }
  });

  console.log('✅ Page integrations initialized');
})();
