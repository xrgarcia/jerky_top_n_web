import { useEffect } from 'react';
import { useSocket } from './useSocket';

/**
 * Custom hook to track page views via WebSocket
 * Emits page:view events for user activity tracking and classification triggers
 * 
 * @param {string} page - Page identifier (e.g., 'rank', 'products', 'community', 'coinbook', 'general')
 */
export function usePageView(page) {
  const { socket, isConnected, isSocketAuthenticated } = useSocket();

  useEffect(() => {
    // Only track if socket is connected and authenticated
    if (!socket || !isConnected || !isSocketAuthenticated) {
      return;
    }

    // Emit page:view event for backend tracking
    console.log(`📊 Tracking page view: ${page}`);
    socket.emit('page:view', { page });

    // No cleanup needed - we only track on mount
  }, [socket, isConnected, isSocketAuthenticated, page]);
}
