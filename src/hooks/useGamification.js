import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const data = await api.get('/gamification/achievements');
      return data.achievements || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCoinBook() {
  return useQuery({
    queryKey: ['coinbook'],
    queryFn: async () => {
      const data = await api.get('/gamification/achievements');
      return data.achievements || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCoinDetail(achievementId) {
  return useQuery({
    queryKey: ['coin', achievementId],
    queryFn: async () => {
      const data = await api.get(`/gamification/achievements/${achievementId}`);
      return data;
    },
    enabled: !!achievementId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProgress() {
  return useQuery({
    queryKey: ['progress'],
    queryFn: async () => {
      const data = await api.get('/gamification/progress');
      return data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: ['streaks'],
    queryFn: async () => {
      const data = await api.get('/gamification/streaks');
      return data.streaks || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useHomeStats() {
  return useQuery({
    queryKey: ['homeStats'],
    queryFn: async () => {
      const data = await api.get('/gamification/home-stats');
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds - frequently updated
  });
}
