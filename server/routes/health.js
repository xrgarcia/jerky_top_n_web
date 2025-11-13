const express = require('express');
const router = express.Router();
const redisClient = require('../services/RedisClient');
const { pool } = require('../db');

router.get('/connections', async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    redis: { status: 'unknown', connected: false, latencyMs: null, error: null },
    database: { status: 'unknown', connected: false, latencyMs: null, poolStats: null, error: null },
    workers: { status: 'unknown', details: {} }
  };

  const startTime = Date.now();

  try {
    const redisStartTime = Date.now();
    const client = await redisClient.connect();
    
    if (client && redisClient.isConnected) {
      await client.ping();
      health.redis = {
        status: 'healthy',
        connected: true,
        latencyMs: Date.now() - redisStartTime,
        error: null
      };
    } else {
      health.redis = {
        status: 'disconnected',
        connected: false,
        latencyMs: null,
        error: 'Redis client not available'
      };
    }
  } catch (error) {
    health.redis = {
      status: 'unhealthy',
      connected: false,
      latencyMs: null,
      error: error.message
    };
  }

  try {
    const dbStartTime = Date.now();
    await pool.query('SELECT 1 as health_check');
    health.database = {
      status: 'healthy',
      connected: true,
      latencyMs: Date.now() - dbStartTime,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      },
      error: null
    };
  } catch (error) {
    health.database = {
      status: 'unhealthy',
      connected: false,
      latencyMs: null,
      poolStats: null,
      error: error.message
    };
  }

  const webhookWorker = require('../services/WebhookWorker');
  const classificationWorker = require('../services/ClassificationWorker');
  const bulkImportWorker = require('../services/BulkImportWorker');
  const engagementBackfillWorker = require('../services/EngagementBackfillWorker');

  const workers = [
    { name: 'webhook', instance: webhookWorker },
    { name: 'classification', instance: classificationWorker },
    { name: 'bulkImport', instance: bulkImportWorker },
    { name: 'engagementBackfill', instance: engagementBackfillWorker }
  ];

  let allWorkersHealthy = true;
  for (const { name, instance } of workers) {
    if (instance.worker) {
      try {
        // BullMQ isRunning() and isPaused() are async methods - must await them
        const isRunning = await instance.worker.isRunning();
        const isPaused = await instance.worker.isPaused();
        
        health.workers.details[name] = {
          initialized: true,
          running: isRunning,
          paused: isPaused,
          status: isRunning && !isPaused ? 'healthy' : isPaused ? 'paused' : 'stopped'
        };
        
        if (!isRunning || isPaused) {
          allWorkersHealthy = false;
        }
      } catch (err) {
        health.workers.details[name] = {
          initialized: true,
          running: false,
          paused: false,
          status: 'error',
          error: err.message
        };
        allWorkersHealthy = false;
      }
    } else {
      health.workers.details[name] = {
        initialized: false,
        running: false,
        paused: false,
        status: 'not_initialized'
      };
      allWorkersHealthy = false;
    }
  }

  health.workers.status = allWorkersHealthy ? 'healthy' : 'degraded';

  const overallHealthy = 
    health.redis.status === 'healthy' && 
    health.database.status === 'healthy' &&
    health.workers.status === 'healthy';

  const statusCode = overallHealthy ? 200 : 503;
  
  res.status(statusCode).json({
    status: overallHealthy ? 'healthy' : 'degraded',
    totalLatencyMs: Date.now() - startTime,
    ...health
  });
});

router.get('/ping', async (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
