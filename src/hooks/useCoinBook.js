import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const data = await api.get('/gamification/achievements');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useGamificationProgress() {
  return useQuery({
    queryKey: ['gamificationProgress'],
    queryFn: async () => {
      const data = await api.get('/gamification/progress');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
