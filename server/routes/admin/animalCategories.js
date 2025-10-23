const express = require('express');
const router = express.Router();
const animalCategoryService = require('../../services/AnimalCategoryService');

/**
 * GET /api/admin/animal-categories
 * Fetches all unique animals from product metadata for use in achievement admin.
 * Returns animals with their display names, icons, and types.
 */
router.get('/animal-categories', async (req, res) => {
  try {
    const animals = await animalCategoryService.getAllUniqueAnimals();
    
    res.json({
      success: true,
      animals,
      count: animals.length,
    });
  } catch (error) {
    console.error('Error fetching animal categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch animal categories',
    });
  }
});

/**
 * GET /api/admin/animal-categories/with-counts
 * Fetches animals with product counts for each category.
 * Useful for displaying how many products are in each animal category.
 */
router.get('/animal-categories/with-counts', async (req, res) => {
  try {
    const [animals, counts] = await Promise.all([
      animalCategoryService.getAllUniqueAnimals(),
      animalCategoryService.getProductCountByAnimal(),
    ]);

    const animalsWithCounts = animals.map(animal => ({
      ...animal,
      productCount: counts[animal.display] || 0,
    }));

    res.json({
      success: true,
      animals: animalsWithCounts,
      count: animalsWithCounts.length,
    });
  } catch (error) {
    console.error('Error fetching animal categories with counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch animal categories with counts',
    });
  }
});

module.exports = router;
