import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useProductWebhooks(limit = 50) {
  return useQuery({
    queryKey: ['admin', 'product-webhooks', limit],
    queryFn: async () => {
      const response = await api.get(`/admin/product-webhooks/recent?limit=${limit}`);
      return response.webhooks || [];
    },
    staleTime: 30000,
    refetchInterval: false,
  });
}
