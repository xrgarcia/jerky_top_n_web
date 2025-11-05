import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { useToast } from '../context/ToastContext';
import { TIER_EMOJIS } from '../../shared/constants/tierEmojis.mjs';

export function useCoinBookWebSocket() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket) return;

    console.log('🪙 Setting up coin book WebSocket listeners...');

    // Listen for new achievements
    const handleAchievementsEarned = (data) => {
      console.log('🏆 Achievements earned event:', data);
      
      // Show toast for each achievement
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          const isTierUpgrade = achievement.isTierUpgrade;
          const tierEmoji = TIER_EMOJIS[achievement.tier] || '⭐';
          
          let title = `🪙 ${achievement.name} Coin Earned!`;
          let message = achievement.description || achievement.name;
          
          if (isTierUpgrade) {
            title = `⬆️ ${achievement.name} Tier Upgraded!`;
            message = `${tierEmoji} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`;
            
            if (achievement.pointsGained) {
              message += ` - +${achievement.pointsGained} points earned!`;
            }
          }
          
          showToast({
            type: 'achievement',
            icon: achievement.icon || '🏆',
            iconType: achievement.iconType || 'emoji',
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

    // Listen for tier upgrades
    const handleTierUpgrade = (data) => {
      console.log('⬆️ Tier upgrade event:', data);
      
      if (data.achievement) {
        const achievement = data.achievement;
        const tierEmoji = TIER_EMOJIS[achievement.tier] || '⭐';
        
        showToast({
          type: 'achievement',
          icon: achievement.icon || '⬆️',
          iconType: achievement.iconType || 'emoji',
          title: '⬆️ Tier Upgraded!',
          message: `${achievement.name} - ${tierEmoji} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`,
          duration: 6000
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    // Listen for progress updates (no toast, just refresh data)
    const handleProgressUpdate = (data) => {
      console.log('📊 Progress update event:', data);
      queryClient.invalidateQueries({ queryKey: ['gamificationProgress'] });
    };

    socket.on('achievements:earned', handleAchievementsEarned);
    socket.on('tier:upgrade', handleTierUpgrade);
    socket.on('gamification:progress:updated', handleProgressUpdate);

    // Cleanup
    return () => {
      console.log('🪙 Cleaning up coin book WebSocket listeners');
      socket.off('achievements:earned', handleAchievementsEarned);
      socket.off('tier:upgrade', handleTierUpgrade);
      socket.off('gamification:progress:updated', handleProgressUpdate);
    };
  }, [socket, queryClient, showToast]);

  return { socket };
}
