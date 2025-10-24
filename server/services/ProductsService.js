const MetadataCache = require('../cache/MetadataCache');
const RankingStatsCache = require('../cache/RankingStatsCache');
const ProductsMetadataRepository = require('../repositories/ProductsMetadataRepository');
const ProductRankingRepository = require('../repositories/ProductRankingRepository');
const { sql } = require('drizzle-orm');

/**
 * Unified ProductsService - Central service for all product data
 * Combines Shopify products, metadata, and ranking stats into consistent data structure
 */
class ProductsService {
  constructor(db, fetchShopifyProducts, fetchProductsMetadata, metadataCache, rankingStatsCache) {
    this.db = db;
    this.fetchShopifyProducts = fetchShopifyProducts;
    this.fetchProductsMetadata = fetchProductsMetadata;
    
    // Use shared cache instances for consistency across the app
    this.metadataCache = metadataCache;
    this.rankingStatsCache = rankingStatsCache;
    
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
        this.metadataCache.invalidate();
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
    
    // 5. Apply search filter if query provided
    let filteredProducts = products;
    if (query && query.trim()) {
      filteredProducts = this._applySearchFilter(products, query);
      console.log(`🔍 Filtered to ${filteredProducts.length} products matching "${query}"`);
    }
    
    // 6. Transform products with all data merged
    const enrichedProducts = filteredProducts.map(product => 
      this._enrichProduct(product, rankingStats, metadataMap)
    );
    
    return enrichedProducts;
  }
  
  /**
   * Get ranking statistics for all products
   * Uses 30-minute cache for performance
   */
  async _getRankingStats() {
    // Check cache first
    const cached = this.rankingStatsCache.get();
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
      this.rankingStatsCache.set(rankingStats);
      
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
    const cached = this.metadataCache.get();
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
          flavorIcon: meta.flavorIcon
        };
      });
      
      // Store in cache
      this.metadataCache.set(metadataMap);
      
      return metadataMap;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return {};
    }
  }
  
  /**
   * Apply intelligent multi-word search filter
   */
  _applySearchFilter(products, query) {
    const searchTerm = query.trim().toLowerCase();
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    return products.filter(product => {
      // Only search in user-visible fields (not tags or internal metadata)
      const searchableText = [
        product.title,
        product.vendor,
        product.product_type
      ].join(' ').toLowerCase();
      
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
   * Get rankable products for a specific user (excludes already-ranked products)
   * This ensures users with many rankings always see unranked products
   * 
   * @param {number} userId - The user ID to get unranked products for
   * @param {object} options - Same options as getAllProducts plus rankingListId
   * @returns {Promise<Array>} Filtered products that user hasn't ranked yet
   */
  async getRankableProductsForUser(userId, options = {}) {
    const { rankingListId = 'topN', ...otherOptions } = options;
    
    // 1. Get all products with full enrichment
    const allProducts = await this.getAllProducts(otherOptions);
    
    // 2. Get user's ranked product IDs
    const rankedProductIds = await ProductRankingRepository.getRankedProductIdsByUser(userId, rankingListId);
    const rankedSet = new Set(rankedProductIds);
    
    // 3. Filter out already-ranked products BEFORE pagination
    const unrankedProducts = allProducts.filter(product => !rankedSet.has(product.id));
    
    console.log(`🎯 User ${userId}: ${allProducts.length} total products, ${rankedProductIds.length} ranked, ${unrankedProducts.length} available to rank`);
    
    return unrankedProducts;
  }
  
  /**
   * Invalidate ranking stats cache
   * Called when rankings are created/updated/deleted
   */
  invalidateRankingStatsCache() {
    this.rankingStatsCache.invalidate();
  }
  
  /**
   * Invalidate metadata cache
   * Called when metadata is synced
   */
  invalidateMetadataCache() {
    this.metadataCache.invalidate();
  }
}

module.exports = ProductsService;
