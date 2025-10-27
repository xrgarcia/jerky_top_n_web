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
  
  // Static Collections: Pre-defined product lists
  // (e.g., specific flavor collections, curated product sets)
  STATIC: 'static_collection',
  
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
  [COLLECTION_TYPES.ENGAGEMENT]: 'Engagement Coin',
  [COLLECTION_TYPES.DYNAMIC]: 'Dynamic Collection Coin',
  [COLLECTION_TYPES.STATIC]: 'Static Collection Coin',
  [COLLECTION_TYPES.FLAVOR_COIN]: 'Flavor Coin',
  [COLLECTION_TYPES.HIDDEN]: 'Hidden Collection Coin',
  [COLLECTION_TYPES.LEGACY]: 'Legacy'
};

/**
 * API route filters (backward compatibility mapping)
 */
const API_ROUTE_FILTERS = {
  engagement: COLLECTION_TYPES.ENGAGEMENT,
  dynamic: COLLECTION_TYPES.DYNAMIC,
  static: COLLECTION_TYPES.STATIC,
  hidden: COLLECTION_TYPES.HIDDEN,
  // Legacy support for old naming
  custom: COLLECTION_TYPES.STATIC  // custom_product_list → static_collection
};

module.exports = {
  COLLECTION_TYPES,
  COLLECTION_TYPE_LABELS,
  API_ROUTE_FILTERS
};
