const Sentry = require('@sentry/node');

class ShopifyWebhookRegistrar {
  constructor(shopDomain, accessToken, apiVersion = '2024-01') {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;
  }

  async registerWebhooks(appDomain) {
    if (!this.accessToken || !this.shopDomain) {
      console.warn('⚠️ Shopify credentials not configured - skipping webhook registration');
      return { success: false, reason: 'missing_credentials' };
    }

    const webhooks = [
      {
        topic: 'orders/create',
        address: `https://${appDomain}/api/webhooks/shopify/orders`,
        format: 'json'
      },
      {
        topic: 'orders/updated',
        address: `https://${appDomain}/api/webhooks/shopify/orders`,
        format: 'json'
      },
      {
        topic: 'orders/cancelled',
        address: `https://${appDomain}/api/webhooks/shopify/orders`,
        format: 'json'
      },
      {
        topic: 'products/update',
        address: `https://${appDomain}/api/webhooks/shopify/products`,
        format: 'json'
      },
      {
        topic: 'products/create',
        address: `https://${appDomain}/api/webhooks/shopify/products`,
        format: 'json'
      },
      {
        topic: 'customers/update',
        address: `https://${appDomain}/api/webhooks/shopify/customers`,
        format: 'json'
      }
    ];

    console.log('📨 Registering Shopify webhooks...');
    
    try {
      const existingWebhooks = await this.getExistingWebhooks();
      const results = [];

      for (const webhook of webhooks) {
        const existing = existingWebhooks.find(
          w => w.topic === webhook.topic && w.address === webhook.address
        );

        if (existing) {
          console.log(`✓ Webhook already registered: ${webhook.topic} -> ${webhook.address}`);
          results.push({ topic: webhook.topic, status: 'already_registered', id: existing.id });
        } else {
          const result = await this.createWebhook(webhook);
          results.push(result);
        }
      }

      const registered = results.filter(r => r.status === 'registered').length;
      const existing = results.filter(r => r.status === 'already_registered').length;
      const failed = results.filter(r => r.status === 'failed').length;

      console.log(`✅ Webhook registration complete: ${registered} new, ${existing} existing, ${failed} failed`);

      return {
        success: true,
        registered,
        existing,
        failed,
        results
      };
    } catch (error) {
      console.error('❌ Error registering webhooks:', error);
      Sentry.captureException(error, {
        tags: { service: 'webhook-registration' }
      });
      return { success: false, error: error.message };
    }
  }

  async getExistingWebhooks() {
    try {
      const response = await fetch(`${this.baseUrl}/webhooks.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch webhooks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.webhooks || [];
    } catch (error) {
      console.error('❌ Error fetching existing webhooks:', error);
      return [];
    }
  }

  async createWebhook(webhook) {
    try {
      const response = await fetch(`${this.baseUrl}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webhook })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to register webhook ${webhook.topic}:`, errorText);
        return { 
          topic: webhook.topic, 
          status: 'failed', 
          error: `${response.status}: ${errorText}` 
        };
      }

      const data = await response.json();
      console.log(`✅ Registered webhook: ${webhook.topic} -> ${webhook.address}`);
      
      return { 
        topic: webhook.topic, 
        status: 'registered', 
        id: data.webhook?.id 
      };
    } catch (error) {
      console.error(`❌ Error creating webhook ${webhook.topic}:`, error);
      return { 
        topic: webhook.topic, 
        status: 'failed', 
        error: error.message 
      };
    }
  }

  async deleteWebhook(webhookId) {
    try {
      const response = await fetch(`${this.baseUrl}/webhooks/${webhookId}.json`, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete webhook: ${response.status}`);
      }

      console.log(`🗑️ Deleted webhook: ${webhookId}`);
      return { success: true, id: webhookId };
    } catch (error) {
      console.error(`❌ Error deleting webhook ${webhookId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ShopifyWebhookRegistrar;
