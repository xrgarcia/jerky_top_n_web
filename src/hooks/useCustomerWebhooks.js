import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useCustomerWebhooks(limit = 50) {
  return useQuery({
    queryKey: ['admin', 'customer-webhooks', limit],
    queryFn: async () => {
      const response = await api.get(`/admin/customer-webhooks/recent?limit=${limit}`);
      return response.webhooks || [];
    },
    staleTime: 30000,
    refetchInterval: false,
  });
}
