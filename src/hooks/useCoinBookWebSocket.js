import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { useToast } from '../context/ToastContext';

export function useCoinBookWebSocket() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket) return;

    console.log('🪙 Setting up coin book WebSocket listeners...');

    const tierEmojis = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '💠'
    };

    // Listen for new achievements
    const handleAchievementsEarned = (data) => {
      console.log('🏆 Achievements earned event:', data);
      
      // Show toast for each achievement
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          const isTierUpgrade = achievement.isTierUpgrade;
          const tierEmoji = tierEmojis[achievement.tier] || '⭐';
          
          let title = '🎉 Achievement Unlocked!';
          let message = achievement.name;
          let description = achievement.description;
          
          if (isTierUpgrade) {
            title = '⬆️ Tier Upgraded!';
            message = `${achievement.name} - ${tierEmoji} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`;
            
            if (achievement.pointsGained) {
              description = `+${achievement.pointsGained} points earned! ${achievement.description || ''}`;
            }
          }
          
          showToast({
            type: 'achievement',
            icon: achievement.icon || '🏆',
            title,
            message,
            duration: 6000
          });
        });
      }
      
      // Invalidate both achievements and progress queries
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    // Listen for new flavor coins
    const handleFlavorCoinsEarned = (data) => {
      console.log('🪙 Flavor coins earned event:', data);
      
      // Show toast for flavor coins
      if (data.coins && data.coins.length > 0) {
        data.coins.forEach(coin => {
          showToast({
            type: 'info',
            icon: coin.icon || '🪙',
            title: '🪙 Flavor Coin Earned!',
            message: coin.name || coin.flavorName || 'New Flavor Coin',
            duration: 5000
          });
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    // Listen for tier upgrades
    const handleTierUpgrade = (data) => {
      console.log('⬆️ Tier upgrade event:', data);
      
      if (data.achievement) {
        const achievement = data.achievement;
        const tierEmoji = tierEmojis[achievement.tier] || '⭐';
        
        showToast({
          type: 'achievement',
          icon: achievement.icon || '⬆️',
          title: '⬆️ Tier Upgraded!',
          message: `${achievement.name} - ${tierEmoji} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`,
          duration: 6000
        });
      }
      
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
  }, [socket, queryClient, showToast]);

  return { socket };
}
