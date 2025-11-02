import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export function useSuperAdminAccess() {
  const { isAuthenticated, user } = useAuthStore();
  
  return useQuery({
    queryKey: ['superAdminAccess', user?.email || user?.id || 'current'],
    queryFn: async () => {
      const response = await api.get('/api/admin/data/check-access');
      return response.hasSuperAdminAccess;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: isAuthenticated, // Only run if user is authenticated
  });
}
