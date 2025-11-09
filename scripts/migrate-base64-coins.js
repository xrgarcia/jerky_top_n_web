const { neon } = require('@neondatabase/serverless');
const { ObjectStorageService } = require('../server/objectStorage.js');

const sql = neon(process.env.DATABASE_URL);

async function migrateBase64Coins() {
  console.log('🔄 Starting base64 coin migration...\n');
  
  try {
    const achievements = await sql`
      SELECT id, name, code, icon
      FROM achievements
      WHERE icon LIKE 'data:image/%'
      ORDER BY id
    `;
    
    console.log(`Found ${achievements.length} achievements with base64 icons:\n`);
    
    if (achievements.length === 0) {
      console.log('✅ No base64 icons found. All coins are already using object storage!');
      return;
    }
    
    const objectStorageService = new ObjectStorageService();
    let successCount = 0;
    let errorCount = 0;
    
    for (const achievement of achievements) {
      console.log(`📦 Processing: ${achievement.name} (ID: ${achievement.id})`);
      
      try {
        const base64Data = achievement.icon;
        
        const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) {
          console.log(`  ⚠️  Invalid base64 format, skipping...`);
          errorCount++;
          continue;
        }
        
        const [, extension, data] = match;
        const buffer = Buffer.from(data, 'base64');
        
        console.log(`  📏 Size: ${(buffer.length / 1024).toFixed(2)} KB`);
        
        const filename = `${achievement.code}.${extension}`;
        console.log(`  📤 Uploading to object storage as: ${filename}`);
        
        const objectPath = await objectStorageService.uploadIconFromBuffer(buffer, filename);
        
        console.log(`  ✅ Uploaded to: ${objectPath}`);
        
        await sql`
          UPDATE achievements
          SET icon = ${objectPath}
          WHERE id = ${achievement.id}
        `;
        
        console.log(`  ✅ Database updated\n`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}\n`);
        errorCount++;
      }
    }
    
    console.log('─'.repeat(50));
    console.log(`\n✅ Migration complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${achievements.length}\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrateBase64Coins()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
