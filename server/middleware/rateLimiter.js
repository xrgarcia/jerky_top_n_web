const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../services/RedisClient');

// Create rate limiters for different endpoint types
async function createRateLimiters() {
  const client = redisClient.getClient();
  const useRedis = client && client.status === 'ready';

  // Strict rate limit for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation (behind Replit proxy)
    ...(useRedis && {
      store: new RedisStore({
        client,
        prefix: 'rl:auth:',
        sendCommand: (...args) => client.call(...args),
      }),
    }),
  });

  // Moderate rate limit for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // Limit each IP to 120 requests per minute
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation (behind Replit proxy)
    ...(useRedis && {
      store: new RedisStore({
        client,
        prefix: 'rl:api:',
        sendCommand: (...args) => client.call(...args),
      }),
    }),
  });

  // Strict rate limit for ranking submissions
  const rankingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 ranking submissions per minute
    message: 'Too many ranking submissions, please slow down.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation (behind Replit proxy)
    ...(useRedis && {
      store: new RedisStore({
        client,
        prefix: 'rl:ranking:',
        sendCommand: (...args) => client.call(...args),
      }),
    }),
  });

  // Very strict rate limit for admin endpoints
  const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // Limit each IP to 20 admin requests per minute
    message: 'Too many admin requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false }, // Disable trust proxy validation (behind Replit proxy)
    ...(useRedis && {
      store: new RedisStore({
        client,
        prefix: 'rl:admin:',
        sendCommand: (...args) => client.call(...args),
      }),
    }),
  });

  const storageType = useRedis ? 'Redis (distributed)' : 'memory (single-instance)';
  console.log(`✅ Rate limiters configured using ${storageType}`);

  return {
    authLimiter,
    apiLimiter,
    rankingLimiter,
    adminLimiter,
  };
}

module.exports = { createRateLimiters };
