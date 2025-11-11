const express = require('express');
const webhookQueue = require('../../services/WebhookQueue');

module.exports = function createCustomerWebhooksRoutes() {
  const router = express.Router();

  /**
   * GET /api/admin/customer-webhooks/recent
   * Get recent customer webhook jobs from BullMQ queue
   */
  router.get('/customer-webhooks/recent', async (req, res) => {
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

      // Combine and filter for customer webhooks only
      const allJobs = [...completed, ...failed];
      const customerJobs = allJobs
        .filter(job => job.data?.type === 'customers')
        .map(job => ({
          id: job.id,
          topic: job.data.topic,
          state: job.failedReason ? 'failed' : 'completed',
          timestamp: job.processedOn || job.finishedOn || job.timestamp,
          customerData: {
            shopifyCustomerId: job.data.data?.id,
            email: job.data.data?.email,
            firstName: job.data.data?.first_name,
            lastName: job.data.data?.last_name
          },
          returnValue: job.returnvalue || null,
          failedReason: job.failedReason || null,
          processedAt: job.processedOn,
          finishedAt: job.finishedOn
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);

      res.json({
        success: true,
        webhooks: customerJobs,
        total: customerJobs.length
      });

    } catch (error) {
      console.error('Error fetching customer webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer webhooks',
        message: error.message
      });
    }
  });

  return router;
};
