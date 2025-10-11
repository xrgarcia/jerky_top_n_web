// Animal extraction and categorization utility
const animalMapping = {
  // Fish
  'ahi tuna': { type: 'fish', display: 'Tuna', icon: '🐟' },
  'tuna': { type: 'fish', display: 'Tuna', icon: '🐟' },
  'salmon': { type: 'fish', display: 'Salmon', icon: '🐟' },
  'rainbow trout': { type: 'fish', display: 'Trout', icon: '🐟' },
  'trout': { type: 'fish', display: 'Trout', icon: '🐟' },
  
  // Cattle
  'beef': { type: 'cattle', display: 'Beef', icon: '🐄' },
  'brisket': { type: 'cattle', display: 'Beef', icon: '🐄' },
  'buffalo': { type: 'cattle', display: 'Buffalo', icon: '🦬' },
  
  // Poultry
  'chicken': { type: 'poultry', display: 'Chicken', icon: '🐔' },
  'turkey': { type: 'poultry', display: 'Turkey', icon: '🦃' },
  
  // Pork
  'pork': { type: 'pork', display: 'Pork', icon: '🐷' },
  'bacon': { type: 'pork', display: 'Bacon', icon: '🥓' },
  
  // Game
  'elk': { type: 'game', display: 'Elk', icon: '🦌' },
  'venison': { type: 'game', display: 'Venison', icon: '🦌' },
  'deer': { type: 'game', display: 'Deer', icon: '🦌' },
  'antelope': { type: 'game', display: 'Antelope', icon: '🦌' },
  'wild boar': { type: 'game', display: 'Wild Boar', icon: '🐗' },
  'boar': { type: 'game', display: 'Wild Boar', icon: '🐗' },
  
  // Exotic
  'alligator': { type: 'exotic', display: 'Alligator', icon: '🐊' },
  'alpaca': { type: 'exotic', display: 'Alpaca', icon: '🦙' },
  'kangaroo': { type: 'exotic', display: 'Kangaroo', icon: '🦘' },
  'ostrich': { type: 'exotic', display: 'Ostrich', icon: '🦢' },
  'lamb': { type: 'exotic', display: 'Lamb', icon: '🐑' }
};

/**
 * Extract animal type from product title
 * @param {string} title - Product title
 * @returns {object} - Animal metadata { type, display, icon } or null
 */
function extractAnimalFromTitle(title) {
  if (!title) return null;
  
  const lowerTitle = title.toLowerCase();
  
  // Check for multi-word animals first (e.g., "wild boar", "rainbow trout")
  const multiWordAnimals = [
    'ahi tuna',
    'rainbow trout',
    'wild boar'
  ];
  
  for (const animal of multiWordAnimals) {
    if (lowerTitle.includes(animal)) {
      return animalMapping[animal];
    }
  }
  
  // Then check single-word animals
  for (const [animalName, metadata] of Object.entries(animalMapping)) {
    if (lowerTitle.includes(animalName)) {
      return metadata;
    }
  }
  
  return null;
}

/**
 * Get unique animals from product list with counts
 * @param {Array} products - Array of product objects with titles
 * @returns {Array} - Array of { animal, display, icon, count }
 */
function getAnimalCategories(products) {
  const animalCounts = {};
  
  products.forEach(product => {
    const animal = extractAnimalFromTitle(product.title);
    if (animal) {
      const key = animal.display;
      if (!animalCounts[key]) {
        animalCounts[key] = {
          animal: key,
          display: animal.display,
          icon: animal.icon,
          type: animal.type,
          count: 0
        };
      }
      animalCounts[key].count++;
    }
  });
  
  // Sort by count descending
  return Object.values(animalCounts).sort((a, b) => b.count - a.count);
}

module.exports = {
  extractAnimalFromTitle,
  getAnimalCategories,
  animalMapping
};
