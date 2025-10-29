const crypto = require('crypto');

class ShopifyWebhookVerifier {
  constructor(apiSecret) {
    this.apiSecret = apiSecret;
  }

  verify(rawBody, hmacHeader) {
    if (!this.apiSecret) {
      console.error('❌ SHOPIFY_API_SECRET not configured - webhook verification FAILED (fail-closed)');
      return false;
    }

    if (!hmacHeader) {
      console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', this.apiSecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const expectedBuffer = Buffer.from(hash, 'base64');
    const receivedBuffer = Buffer.from(hmacHeader, 'base64');

    if (expectedBuffer.length !== receivedBuffer.length) {
      console.error('❌ Webhook HMAC verification failed (length mismatch)');
      return false;
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    
    if (!isValid) {
      console.error('❌ Webhook HMAC verification failed');
    }

    return isValid;
  }

  getTopic(topicHeader) {
    return topicHeader || null;
  }

  getShopDomain(domainHeader) {
    return domainHeader || null;
  }
}

module.exports = ShopifyWebhookVerifier;
