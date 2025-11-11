import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

export function useCustomerWebhooksWebSocket({ onWebhookUpdate }) {
  const { socket } = useSocket();
  const onWebhookUpdateRef = useRef(onWebhookUpdate);

  useEffect(() => {
    onWebhookUpdateRef.current = onWebhookUpdate;
  }, [onWebhookUpdate]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('subscribe:customer-webhooks');
    console.log('📡 Subscribed to customer webhooks updates');

    const handleWebhookUpdate = (data) => {
      console.log('👤 Customer webhook update received:', data);
      if (onWebhookUpdateRef.current) {
        onWebhookUpdateRef.current(data);
      }
    };

    const handleSubscriptionConfirmed = (data) => {
      if (data.room === 'customer-webhooks') {
        console.log('✅ Customer webhooks subscription confirmed');
      }
    };

    const handleSubscriptionFailed = (data) => {
      if (data.room === 'customer-webhooks') {
        console.error('❌ Customer webhooks subscription failed:', data.reason);
      }
    };

    socket.on('customer-webhook:update', handleWebhookUpdate);
    socket.on('subscription:confirmed', handleSubscriptionConfirmed);
    socket.on('subscription:failed', handleSubscriptionFailed);

    return () => {
      socket.emit('unsubscribe:customer-webhooks');
      socket.off('customer-webhook:update', handleWebhookUpdate);
      socket.off('subscription:confirmed', handleSubscriptionConfirmed);
      socket.off('subscription:failed', handleSubscriptionFailed);
      console.log('📡 Unsubscribed from customer webhooks updates');
    };
  }, [socket]);
}
