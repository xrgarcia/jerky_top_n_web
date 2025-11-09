const { db } = require('../db');
const { users } = require('../../shared/schema');
const { eq, sql } = require('drizzle-orm');

const ADJECTIVES = [
  'Smoky', 'Tender', 'Spicy', 'Sweet', 'Savory', 'Peppered', 'Maple',
  'Teriyaki', 'Hickory', 'Mesquite', 'Zesty', 'Tangy', 'Bold', 'Classic',
  'Premium', 'Wild', 'Artisan', 'Gourmet', 'Epic', 'Legendary', 'Supreme',
  'Original', 'Crispy', 'Chewy', 'Juicy', 'Smoked', 'Grilled', 'Charred',
  'Seasoned', 'Marinated', 'Cured', 'Dried', 'Sizzling', 'Fiery', 'Mild'
];

const NOUNS = [
  'Brisket', 'Strip', 'Chewer', 'Snacker', 'Chomper', 'Ninja', 'King',
  'Legend', 'Master', 'Pro', 'Fan', 'Lover', 'Guru', 'Wizard', 'Chef',
  'Ranger', 'Hunter', 'Explorer', 'Seeker', 'Connoisseur', 'Enthusiast',
  'Warrior', 'Champion', 'Hero', 'Captain', 'Baron', 'Duke', 'Knight',
  'Scout', 'Rancher', 'Cowboy', 'Pioneer', 'Maverick', 'Rebel'
];

const ANIMALS = [
  'Beef', 'Turkey', 'Pork', 'Chicken', 'Bison', 'Salmon', 'Tuna',
  'Elk', 'Venison', 'Duck', 'Ostrich', 'Alligator', 'Kangaroo'
];

const FLAVORS = [
  'BBQ', 'Honey', 'Sriracha', 'Habanero', 'Jalapeño', 'Chipotle',
  'Garlic', 'Onion', 'Bourbon', 'Whiskey', 'Coffee', 'Citrus'
];

/**
 * Generate a random jerky-themed handle
 * @returns {string} A handle without the @ symbol
 */
function generateRandomHandle() {
  const patterns = [
    // Adjective + Noun pattern (e.g., SmokyChomper)
    () => {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      return `${adj}${noun}`;
    },
    
    // Adjective + Animal pattern (e.g., TenderBeef)
    () => {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      return `${adj}${animal}`;
    },
    
    // Animal + Noun pattern (e.g., BeefMaster)
    () => {
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      return `${animal}${noun}`;
    },
    
    // Flavor + Noun pattern (e.g., BBQKing)
    () => {
      const flavor = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      return `${flavor}${noun}`;
    },
    
    // Adjective + Animal + Number pattern (e.g., SmokyBison247)
    () => {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      const num = Math.floor(Math.random() * 1000);
      return `${adj}${animal}${num}`;
    }
  ];
  
  // Randomly select a pattern
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  return pattern();
}

/**
 * Check if a handle is available (not taken)
 * @param {string} handle - Handle to check (without @)
 * @returns {Promise<boolean>} True if available, false if taken
 */
async function isHandleAvailable(handle) {
  if (!handle) return false;
  
  // Normalize handle to lowercase for case-insensitive comparison
  const normalizedHandle = handle.toLowerCase();
  
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.handle}) = ${normalizedHandle}`)
    .limit(1);
  
  return existing.length === 0;
}

/**
 * Generate a unique jerky-themed handle
 * Tries up to 10 times to find an available handle
 * @returns {Promise<string>} A unique handle without the @ symbol
 */
async function generateUniqueHandle() {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const handle = generateRandomHandle();
    const available = await isHandleAvailable(handle);
    
    if (available) {
      return handle;
    }
    
    // If handle is taken, try adding a number
    if (attempt >= 3) {
      const withNumber = `${handle}${Math.floor(Math.random() * 9999)}`;
      const numberAvailable = await isHandleAvailable(withNumber);
      if (numberAvailable) {
        return withNumber;
      }
    }
  }
  
  // Fallback: generate a timestamp-based handle
  const timestamp = Date.now().toString().slice(-6);
  const fallback = `JerkyFan${timestamp}`;
  return fallback;
}

/**
 * Validate handle format
 * @param {string} handle - Handle to validate (without @)
 * @returns {object} { valid: boolean, error: string }
 */
function validateHandleFormat(handle) {
  if (!handle) {
    return { valid: false, error: 'Handle is required' };
  }
  
  // Remove @ if present (for user convenience)
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  
  // Length check
  if (cleanHandle.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters' };
  }
  
  if (cleanHandle.length > 20) {
    return { valid: false, error: 'Handle must be 20 characters or less' };
  }
  
  // Format check: alphanumeric and underscore only
  if (!/^[a-zA-Z0-9_]+$/.test(cleanHandle)) {
    return { valid: false, error: 'Handle can only contain letters, numbers, and underscores' };
  }
  
  // Must start with a letter
  if (!/^[a-zA-Z]/.test(cleanHandle)) {
    return { valid: false, error: 'Handle must start with a letter' };
  }
  
  return { valid: true, handle: cleanHandle };
}

module.exports = {
  generateRandomHandle,
  generateUniqueHandle,
  isHandleAvailable,
  validateHandleFormat,
};
