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
    
    // Guard flag: prevents infinite refresh loop for missing metadata dates
    // Only triggers ONE force refresh per server lifecycle
    this._hasRefreshedForMissingDates = false;
  }
  
  /**
   * Get all products with complete data (Shopify + metadata + rankings)
   * This is the single source of truth for product data
   * 
   * Includes conditional cache invalidation: If products came from cache but
   * metadata is missing shopifyCreatedAt dates, triggers ONE force refresh
   * per server lifecycle to populate those dates.
   */
  async getAllProducts(options = {}) {
    const { query = '', includeMetadata = true, includeRankingStats = true } = options;
    
    // 1. Fetch Shopify products (returns { products, fromCache })
    let { products, fromCache } = await this.fetchShopifyProducts();
    
    // 2. Sync metadata if products are fresh (not from cache)
    if (!fromCache && products.length > 0 && includeMetadata) {
      try {
        await this.fetchProductsMetadata(products);
        console.log(`🏷️ Synced metadata for ${products.length} fresh products`);
        
        // Invalidate metadata cache to force refresh
        await this.metadataCache.invalidate();
        
        // Mark that we've refreshed, so we don't trigger again
        this._hasRefreshedForMissingDates = true;
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
    
    // 4. Get metadata (check completeness if we might need to force refresh)
    let metadataMap = {};
    if (includeMetadata) {
      // Check for missing dates if: (a) products came from cache, (b) we haven't already refreshed
      const shouldCheckCompleteness = fromCache && !this._hasRefreshedForMissingDates;
      
      if (shouldCheckCompleteness) {
        const result = await this._getMetadata({ checkCompleteness: true });
        
        // If missing dates detected, force a Shopify refresh (ONE TIME ONLY)
        if (result.hasMissingDates && result.missingCount > 0) {
          console.log(`🔄 Detected ${result.missingCount} products missing shopifyCreatedAt - forcing Shopify refresh`);
          
          // Set guard flag BEFORE refresh to prevent infinite loop
          this._hasRefreshedForMissingDates = true;
          
          // Force refresh from Shopify
          const refreshResult = await this.fetchShopifyProducts({ forceRefresh: true });
          products = refreshResult.products;
          fromCache = refreshResult.fromCache;
          
          // Sync metadata with fresh products
          if (products.length > 0) {
            try {
              await this.fetchProductsMetadata(products);
              console.log(`🏷️ Synced metadata for ${products.length} products after force refresh`);
              
              // Invalidate metadata cache to pick up new dates
              await this.metadataCache.invalidate();
            } catch (error) {
              console.error('Error syncing metadata after force refresh:', error);
            }
          }
          
          // Re-fetch metadata after sync
          metadataMap = await this._getMetadata();
        } else {
          // No missing dates, use the cached metadata
          metadataMap = result.metadataMap;
        }
      } else {
        // Normal path: just get metadata without completeness check
        metadataMap = await this._getMetadata();
      }
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
          MAX(created_at) as last_ranked_at,
          COUNT(CASE WHEN ranking = 1 THEN 1 END) as count_1st,
          COUNT(CASE WHEN ranking = 2 THEN 1 END) as count_2nd,
          COUNT(CASE WHEN ranking = 3 THEN 1 END) as count_3rd
        FROM product_rankings
        GROUP BY shopify_product_id
      `);
      
      const rankingStats = {};
      results.rows.forEach(row => {
        const totalCount = parseInt(row.count);
        const count1st = parseInt(row.count_1st) || 0;
        const count2nd = parseInt(row.count_2nd) || 0;
        const count3rd = parseInt(row.count_3rd) || 0;
        
        rankingStats[row.shopify_product_id] = {
          count: totalCount,
          uniqueRankers: parseInt(row.unique_rankers),
          avgRank: row.avg_rank ? parseFloat(row.avg_rank) : null,
          bestRank: row.best_rank ? parseInt(row.best_rank) : null,
          worstRank: row.worst_rank ? parseInt(row.worst_rank) : null,
          lastRankedAt: row.last_ranked_at,
          // Ranking distribution for Flavor Index leaderboard
          distribution: {
            count1st,
            count2nd,
            count3rd,
            pct1st: totalCount > 0 ? (count1st / totalCount) * 100 : 0,
            pct2nd: totalCount > 0 ? (count2nd / totalCount) * 100 : 0,
            pct3rd: totalCount > 0 ? (count3rd / totalCount) * 100 : 0
          }
        };
      });
      
      console.log(`📊 Found ranking stats for ${Object.keys(rankingStats).length} products WITH distribution data`);
      
      // Log sample distribution to verify it exists
      const sampleId = Object.keys(rankingStats)[0];
      if (sampleId) {
        console.log(`📊 Sample distribution for product ${sampleId}:`, rankingStats[sampleId].distribution);
      }
      
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
   * @param {Object} options - Options for metadata retrieval
   * @param {boolean} options.checkCompleteness - If true, returns { metadataMap, hasMissingDates } 
   * @returns {Object|{metadataMap: Object, hasMissingDates: boolean}} Metadata map or object with completeness info
   */
  async _getMetadata(options = {}) {
    const { checkCompleteness = false } = options;
    
    // Check cache first
    const cached = await this.metadataCache.get();
    if (cached) {
      if (checkCompleteness) {
        // Count products with missing shopifyCreatedAt
        const missingCount = Object.values(cached).filter(m => !m.shopifyCreatedAt).length;
        return { metadataMap: cached, hasMissingDates: missingCount > 0, missingCount };
      }
      return cached;
    }
    
    // Fetch fresh metadata from database
    try {
      const allMetadata = await this.metadataRepo.getAllMetadata();
      
      const metadataMap = {};
      let missingCount = 0;
      
      allMetadata.forEach(meta => {
        const hasDate = !!meta.shopifyCreatedAt;
        if (!hasDate) missingCount++;
        
        metadataMap[meta.shopifyProductId] = {
          animalType: meta.animalType,
          animalDisplay: meta.animalDisplay,
          animalIcon: meta.animalIcon,
          primaryFlavor: meta.primaryFlavor,
          secondaryFlavors: meta.secondaryFlavors ? JSON.parse(meta.secondaryFlavors) : [],
          flavorDisplay: meta.flavorDisplay,
          flavorIcon: meta.flavorIcon,
          forceRankable: meta.forceRankable || false,
          shopifyCreatedAt: meta.shopifyCreatedAt
        };
      });
      
      // Store in cache
      await this.metadataCache.set(metadataMap);
      
      if (checkCompleteness) {
        return { metadataMap, hasMissingDates: missingCount > 0, missingCount };
      }
      return metadataMap;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      if (checkCompleteness) {
        return { metadataMap: {}, hasMissingDates: false, missingCount: 0 };
      }
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
      lastRankedAt: null,
      distribution: {
        count1st: 0,
        count2nd: 0,
        count3rd: 0,
        pct1st: 0,
        pct2nd: 0,
        pct3rd: 0
      }
    };
    
    // Get metadata or default values
    const metadata = metadataMap[productId] || { 
      animalType: null, 
      animalDisplay: null, 
      animalIcon: null,
      primaryFlavor: null,
      secondaryFlavors: [],
      flavorDisplay: null,
      flavorIcon: null,
      shopifyCreatedAt: null
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
      distribution: stats.distribution,
      animalType: metadata.animalType,
      animalDisplay: metadata.animalDisplay,
      animalIcon: metadata.animalIcon,
      primaryFlavor: metadata.primaryFlavor,
      secondaryFlavors: metadata.secondaryFlavors,
      flavorDisplay: metadata.flavorDisplay,
      flavorIcon: metadata.flavorIcon,
      shopifyCreatedAt: metadata.shopifyCreatedAt
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
   * Calculate community rank positions for products (#1, #2, #3, etc.)
   * Sorted by avgRank (lower is better), with products that have no rankings at the end
   * @param {Array} products - Products to rank
   * @returns {Array} Products with communityRank field added
   */
  _calculateCommunityRanks(products) {
    // Separate products with rankings from products without rankings
    const productsWithRankings = products.filter(p => p.avgRank !== null && p.rankingCount > 0);
    const productsWithoutRankings = products.filter(p => p.avgRank === null || p.rankingCount === 0);
    
    // Sort products with rankings by avgRank (lower is better)
    const sorted = productsWithRankings.sort((a, b) => {
      if (a.avgRank === null) return 1;
      if (b.avgRank === null) return -1;
      return a.avgRank - b.avgRank;
    });
    
    // Assign community rank positions
    const rankedProducts = sorted.map((product, index) => ({
      ...product,
      communityRank: index + 1
    }));
    
    // Add unranked products at the end without a community rank
    const allProducts = [...rankedProducts, ...productsWithoutRankings.map(p => ({ ...p, communityRank: null }))];
    
    console.log(`🏆 Assigned community ranks to ${rankedProducts.length} products with rankings`);
    return allProducts;
  }
  
  /**
   * Get top-ranked product for each animal category
   * @param {Array} products - Products with community ranks
   * @returns {Object} Map of animalType -> top product
   */
  _getTopByCategory(products) {
    const topByCategory = {};
    
    // Only consider products with rankings
    const rankedProducts = products.filter(p => p.avgRank !== null && p.rankingCount > 0 && p.animalType);
    
    // Group by animalType and find the product with lowest avgRank (best)
    rankedProducts.forEach(product => {
      const category = product.animalType;
      if (!topByCategory[category] || product.avgRank < topByCategory[category].avgRank) {
        topByCategory[category] = product;
      }
    });
    
    console.log(`📊 Found top products for ${Object.keys(topByCategory).length} categories:`, Object.keys(topByCategory).join(', '));
    return topByCategory;
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
