// Test script to trigger achievement recalculation and observe duplicate/downgrade logs
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const schema = require('./shared/schema');

async function testTierUpgrade() {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  
  // Import services
  const AchievementRepository = require('./server/repositories/AchievementRepository');
  const ProductsMetadataRepository = require('./server/repositories/ProductsMetadataRepository');
  const CollectionManager = require('./server/services/CollectionManager');
  
  const achievementRepo = new AchievementRepository(db);
  const productsMetadataRepo = new ProductsMetadataRepository(db);
  const collectionManager = new CollectionManager(achievementRepo, productsMetadataRepo, db);
  
  const userId = 2; // User with existing achievements
  
  console.log('\n========================================');
  console.log('🧪 TESTING TIER UPGRADE RECALCULATION');
  console.log('========================================\n');
  
  // First recalculation
  console.log('--- RECALCULATION #1 ---');
  const updates1 = await collectionManager.checkAndUpdateCustomProductCollections(userId);
  console.log(`Result: ${updates1.length} updates\n`);
  
  // Second recalculation (should show same results)
  console.log('--- RECALCULATION #2 (immediate repeat) ---');
  const updates2 = await collectionManager.checkAndUpdateCustomProductCollections(userId);
  console.log(`Result: ${updates2.length} updates\n`);
  
  // Third recalculation
  console.log('--- RECALCULATION #3 (one more time) ---');
  const updates3 = await collectionManager.checkAndUpdateCustomProductCollections(userId);
  console.log(`Result: ${updates3.length} updates\n`);
  
  console.log('========================================');
  console.log('✅ TEST COMPLETE');
  console.log('========================================\n');
  
  process.exit(0);
}

testTierUpgrade().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
