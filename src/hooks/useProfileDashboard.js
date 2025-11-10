import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/api';

/**
 * Hook to fetch comprehensive dashboard data for the private profile page
 * @returns {Object} Query result with dashboard data including guidance, purchase stats, and progress
 */
export function useProfileDashboard() {
  return useQuery({
    queryKey: ['profile', 'dashboard'],
    queryFn: async () => {
      const response = await apiClient.get('/api/profile/dashboard');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1,
  });
}
