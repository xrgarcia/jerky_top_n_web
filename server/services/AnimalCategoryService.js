const { db } = require('../db');
const { productsMetadata } = require('../../shared/schema');
const { sql } = require('drizzle-orm');

/**
 * Service for managing animal categories dynamically from product metadata.
 * Follows OOP principles with encapsulation and single responsibility.
 */
class AnimalCategoryService {
  /**
   * Fetches all unique animals from the products_metadata table.
   * Returns an array of animal objects with display name, icon, and type.
   * 
   * @returns {Promise<Array<{type: string, display: string, icon: string}>>}
   */
  async getAllUniqueAnimals() {
    try {
      const result = await db
        .select({
          type: productsMetadata.animalType,
          display: productsMetadata.animalDisplay,
          icon: productsMetadata.animalIcon,
        })
        .from(productsMetadata)
        .where(sql`${productsMetadata.animalDisplay} IS NOT NULL`)
        .groupBy(productsMetadata.animalDisplay, productsMetadata.animalType, productsMetadata.animalIcon)
        .orderBy(productsMetadata.animalDisplay);

      // Filter out null values and format for frontend
      const animals = result
        .filter(animal => animal.type && animal.display && animal.icon)
        .map(animal => ({
          type: animal.type,
          display: animal.display,
          icon: animal.icon,
        }));

      return animals;
    } catch (error) {
      console.error('Error fetching unique animals:', error);
      throw new Error('Failed to fetch animal categories');
    }
  }

  /**
   * Gets animal categories grouped by type.
   * Useful for organizing animals into sections (e.g., Traditional, Exotic, etc.)
   * 
   * @returns {Promise<Object<string, Array>>}
   */
  async getAnimalsByType() {
    const animals = await this.getAllUniqueAnimals();
    
    const grouped = animals.reduce((acc, animal) => {
      if (!acc[animal.type]) {
        acc[animal.type] = [];
      }
      acc[animal.type].push(animal);
      return acc;
    }, {});

    return grouped;
  }

  /**
   * Validates if the given animal displays exist in the database.
   * Used for validation when creating/updating achievements.
   * 
   * @param {Array<string>} animalDisplays - Array of animal display names
   * @returns {Promise<boolean>}
   */
  async validateAnimalDisplays(animalDisplays) {
    if (!animalDisplays || animalDisplays.length === 0) {
      return false;
    }

    const allAnimals = await this.getAllUniqueAnimals();
    const validDisplays = new Set(allAnimals.map(a => a.display));

    return animalDisplays.every(display => validDisplays.has(display));
  }

  /**
   * Gets count of products for each animal category.
   * Useful for displaying product counts in the UI.
   * 
   * @returns {Promise<Object<string, number>>}
   */
  async getProductCountByAnimal() {
    try {
      const result = await db
        .select({
          display: productsMetadata.animalDisplay,
          count: sql`count(*)::int`,
        })
        .from(productsMetadata)
        .where(sql`${productsMetadata.animalDisplay} IS NOT NULL`)
        .groupBy(productsMetadata.animalDisplay)
        .orderBy(productsMetadata.animalDisplay);

      const counts = {};
      result.forEach(row => {
        counts[row.display] = row.count;
      });

      return counts;
    } catch (error) {
      console.error('Error fetching product counts:', error);
      throw new Error('Failed to fetch product counts by animal');
    }
  }
}

// Export singleton instance
module.exports = new AnimalCategoryService();
