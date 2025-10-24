const cacheService = require('./services/CacheService');
const redisClient = require('./services/RedisClient');
const { createAdapter } = require('@socket.io/redis-adapter');

async function initializeScalability(io) {
  console.log('🚀 Initializing scalability features...');
  
  // Initialize Redis cache service
  await cacheService.initialize();
  
  // Setup Socket.IO Redis adapter for cross-instance communication
  const client = redisClient.getClient();
  if (client && client.status === 'ready') {
    try {
      // Create a duplicate connection for pub/sub
      const pubClient = client.duplicate();
      const subClient = client.duplicate();
      
      await Promise.all([
        pubClient.connect ? pubClient.connect() : Promise.resolve(),
        subClient.connect ? subClient.connect() : Promise.resolve()
      ]);
      
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.IO using Redis adapter for cross-instance communication');
    } catch (error) {
      console.error('❌ Failed to setup Socket.IO Redis adapter:', error.message);
      console.log('⚠️ Socket.IO using default in-memory adapter');
    }
  } else {
    console.log('⚠️ Redis not available - Socket.IO using in-memory adapter (single-instance only)');
  }
  
  console.log('✅ Scalability initialization complete');
}

module.exports = { initializeScalability, cacheService };
