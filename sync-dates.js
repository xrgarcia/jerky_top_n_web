require('dotenv').config();
const { db } = require('./server/db.js');

async function syncDates() {
  try {
    const { createAdminApiClient } = require('@shopify/admin-api-client');
    const client = createAdminApiClient({
      storeDomain: process.env.SHOPIFY_DOMAIN,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: '2024-10'
    });

    console.log('📦 Fetching products from Shopify...');
    
    const query = `
      query {
        products(first: 250, query: "tag:Rankable") {
          edges {
            node {
              id
              title
              createdAt
            }
          }
        }
      }
    `;
    
    const response = await client.request(query);
    const products = response.data.products.edges.map(edge => ({
      id: edge.node.id.split('/').pop(),
      title: edge.node.title,
      createdAt: edge.node.createdAt
    }));
    
    console.log(`✅ Fetched ${products.length} products from Shopify`);
    
    // Update each product's shopify_created_at
    let updated = 0;
    const { sql } = require('drizzle-orm');
    
    for (const product of products) {
      const result = await db.execute(sql`
        UPDATE products_metadata 
        SET shopify_created_at = ${new Date(product.createdAt)}
        WHERE shopify_product_id = ${product.id}
        AND shopify_created_at IS NULL
      `);
      
      if (result.rowCount > 0) {
        updated++;
      }
    }
    
    console.log(`✅ Updated ${updated} products with created_at dates`);
    
    // Verify
    const check = await db.execute(sql`
      SELECT shopify_product_id, title, shopify_created_at 
      FROM products_metadata 
      WHERE shopify_created_at IS NOT NULL 
      LIMIT 3
    `);
    console.log('Verification:', check.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

syncDates();
