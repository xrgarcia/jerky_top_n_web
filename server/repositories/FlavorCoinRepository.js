const { eq, and } = require('drizzle-orm');
const { flavorCoins } = require('../../shared/schema');

class FlavorCoinRepository {
  constructor(db) {
    this.db = db;
  }

  async getUserFlavorCoins(userId) {
    return await this.db.select()
      .from(flavorCoins)
      .where(eq(flavorCoins.userId, userId))
      .orderBy(flavorCoins.earnedAt);
  }

  async hasFlavorCoin(userId, flavorType) {
    const result = await this.db.select()
      .from(flavorCoins)
      .where(and(
        eq(flavorCoins.userId, userId),
        eq(flavorCoins.flavorType, flavorType)
      ))
      .limit(1);
    return result.length > 0;
  }

  async awardFlavorCoin(userId, flavorType, flavorDisplay, flavorIcon, shopifyProductId) {
    const result = await this.db.insert(flavorCoins)
      .values({
        userId,
        flavorType,
        flavorDisplay,
        flavorIcon,
        shopifyProductId,
      })
      .returning();
    return result[0];
  }

  async getFlavorCoinCount(userId) {
    const coins = await this.getUserFlavorCoins(userId);
    return coins.length;
  }

  async getAllUniqueFlavorTypes() {
    const result = await this.db.selectDistinct({
      flavorType: flavorCoins.flavorType,
      flavorDisplay: flavorCoins.flavorDisplay,
      flavorIcon: flavorCoins.flavorIcon,
    }).from(flavorCoins);
    return result;
  }
}

module.exports = FlavorCoinRepository;
