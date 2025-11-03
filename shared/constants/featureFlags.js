/**
 * Feature Flags
 * Centralized configuration for enabling/disabling application features
 */

const FEATURE_FLAGS = {
  /**
   * Auto-fill ranking gaps
   * 
   * When enabled: Rankings are automatically renumbered to be sequential (1, 2, 3...)
   *               Removing rank #2 from [1,2,3] results in [1,2]
   * 
   * When disabled: Rankings preserve their original positions with gaps allowed
   *                Removing rank #2 from [1,2,3] results in [1,3]
   * 
   * Default: false (gaps allowed)
   * Reason: We don't yet know how customers will handle rankings, so we're preserving
   *         their exact intent. This can easily be re-enabled in the future.
   */
  AUTO_FILL_RANKING_GAPS: false
};

module.exports = { FEATURE_FLAGS };
