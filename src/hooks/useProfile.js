import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await api.get('/profile');
      return data.user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
