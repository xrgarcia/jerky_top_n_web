import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useCommunityUsers({ search = '', page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ['community', 'users', { search, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page);
      params.set('limit', limit);

      const data = await api.get(`/community/users?${params.toString()}`);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUserProfile(userId) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const data = await api.get(`/community/users/${userId}`);
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLeaderboard({ period = 'all_time', limit = 50 } = {}) {
  return useQuery({
    queryKey: ['leaderboard', period, limit],
    queryFn: async () => {
      const data = await api.get(`/gamification/leaderboard?period=${period}&limit=${limit}`);
      return data.leaderboard || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    placeholderData: keepPreviousData,
  });
}
