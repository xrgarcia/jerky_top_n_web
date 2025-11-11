import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';

export function useProductWebhooksWebSocket() {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const handleProductWebhookUpdate = useCallback((data) => {
    console.log('📡 Received product webhook update:', data);

    const action = data.action;
    const productTitle = data.data?.data?.title || 'Product';
    const vendor = data.data?.data?.vendor || '';

    const actionEmoji = {
      'upserted': '✅',
      'deleted': '🗑️',
      'noted': '📝'
    };

    const emoji = actionEmoji[action] || '📦';
    const displayVendor = vendor ? ` (${vendor})` : '';
    
    toast.success(`${emoji} ${productTitle}${displayVendor}`, {
      duration: 4000,
      position: 'bottom-right',
      id: `product-webhook-${data.data?.data?.id}-${Date.now()}`,
    });

    queryClient.invalidateQueries({ queryKey: ['admin', 'product-webhooks'] });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;

    console.log('🔌 Setting up product webhook WebSocket listener');
    socket.on('product_webhook_update', handleProductWebhookUpdate);

    return () => {
      console.log('🔌 Cleaning up product webhook WebSocket listener');
      socket.off('product_webhook_update', handleProductWebhookUpdate);
    };
  }, [socket, handleProductWebhookUpdate]);
}
