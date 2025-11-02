import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useLiveUsers() {
  return useQuery({
    queryKey: ['liveUsers'],
    queryFn: async () => {
      const data = await api.get('/tools/live-users');
      return {
        users: data.users || [],
        count: data.count || 0,
      };
    },
    staleTime: 10 * 1000, // 10 seconds - short stale time for live data
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds as backup
  });
}

export function useEnvironmentConfig() {
  return useQuery({
    queryKey: ['environmentConfig'],
    queryFn: async () => {
      const data = await api.get('/admin/environment-config');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - environment config changes rarely
  });
}
