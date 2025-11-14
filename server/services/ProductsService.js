const MetadataCache = require('../cache/MetadataCache');
const RankingStatsCache = require('../cache/RankingStatsCache');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const ProductRankingRepository = require('../repositories/ProductRankingRepository');
const PurchaseHistoryService = require('./PurchaseHistoryService');
const { sql } = require('drizzle-orm');

/**
 * Unified ProductsService - Central service for all product data
 * Combines Shopify products, metadata, and ranking stats into consistent data structure
 */
class ProductsService {
  constructor(db, fetchShopifyProducts, fetchProductsMetadata, metadataCache, rankingStatsCache, purchaseHistoryService = null) {
    this.db = db;
    this.fetchShopifyProducts = fetchShopifyProducts;
    this.fetchProductsMetadata = fetchProductsMetadata;
    
    // Use shared cache instances for consistency across the app
    this.metadataCache = metadataCache;
    this.rankingStatsCache = rankingStatsCache;
    
    // Shared purchase history service (optional, for purchase-based filtering)
    this.purchaseHistoryService = purchaseHistoryService;
    
    // Repository for metadata operations
    this.metadataRepo = new ProductsMetadataRepository(db);
  }
  
  /**
   * Get all products with complete data (Shopify + metadata + rankings)
   * This is the single source of truth for product data
   */
  async getAllProducts(options = {}) {
    const { query = '', includeMetadata = true, includeRankingStats = true } = options;
    
    // 1. Fetch Shopify products (returns { products, fromCache })
    const { products, fromCache } = await this.fetchShopifyProducts();
    
    // 2. Sync metadata if products are fresh (not from cache)
    if (!fromCache && products.length > 0 && includeMetadata) {
      try {
        await this.fetchProductsMetadata(products);
        console.log(`🏷️ Synced metadata for ${products.length} fresh products`);
        
        // Invalidate metadata cache to force refresh
        await this.metadataCache.invalidate();
      } catch (error) {
        console.error('Error syncing metadata:', error);
        // Continue without metadata - non-critical
      }
    }
    
    // 3. Get ranking stats (with 30-min cache)
    let rankingStats = {};
    if (includeRankingStats) {
      rankingStats = await this._getRankingStats();
    }
    
    // 4. Get metadata (with 30-min cache)
    let metadataMap = {};
    if (includeMetadata) {
      metadataMap = await this._getMetadata();
    }
    
    // 5. Transform products with all data merged FIRST (so we can search on metadata)
    const enrichedProducts = products.map(product => 
      this._enrichProduct(product, rankingStats, metadataMap)
    );
    
    // 6. Apply search filter on enriched products (includes metadata fields)
    let filteredProducts = enrichedProducts;
    if (query && query.trim()) {
      filteredProducts = this._applySearchFilter(enrichedProducts, query);
      console.log(`🔍 Filtered to ${filteredProducts.length} products matching "${query}"`);
    }
    
    return filteredProducts;
  }
  
  /**
   * Get specific products by their Shopify IDs with complete data
   * Leverages existing cache and enrichment logic for consistency
   * 
   * @param {Array<string>} productIds - Array of Shopify product IDs
   * @param {Object} options - Options for metadata and ranking stats inclusion
   * @returns {Promise<Array>} Enriched products matching the requested IDs
   */
  async getProductsByIds(productIds, options = {}) {
    const { includeMetadata = true, includeRankingStats = true } = options;
    
    // Guard against empty/invalid input
    if (!productIds || productIds.length === 0) {
      return [];
    }
    
    // 1. Fetch all products from Shopify cache
    const { products } = await this.fetchShopifyProducts();
    
    // 2. Get ranking stats (with 30-min cache)
    let rankingStats = {};
    if (includeRankingStats) {
      rankingStats = await this._getRankingStats();
    }
    
    // 3. Get metadata (with 30-min cache)
    let metadataMap = {};
    if (includeMetadata) {
      metadataMap = await this._getMetadata();
    }
    
    // 4. Create a Set for O(1) lookup
    const requestedIds = new Set(productIds.map(id => id.toString()));
    
    // 5. Filter to requested products and enrich them
    const matchedProducts = products
      .filter(product => requestedIds.has(product.id.toString()))
      .map(product => this._enrichProduct(product, rankingStats, metadataMap));
    
    console.log(`🎯 Found ${matchedProducts.length}/${productIds.length} products by IDs`);
    
    return matchedProducts;
  }
  
