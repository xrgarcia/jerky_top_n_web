const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require("ws");
const schema = require("../shared/schema.js");

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const primaryConnectionString = process.env.DATABASE_URL;

const primaryPool = new Pool({ 
  connectionString: primaryConnectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const primaryDb = drizzle({ client: primaryPool, schema });

console.log('💾 Primary database connection configured (no pooler - read from primary)');

module.exports = { primaryPool, primaryDb };
