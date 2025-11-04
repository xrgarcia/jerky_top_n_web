/**
 * Feature Flags (CommonJS wrapper)
 * Single source of truth: featureFlags.json
 * 
 * AUTO_FILL_RANKING_GAPS:
 *   When enabled: Rankings are automatically renumbered to be sequential (1, 2, 3...)
 *                 Removing rank #2 from [1,2,3] results in [1,2]
 *   When disabled: Rankings preserve their original positions with gaps allowed
 *                  Removing rank #2 from [1,2,3] results in [1,3]
 *   Default: false (gaps allowed)
 *   Reason: We don't yet know how customers will handle rankings, so we're preserving
 *           their exact intent. This can easily be re-enabled in the future.
 * 
 * ALLOW_INSERT_TO_PUSH_DOWN_RANKINGS:
 *   When enabled: Dropping a product onto an occupied ranking position pushes existing
 *                 items down until finding an empty slot or reaching the end of the list
 *                 Example: Drop onto #5 (occupied) → #5→#6, #6→#7, #7→#8 until gap found
 *   When disabled: Dropping onto occupied position replaces/swaps with existing item
 *   Default: true (push-down behavior enabled)
 *   Reason: More intuitive insertion behavior that respects user's ranking structure
 */

const FEATURE_FLAGS = require('./featureFlags.json');

module.exports = { FEATURE_FLAGS };
