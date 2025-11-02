import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export function useSuperAdminAccess() {
  const { isAuthenticated, user } = useAuthStore();
  
  console.log('🔍 useSuperAdminAccess - isAuthenticated:', isAuthenticated, 'user:', user);
  
  return useQuery({
    queryKey: ['superAdminAccess', user?.email || user?.id || 'current'],
    queryFn: async () => {
      console.log('🚀 Executing super admin check API call...');
      const response = await api.get('/api/admin/data/check-access');
      console.log('✅ Super admin check response:', response);
      return response.hasSuperAdminAccess;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: isAuthenticated, // Only run if user is authenticated
  });
}
