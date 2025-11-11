import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';

export function useProductWebhooks(limit = 50) {
  return useQuery({
    queryKey: ['admin', 'product-webhooks', limit],
    queryFn: async () => {
      const response = await apiClient.get(`/api/admin/product-webhooks/recent?limit=${limit}`);
      return response.data.webhooks || [];
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });
}
