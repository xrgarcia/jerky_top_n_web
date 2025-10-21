const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function resetAchievements() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('🗑️ Resetting achievement data...');
    
    await sql`DELETE FROM user_achievements`;
    console.log('✅ Cleared all user_achievements');
    
    await sql`DELETE FROM achievements`;
    console.log('✅ Cleared all achievements');
    
    await sql`DELETE FROM flavor_coins`;
    console.log('✅ Cleared all flavor_coins');
    
    console.log('✅ Achievement data reset complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Use the Admin Dashboard to create new achievement definitions');
    console.log('2. Or run the seed script to populate initial achievements');
    
  } catch (error) {
    console.error('❌ Error resetting achievements:', error);
    throw error;
  }
}

if (require.main === module) {
  resetAchievements()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = resetAchievements;
