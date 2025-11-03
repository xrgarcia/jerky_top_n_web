import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';

export function useCoinBookWebSocket() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    console.log('🪙 Setting up coin book WebSocket listeners...');

    // Listen for new achievements
    const handleAchievementsEarned = (data) => {
      console.log('🏆 Achievements earned event:', data);
      
      // Invalidate both achievements and progress queries
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    // Listen for new flavor coins
    const handleFlavorCoinsEarned = (data) => {
      console.log('🪙 Flavor coins earned event:', data);
      
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    // Listen for tier upgrades
    const handleTierUpgrade = (data) => {
      console.log('⬆️ Tier upgrade event:', data);
      
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    socket.on('achievements:earned', handleAchievementsEarned);
    socket.on('flavor_coins:earned', handleFlavorCoinsEarned);
    socket.on('tier:upgrade', handleTierUpgrade);

    // Cleanup
    return () => {
      console.log('🪙 Cleaning up coin book WebSocket listeners');
      socket.off('achievements:earned', handleAchievementsEarned);
      socket.off('flavor_coins:earned', handleFlavorCoinsEarned);
      socket.off('tier:upgrade', handleTierUpgrade);
    };
  }, [socket, queryClient]);

  return { socket };
}
