import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useCustomerOrders(filters = {}) {
  return useQuery({
    queryKey: ['customerOrders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add all filter params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.set(key, value.toString());
        }
      });

      const data = await api.get(`/admin/customer-orders?${params.toString()}`);
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds - fresh data for admin
    refetchOnWindowFocus: true,
  });
}