  /**
   * Get ranking statistics for all products
   * Uses 30-minute cache for performance
   */
  async _getRankingStats() {
    // Check cache first
    const cached = await this.rankingStatsCache.get();
    if (cached) {
      return cached;
    }
    
    // Fetch fresh stats from database
    try {
      const results = await this.db.execute(sql`
        SELECT 
          shopify_product_id,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_rankers,
          AVG(ranking) as avg_rank,
          MIN(ranking) as best_rank,
          MAX(ranking) as worst_rank,
          MAX(created_at) as last_ranked_at
        FROM product_rankings
        GROUP BY shopify_product_id
      `);
      
      const rankingStats = {};
      results.rows.forEach(row => {
        rankingStats[row.shopify_product_id] = {
          count: parseInt(row.count),
          uniqueRankers: parseInt(row.unique_rankers),
          avgRank: row.avg_rank ? parseFloat(row.avg_rank) : null,
          bestRank: row.best_rank ? parseInt(row.best_rank) : null,
          worstRank: row.worst_rank ? parseInt(row.worst_rank) : null,
          lastRankedAt: row.last_ranked_at
        };
      });
      
      console.log(`📊 Found ranking stats for ${Object.keys(rankingStats).length} products`);
      
      // Store in cache
      await this.rankingStatsCache.set(rankingStats);
      
      return rankingStats;
    } catch (error) {
      console.error('Error fetching ranking stats:', error);
      return {};
    }
  }
  
  /**
   * Get metadata for all products
   * Uses 30-minute cache for performance
   */
  async _getMetadata() {
    // Check cache first
    const cached = await this.metadataCache.get();
    if (cached) {
      return cached;
    }
    
    // Fetch fresh metadata from database
    try {
      const allMetadata = await this.metadataRepo.getAllMetadata();
      
      const metadataMap = {};
      allMetadata.forEach(meta => {
        metadataMap[meta.shopifyProductId] = {
          animalType: meta.animalType,
          animalDisplay: meta.animalDisplay,
          animalIcon: meta.animalIcon,
          primaryFlavor: meta.primaryFlavor,
          secondaryFlavors: meta.secondaryFlavors ? JSON.parse(meta.secondaryFlavors) : [],
          flavorDisplay: meta.flavorDisplay,
          flavorIcon: meta.flavorIcon,
          forceRankable: meta.forceRankable || false
        };
      });
      
      // Store in cache
      await this.metadataCache.set(metadataMap);
      
      return metadataMap;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return {};
    }
  }
  
