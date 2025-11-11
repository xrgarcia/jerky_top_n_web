import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

export function useProductWebhooksWebSocket({ onWebhookUpdate }) {
  const { socket } = useSocket();
  const onWebhookUpdateRef = useRef(onWebhookUpdate);

  useEffect(() => {
    onWebhookUpdateRef.current = onWebhookUpdate;
  }, [onWebhookUpdate]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('subscribe:product-webhooks');
    console.log('📡 Subscribed to product webhooks updates');

    const handleWebhookUpdate = (data) => {
      console.log('📦 Product webhook update received:', data);
      if (onWebhookUpdateRef.current) {
        onWebhookUpdateRef.current(data);
      }
    };

    const handleSubscriptionConfirmed = (data) => {
      if (data.room === 'product-webhooks') {
        console.log('✅ Product webhooks subscription confirmed');
      }
    };

    const handleSubscriptionFailed = (data) => {
      if (data.room === 'product-webhooks') {
        console.error('❌ Product webhooks subscription failed:', data.reason);
      }
    };

    socket.on('product-webhook:update', handleWebhookUpdate);
    socket.on('subscription:confirmed', handleSubscriptionConfirmed);
    socket.on('subscription:failed', handleSubscriptionFailed);

    return () => {
      socket.emit('unsubscribe:product-webhooks');
      socket.off('product-webhook:update', handleWebhookUpdate);
      socket.off('subscription:confirmed', handleSubscriptionConfirmed);
      socket.off('subscription:failed', handleSubscriptionFailed);
      console.log('📡 Unsubscribed from product webhooks updates');
    };
  }, [socket]);
}
