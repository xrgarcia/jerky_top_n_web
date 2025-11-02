import { useEffect } from 'react';
import { useSocket } from './useSocket';

export function useCustomerOrdersWebSocket({ onOrderUpdate }) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    console.log('📦 Subscribing to customer orders updates...');

    // Subscribe to customer orders room
    socket.emit('subscribe:customer-orders');

    // Listen for subscription confirmation
    const handleSubscriptionConfirmed = (data) => {
      if (data.room === 'customer-orders') {
        console.log('✅ Subscribed to customer orders updates');
      }
    };

    // Listen for order updates
    const handleOrderUpdate = (data) => {
      console.log('📦 Customer order update received:', data);
      if (onOrderUpdate) {
        onOrderUpdate(data);
      }
    };

    socket.on('subscription:confirmed', handleSubscriptionConfirmed);
    socket.on('customer-orders:updated', handleOrderUpdate);

    // Cleanup on unmount
    return () => {
      console.log('📦 Unsubscribing from customer orders updates...');
      socket.emit('unsubscribe:customer-orders');
      socket.off('subscription:confirmed', handleSubscriptionConfirmed);
      socket.off('customer-orders:updated', handleOrderUpdate);
    };
  }, [socket, onOrderUpdate]);

  return { socket };
}
