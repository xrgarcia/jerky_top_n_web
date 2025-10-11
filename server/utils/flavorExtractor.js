// Flavor extraction and categorization utility
const flavorMapping = {
  // Sweet flavors
  'maple': { type: 'sweet', icon: '🍁' },
  'honey': { type: 'sweet', icon: '🍯' },
  'sweet': { type: 'sweet', icon: '🍬' },
  'teriyaki': { type: 'sweet', icon: '🍯' },
  'brown sugar': { type: 'sweet', icon: '🍬' },
  
  // Spicy/Hot flavors
  'hot': { type: 'spicy', icon: '🌶️' },
  'spicy': { type: 'spicy', icon: '🌶️' },
  'jalapeño': { type: 'spicy', icon: '🌶️' },
  'jalapeno': { type: 'spicy', icon: '🌶️' },
  'sriracha': { type: 'spicy', icon: '🌶️' },
  'habanero': { type: 'spicy', icon: '🌶️' },
  'ghost pepper': { type: 'spicy', icon: '🌶️' },
  'cayenne': { type: 'spicy', icon: '🌶️' },
  'chipotle': { type: 'spicy', icon: '🌶️' },
  
  // Savory flavors
  'savory': { type: 'savory', icon: '🥩' },
  'original': { type: 'savory', icon: '🥩' },
  'classic': { type: 'savory', icon: '🥩' },
  'traditional': { type: 'savory', icon: '🥩' },
  'au jus': { type: 'savory', icon: '🥩' },
  'salt': { type: 'savory', icon: '🧂' },
  'sea salt': { type: 'savory', icon: '🧂' },
  
  // Smoky flavors
  'barbecue': { type: 'smoky', icon: '🔥' },
  'bbq': { type: 'smoky', icon: '🔥' },
  'hickory': { type: 'smoky', icon: '🔥' },
  'mesquite': { type: 'smoky', icon: '🔥' },
  'smoked': { type: 'smoky', icon: '🔥' },
  'smoke': { type: 'smoky', icon: '🔥' },
  
  // Peppery flavors
  'pepper': { type: 'peppery', icon: '🌿' },
  'black pepper': { type: 'peppery', icon: '🌿' },
  'cracked pepper': { type: 'peppery', icon: '🌿' },
  'peppered': { type: 'peppery', icon: '🌿' },
  
  // Garlic/Herb flavors
  'garlic': { type: 'garlic', icon: '🧄' },
  'herb': { type: 'garlic', icon: '🌿' },
  'rosemary': { type: 'garlic', icon: '🌿' },
  
  // Tangy flavors
  'citrus': { type: 'tangy', icon: '🍋' },
  'lime': { type: 'tangy', icon: '🍋' },
  'lemon': { type: 'tangy', icon: '🍋' },
  'vinegar': { type: 'tangy', icon: '🍋' },
  
  // Exotic/International flavors
  'korean': { type: 'exotic', icon: '🌏' },
  'thai': { type: 'exotic', icon: '🌏' },
  'jamaican': { type: 'exotic', icon: '🌏' },
  'jerk': { type: 'exotic', icon: '🌏' },
  'asian': { type: 'exotic', icon: '🌏' },
  'cajun': { type: 'exotic', icon: '🌏' }
};

// Flavor type display names and priorities
const flavorTypeInfo = {
  'sweet': { display: 'Sweet', priority: 1 },
  'spicy': { display: 'Spicy', priority: 2 },
  'savory': { display: 'Savory', priority: 3 },
  'smoky': { display: 'Smoky', priority: 4 },
  'peppery': { display: 'Peppery', priority: 5 },
  'garlic': { display: 'Garlic/Herb', priority: 6 },
  'tangy': { display: 'Tangy', priority: 7 },
  'exotic': { display: 'Exotic', priority: 8 }
};

/**
 * Extract flavor profiles from product title
 * Returns primary flavor and secondary flavors
 * @param {string} title - Product title
 * @returns {object} - { primary, secondary[], display, icon } or null
 */
function extractFlavorsFromTitle(title) {
  if (!title) return null;
  
  const lowerTitle = title.toLowerCase();
  const foundFlavors = [];
  
  // Check for multi-word flavors first (e.g., "ghost pepper", "brown sugar")
  const multiWordFlavors = [
    'ghost pepper',
    'brown sugar',
    'black pepper',
    'cracked pepper',
    'sea salt',
    'au jus'
  ];
  
  for (const flavor of multiWordFlavors) {
    if (lowerTitle.includes(flavor)) {
      const flavorData = flavorMapping[flavor];
      if (flavorData && !foundFlavors.some(f => f.type === flavorData.type)) {
        foundFlavors.push({ name: flavor, ...flavorData });
      }
    }
  }
  
  // Then check single-word flavors
  for (const [flavorName, flavorData] of Object.entries(flavorMapping)) {
    if (!multiWordFlavors.includes(flavorName) && lowerTitle.includes(flavorName)) {
      if (!foundFlavors.some(f => f.type === flavorData.type)) {
        foundFlavors.push({ name: flavorName, ...flavorData });
      }
    }
  }
  
  if (foundFlavors.length === 0) {
    return null;
  }
  
  // Sort by priority (lower number = higher priority)
  foundFlavors.sort((a, b) => {
    const priorityA = flavorTypeInfo[a.type]?.priority || 99;
    const priorityB = flavorTypeInfo[b.type]?.priority || 99;
    return priorityA - priorityB;
  });
  
  // Primary is the first (highest priority) flavor
  const primary = foundFlavors[0];
  const secondary = foundFlavors.slice(1).map(f => f.type);
  
  // Build display string
  const displayParts = [primary.type, ...secondary].map(type => 
    flavorTypeInfo[type]?.display || type
  );
  const display = displayParts.join(' & ');
  
  return {
    primary: primary.type,
    secondary: secondary,
    display: display,
    icon: primary.icon
  };
}

/**
 * Get unique flavor categories with counts
 * @param {Array} products - Array of product objects with titles
 * @returns {Array} - Array of { flavor, display, icon, count }
 */
function getFlavorCategories(products) {
  const flavorCounts = {};
  
  products.forEach(product => {
    const flavors = extractFlavorsFromTitle(product.title);
    if (flavors) {
      // Count primary flavor
      const primaryDisplay = flavorTypeInfo[flavors.primary]?.display || flavors.primary;
      if (!flavorCounts[primaryDisplay]) {
        flavorCounts[primaryDisplay] = {
          flavor: primaryDisplay,
          type: flavors.primary,
          icon: flavors.icon,
          count: 0
        };
      }
      flavorCounts[primaryDisplay].count++;
      
      // Count secondary flavors
      flavors.secondary.forEach(secType => {
        const secDisplay = flavorTypeInfo[secType]?.display || secType;
        const secIcon = Object.values(flavorMapping).find(f => f.type === secType)?.icon || '🍴';
        if (!flavorCounts[secDisplay]) {
          flavorCounts[secDisplay] = {
            flavor: secDisplay,
            type: secType,
            icon: secIcon,
            count: 0
          };
        }
        flavorCounts[secDisplay].count++;
      });
    }
  });
  
  // Sort by count descending
  return Object.values(flavorCounts).sort((a, b) => b.count - a.count);
}

module.exports = {
  extractFlavorsFromTitle,
  getFlavorCategories,
  flavorMapping,
  flavorTypeInfo
};