  /**
   * Apply intelligent multi-word search filter
   * Searches user-visible fields including metadata (animal type, flavor)
   * NOTE: This operates on enriched products, so use camelCase field names
   */
  _applySearchFilter(products, query) {
    const searchTerm = query.trim().toLowerCase();
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    return products.filter(product => {
      // Search in user-visible fields including metadata
      const searchableText = [
        product.title,
        product.vendor,
        product.productType,      // Enriched field (was product_type)
        product.animalType,       // e.g., "cattle", "poultry", "exotic"
        product.animalDisplay,    // e.g., "Beef", "Chicken", "Alligator"
        product.primaryFlavor,    // e.g., "spicy", "sweet", "savory"
        product.flavorDisplay     // e.g., "Spicy", "Sweet & Spicy"
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchWords.every(word => searchableText.includes(word));
    });
  }
  
  /**
   * Enrich a single product with metadata and ranking stats
   * This ensures EVERY product has the complete data structure
   */
  _enrichProduct(product, rankingStats, metadataMap) {
    const productId = product.id.toString();
    
    // Get stats or default values
    const stats = rankingStats[productId] || { 
      count: 0,
      uniqueRankers: 0,
      avgRank: null,
      bestRank: null,
      worstRank: null,
      lastRankedAt: null 
    };
    
    // Get metadata or default values
    const metadata = metadataMap[productId] || { 
      animalType: null, 
      animalDisplay: null, 
      animalIcon: null,
      primaryFlavor: null,
      secondaryFlavors: [],
      flavorDisplay: null,
      flavorIcon: null
    };
    
    return {
      id: productId,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      bodyHtml: product.body_html || null,
      image: product.images?.[0]?.src || null,
      price: product.variants?.[0]?.price || '0.00',
      compareAtPrice: product.variants?.[0]?.compare_at_price || null,
      rankingCount: stats.count,
      uniqueRankers: stats.uniqueRankers,
      avgRank: stats.avgRank,
      bestRank: stats.bestRank,
      worstRank: stats.worstRank,
      lastRankedAt: stats.lastRankedAt,
      animalType: metadata.animalType,
      animalDisplay: metadata.animalDisplay,
      animalIcon: metadata.animalIcon,
      primaryFlavor: metadata.primaryFlavor,
      secondaryFlavors: metadata.secondaryFlavors,
      flavorDisplay: metadata.flavorDisplay,
      flavorIcon: metadata.flavorIcon
    };
  }
  
  /**
   * Get rankable products for a specific user (excludes already-ranked products AND non-purchased products)
   * This ensures users with many rankings always see unranked products
   * Beta feature: Products with force_rankable=true are available to all users
   * Employees (@jerky.com) can rank all products; regular users see purchased products + beta products
   * 
   * @param {number} userId - The user ID to get unranked products for
   * @param {object} options - Same options as getAllProducts plus rankingListId and user
   * @returns {Promise<Array>} Filtered products that user hasn't ranked yet and has purchased (or force-rankable)
   */
  async getRankableProductsForUser(userId, options = {}) {
    const { rankingListId = 'topN', user = null, ...otherOptions } = options;
    
    // 1. Get all products with full enrichment (includes metadata with forceRankable flag)
    const allProducts = await this.getAllProducts(otherOptions);
    
    // 2. Get user's ranked product IDs
    const rankedProductIds = await ProductRankingRepository.getRankedProductIdsByUser(userId, rankingListId);
    const rankedSet = new Set(rankedProductIds);
    
    // 3. Filter out already-ranked products
    let unrankedProducts = allProducts.filter(product => !rankedSet.has(product.id));
    
    // 4. Apply purchase history filter for non-employee users (with beta product override)
    const isEmployee = user?.role === 'employee_admin' || user?.email?.endsWith('@jerky.com');
    
    if (!isEmployee && this.purchaseHistoryService) {
      // Regular users: filter to purchased products OR force-rankable products (beta)
      const purchasedProductIds = await this.purchaseHistoryService.getPurchasedProductIds(userId);
      const purchasedSet = new Set(purchasedProductIds);
      
      // Get metadata to check force_rankable flag
      const metadataMap = await this._getMetadata();
      
      // Filter to products that are: (unranked AND purchased) OR (unranked AND force-rankable)
      const availableProducts = unrankedProducts.filter(product => {
        const isPurchased = purchasedSet.has(product.id);
        const isForceRankable = metadataMap[product.id]?.forceRankable === true;
        return isPurchased || isForceRankable;
      });
      
      const betaCount = availableProducts.filter(p => metadataMap[p.id]?.forceRankable === true && !purchasedSet.has(p.id)).length;
      const logSuffix = betaCount > 0 ? ` (including ${betaCount} beta products)` : '';
      
      console.log(`🎯 User ${userId}: ${allProducts.length} total, ${rankedProductIds.length} ranked, ${purchasedProductIds.length} purchased, ${availableProducts.length} available to rank${logSuffix}`);
      
      return availableProducts;
    } else {
      // Employees OR service not configured: can rank all unranked products
      const reason = isEmployee ? '(employee - unrestricted)' : '(purchase history service not configured)';
      console.log(`🎯 User ${userId}: ${allProducts.length} total, ${rankedProductIds.length} ranked, ${unrankedProducts.length} available to rank ${reason}`);
      return unrankedProducts;
    }
  }
  
  /**
   * Invalidate ranking stats cache
   * Called when rankings are created/updated/deleted
   */
  async invalidateRankingStatsCache() {
    await this.rankingStatsCache.invalidate();
  }
  
  /**
   * Invalidate metadata cache
   * Called when metadata is synced
   */
  async invalidateMetadataCache() {
    await this.metadataCache.invalidate();
  }
}

module.exports = ProductsService;
