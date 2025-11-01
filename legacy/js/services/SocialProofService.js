/**
 * SocialProofService - Frontend service for social proof features
 * Handles trending products, live activity indicators, view counts
 */
class SocialProofService extends BaseService {
  constructor(eventBus, socket) {
    super(eventBus);
    this.socket = socket;
    this.viewCounts = new Map();
    this.trendingProducts = [];
  }

  async initialize() {
    await super.initialize();
    this.setupSocketListeners();
    await this.loadTrendingProducts();
  }

  setupSocketListeners() {
    this.socket.on('product:viewed', (data) => {
      this.updateViewCount(data.productId, data.viewCount);
      this.emit('product:view-updated', data);
    });

    this.socket.on('product:view-count', (data) => {
      this.updateViewCount(data.productId, data.viewCount);
    });
  }

  async logProductView(productId) {
    try {
      const response = await this.apiRequest('/api/gamification/product-view', {
        method: 'POST',
        body: JSON.stringify({ productId })
      });
      
      if (response.viewCount) {
        this.updateViewCount(productId, response.viewCount);
      }
    } catch (error) {
      console.error('Failed to log product view:', error);
    }
  }

  async loadTrendingProducts(hours = 24, limit = 10) {
    try {
      const response = await this.apiRequest(
        `/api/gamification/trending-products?hours=${hours}&limit=${limit}`
      );
      
      this.trendingProducts = response.trending || [];
      this.emit('trending:updated', this.trendingProducts);
      return this.trendingProducts;
    } catch (error) {
      console.error('Failed to load trending products:', error);
      return [];
    }
  }

  updateViewCount(productId, count) {
    this.viewCounts.set(productId, count);
    this.checkIfTrending(productId, count);
  }

  getViewCount(productId) {
    return this.viewCounts.get(productId) || 0;
  }

  isTrending(productId) {
    return this.trendingProducts.some(p => p.shopifyProductId === productId);
  }

  checkIfTrending(productId, viewCount) {
    if (viewCount >= 20) {
      this.emit('product:trending', { productId, viewCount });
    }
  }

  getTrendingBadgeData(productId) {
    const trending = this.trendingProducts.find(p => p.shopifyProductId === productId);
    if (trending) {
      return {
        isTrending: true,
        viewCount: trending.viewCount,
        rank: this.trendingProducts.indexOf(trending) + 1
      };
    }
    return { isTrending: false };
  }
}

window.SocialProofService = SocialProofService;
