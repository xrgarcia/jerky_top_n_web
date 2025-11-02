import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export function useSuperAdminAccess() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: ['superAdminAccess', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/admin/data/check-access');
      return response.hasSuperAdminAccess;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!user, // Only run if user is authenticated
  });
}
