import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/api';

export function useProgress() {
  return useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const response = await apiClient('/gamification/progress');
      const data = await response.json();
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000
  });
}

export function getNextMilestone(progressData) {
  if (!progressData || !progressData.nextMilestones || progressData.nextMilestones.length === 0) {
    return null;
  }
  return progressData.nextMilestones[0];
}

export function getMysteriousDescription(achievementCode) {
  const descriptions = {
    first_rank: "Every legend begins with a single choice...",
    rank_10: "The path reveals itself to those who persist...",
    rank_25: "Power grows with dedication. Keep going...",
    rank_50: "You're halfway to something extraordinary...",
    complete_collection: "The ultimate completionist. Rank them all...",
    streak_3: "The flame ignites. Feed it daily...",
    streak_7: "Seven suns have witnessed your devotion...",
    streak_30: "The calendar bends to your will. Don't break...",
    streak_100: "Legends speak of those who reached this height...",
    explorer: "Variety is the spice of discovery...",
    adventurer: "The world is vast. Taste it all...",
    globe_trotter: "Few have wandered this far. Continue...",
    top_10: "Rise above the masses. The podium awaits...",
    top_3: "Bronze, silver, or gold? Claim your throne...",
    community_leader: "Influence spreads like wildfire. Be the spark...",
    early_adopter: "The pioneers inherit the earth...",
    taste_maker: "Shape the future. Others will follow..."
  };
  
  return descriptions[achievementCode] || "The path forward awaits your discovery...";
}
