/**
 * Page Integrations - Wire up gamification widgets to pages
 */

(function() {
  'use strict';

  const eventBus = window.appEventBus;
  const services = window.appServices;

  let progressWidget = null;
  let leaderboardWidget = null;

  function initializeCommunityPage() {
    const communityPage = document.getElementById('communityPage');
    if (!communityPage) return;

    let leaderboardContainer = document.getElementById('communityLeaderboard');
    if (!leaderboardContainer) {
      leaderboardContainer = document.createElement('div');
      leaderboardContainer.id = 'communityLeaderboard';
      leaderboardContainer.style.marginBottom = '30px';
      
      const communityList = document.getElementById('communityList');
      if (communityList) {
        communityList.parentNode.insertBefore(leaderboardContainer, communityList);
      }
    }

    if (!leaderboardWidget) {
      const leaderboardService = services.get('leaderboard');
      leaderboardWidget = new LeaderboardWidget('communityLeaderboard', leaderboardService, eventBus);
      console.log('✅ Leaderboard widget integrated into Community page');
    }
  }

  function initializeRankPage() {
    const rankPage = document.getElementById('rankPage');
    if (!rankPage) return;

    let progressContainer = document.getElementById('rankPageProgress');
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'rankPageProgress';
      progressContainer.style.marginBottom = '20px';
      
      const pageHeader = rankPage.querySelector('.page-header');
      if (pageHeader) {
        pageHeader.after(progressContainer);
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
    } else if (data.page === 'rank') {
      initializeRankPage();
    }
  });

  eventBus.on('user:authenticated', () => {
    const currentPage = sessionStorage.getItem('currentPage');
    if (currentPage === 'community') {
      initializeCommunityPage();
    } else if (currentPage === 'rank') {
      initializeRankPage();
    }
  });

  console.log('✅ Page integrations initialized');
})();
