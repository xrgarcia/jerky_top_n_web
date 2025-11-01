import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useMyRankings() {
  return useQuery({
    queryKey: ['rankings', 'my'],
    queryFn: async () => {
      const data = await api.get('/rank/my-rankings');
      return data.rankings || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useRankProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, position }) => {
      const data = await api.post('/rank/product', { productId, position });
      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries including products to refresh stats
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      queryClient.invalidateQueries({ queryKey: ['homeStats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh product stats
    },
  });
}

export function useUpdateRanking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rankingId, newPosition }) => {
      const data = await api.put(`/rank/rankings/${rankingId}`, { position: newPosition });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh product stats
    },
  });
}

export function useDeleteRanking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rankingId) => {
      const data = await api.delete(`/rank/rankings/${rankingId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh product stats
    },
  });
}
