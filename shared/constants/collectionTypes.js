/**
 * Achievement Collection Type Constants
 * 
 * Centralized definitions for collection types to avoid magic strings
 * and ensure consistency across the codebase.
 */

const COLLECTION_TYPES = {
  // Engagement Collections: Achievements based on user site engagement
  // (searches, logins, ranking activity, streaks)
  ENGAGEMENT: 'engagement_collection',
  
  // Dynamic Collections: Protein-category-based with tier progression
  // (e.g., Cattle Connoisseur with bronze/silver/gold tiers)
  DYNAMIC: 'dynamic_collection',
  
  // Custom Product Lists: Pre-defined product sets with tier progression
  // (e.g., specific flavor collections)
  CUSTOM_PRODUCT_LIST: 'custom_product_list',
  
  // Flavor Coins: Single product achievements
  // (can be all-or-nothing or have tier progression)
  FLAVOR_COIN: 'flavor_coin',
  
  // Hidden Collections: Secret achievements unlocked through discovery
  HIDDEN: 'hidden_collection',
  
  // Legacy: Old achievement system (backward compatibility)
  LEGACY: 'legacy'
};

/**
 * Human-readable labels for collection types
 */
const COLLECTION_TYPE_LABELS = {
  [COLLECTION_TYPES.ENGAGEMENT]: 'Engagement',
  [COLLECTION_TYPES.DYNAMIC]: 'Dynamic',
  [COLLECTION_TYPES.CUSTOM_PRODUCT_LIST]: 'Custom List',
  [COLLECTION_TYPES.FLAVOR_COIN]: 'Flavor Coin',
  [COLLECTION_TYPES.HIDDEN]: 'Hidden',
  [COLLECTION_TYPES.LEGACY]: 'Legacy'
};

/**
 * API route filters (backward compatibility mapping)
 */
const API_ROUTE_FILTERS = {
  engagement: COLLECTION_TYPES.ENGAGEMENT,
  dynamic: COLLECTION_TYPES.DYNAMIC,
  hidden: COLLECTION_TYPES.HIDDEN,
  // Legacy support
  static: COLLECTION_TYPES.ENGAGEMENT
};

module.exports = {
  COLLECTION_TYPES,
  COLLECTION_TYPE_LABELS,
  API_ROUTE_FILTERS
};
