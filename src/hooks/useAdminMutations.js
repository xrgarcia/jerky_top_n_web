import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useClearCache() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const data = await api.post('/admin/data/clear-cache', {});
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      return data;
    }
  });
}

export function useClearAllData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/data/clear-all', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to clear all data' }));
        const error = new Error(errorData.error || 'Failed to clear all data');
        error.status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });
}

export function useSaveCacheConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ metadataCacheStaleHours, rankingStatsCacheStaleHours }) => {
      const data = await api.post('/admin/cache-config', {
        metadataCacheStaleHours,
        rankingStatsCacheStaleHours
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cacheConfig'] });
    }
  });
}
