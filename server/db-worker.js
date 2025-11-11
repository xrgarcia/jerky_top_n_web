const { createWorkerPool } = require('./db');

// Create dedicated pool for BullMQ workers (ClassificationWorker, BulkImportWorker, EngagementBackfillWorker)
// This prevents worker jobs from exhausting the shared connection pool
const { workerPool, workerDb } = createWorkerPool();

module.exports = { workerPool, workerDb };
