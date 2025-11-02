import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize socket connection
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setIsSocketAuthenticated(false);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
      setIsSocketAuthenticated(false);
    });

    // Socket authentication success
    socket.on('authenticated', (data) => {
      console.log('🔐 Socket authenticated:', data);
      setIsSocketAuthenticated(true);
    });

    // Achievement notification handler
    socket.on('achievement:earned', (data) => {
      console.log('🏆 Achievement earned:', data);
      
      // Invalidate achievements and progress queries
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['coinbook'] });
      queryClient.invalidateQueries({ queryKey: ['homeStats'] });
    });

    // Home stats update handler
    socket.on('stats:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['homeStats'] });
    });

    // Leaderboard update handler
    socket.on('leaderboard:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, user, queryClient]);

  return {
    socket: socketRef.current,
    isConnected,
    isSocketAuthenticated,
  };
}
