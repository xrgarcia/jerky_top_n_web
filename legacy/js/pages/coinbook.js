/**
 * Coin Book Page - Now uses ProgressWidget for display
 * ProgressWidget handles all rendering through page-integrations.js
 */

/**
 * Initialize Coin Book page
 * Note: The ProgressWidget is now initialized in page-integrations.js
 * This function is kept for compatibility with the router
 */
window.initCoinbookPage = async function() {
  console.log('🏆 Coin Book page initialized (ProgressWidget handles rendering)');
};

/**
 * Navigate to achievement detail page
 */
window.navigateToAchievementDetail = function(achievementCode) {
  window.location.hash = `#coins/${achievementCode}`;
};
