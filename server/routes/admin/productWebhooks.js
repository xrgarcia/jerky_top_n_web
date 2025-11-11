const express = require('express');
const webhookQueue = require('../../services/WebhookQueue');

module.exports = function createProductWebhooksRoutes() {
  const router = express.Router();

  /**
   * GET /api/admin/product-webhooks/recent
   * Get recent product webhook jobs from BullMQ queue
   */
  router.get('/product-webhooks/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      if (!webhookQueue || !webhookQueue.queue) {
        return res.status(503).json({
          success: false,
          error: 'Webhook queue not initialized'
        });
      }

      // Fetch completed and failed jobs
      const [completed, failed] = await Promise.all([
        webhookQueue.queue.getCompleted(0, limit),
        webhookQueue.queue.getFailed(0, limit)
      ]);

      // Combine and filter for product webhooks only
      const allJobs = [...completed, ...failed];
      const productJobs = allJobs
        .filter(job => job.data?.type === 'products')
        .map(job => ({
          id: job.id,
          data: {
            topic: job.data.topic,
            type: job.data.type,
            data: {
              id: job.data.data?.id,
              title: job.data.data?.title,
              vendor: job.data.data?.vendor,
              status: job.data.data?.status,
              product_type: job.data.data?.product_type
            }
          },
          state: job.failedReason ? 'failed' : 'completed',
          timestamp: job.processedOn || job.finishedOn || job.timestamp,
          returnValue: job.returnvalue || null,
          failedReason: job.failedReason || null,
          processedAt: job.processedOn,
          finishedAt: job.finishedOn
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      res.json({
        success: true,
        webhooks: productJobs,
        total: productJobs.length
      });

    } catch (error) {
      console.error('Error fetching product webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch product webhooks',
        message: error.message
      });
    }
  });

  return router;
};
