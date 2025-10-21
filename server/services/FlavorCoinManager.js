const FlavorCoinRepository = require('../repositories/FlavorCoinRepository');

class FlavorCoinManager {
  constructor(flavorCoinRepo, productsMetadataRepo, activityLogRepo) {
    this.flavorCoinRepo = flavorCoinRepo;
    this.productsMetadataRepo = productsMetadataRepo;
    this.activityLogRepo = activityLogRepo;
  }

  async checkAndAwardFlavorCoins(userId, shopifyProductId) {
    const metadata = await this.productsMetadataRepo.getByShopifyProductId(shopifyProductId);
    
    if (!metadata) {
      console.log(`No metadata found for product ${shopifyProductId}`);
      return [];
    }

    const newCoins = [];
    const flavorsToCheck = [];

    if (metadata.primaryFlavor) {
      flavorsToCheck.push({
        type: metadata.primaryFlavor,
        display: metadata.flavorDisplay || metadata.primaryFlavor,
        icon: metadata.flavorIcon || '🍖'
      });
    }

    if (metadata.secondaryFlavors) {
      try {
        const secondaryFlavors = JSON.parse(metadata.secondaryFlavors);
        secondaryFlavors.forEach(flavor => {
          if (flavor && typeof flavor === 'string') {
            flavorsToCheck.push({
              type: flavor,
              display: flavor.charAt(0).toUpperCase() + flavor.slice(1),
              icon: '🍖'
            });
          }
        });
      } catch (error) {
        console.error('Error parsing secondary flavors:', error);
      }
    }

    for (const flavor of flavorsToCheck) {
      const hasCoin = await this.flavorCoinRepo.hasFlavorCoin(userId, flavor.type);
      
      if (!hasCoin) {
        const coin = await this.flavorCoinRepo.awardFlavorCoin(
          userId,
          flavor.type,
          flavor.display,
          flavor.icon,
          shopifyProductId
        );
        
        newCoins.push(coin);

        await this.activityLogRepo.logActivity(
          userId,
          'earn_flavor_coin',
          {
            flavorType: flavor.type,
            flavorDisplay: flavor.display,
            flavorIcon: flavor.icon,
            shopifyProductId,
          },
          1
        );
        
        console.log(`🪙 Awarded ${flavor.display} Flavor Coin to user ${userId}`);
      }
    }

    return newCoins;
  }

  async getUserFlavorCoins(userId) {
    return await this.flavorCoinRepo.getUserFlavorCoins(userId);
  }

  async getFlavorCoinStats(userId) {
    const coins = await this.getUserFlavorCoins(userId);
    
    const allProductsMetadata = await this.productsMetadataRepo.getAllMetadata();
    const uniqueFlavorTypes = new Set();
    
    for (const metadata of allProductsMetadata) {
      if (metadata.primaryFlavor) {
        uniqueFlavorTypes.add(metadata.primaryFlavor);
      }
      if (metadata.secondaryFlavors) {
        try {
          const secondaryFlavors = JSON.parse(metadata.secondaryFlavors);
          secondaryFlavors.forEach(flavor => uniqueFlavorTypes.add(flavor));
        } catch (error) {
        }
      }
    }
    
    const totalPossibleCoins = uniqueFlavorTypes.size;
    
    return {
      totalCoins: coins.length,
      totalPossibleCoins,
      percentageComplete: totalPossibleCoins > 0 
        ? Math.round((coins.length / totalPossibleCoins) * 100) 
        : 0,
      coins: coins,
    };
  }
}

module.exports = FlavorCoinManager;
