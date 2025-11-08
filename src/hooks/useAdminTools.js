import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useLiveUsers() {
  return useQuery({
    queryKey: ['liveUsers'],
    queryFn: async () => {
      const data = await api.get('/tools/live-users');
      return {
        users: data.users || [],
        count: data.count || 0,
      };
    },
    staleTime: 10 * 1000, // 10 seconds - short stale time for live data
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds as backup
  });
}

export function useEnvironmentConfig() {
  return useQuery({
    queryKey: ['environmentConfig'],
    queryFn: async () => {
      const data = await api.get('/admin/environment-config');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - environment config changes rarely
  });
}

export function useCacheConfig() {
  return useQuery({
    queryKey: ['cacheConfig'],
    queryFn: async () => {
      const data = await api.get('/admin/cache-config');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - cache config changes rarely
  });
}

export function useSentryIssues(filters) {
  return useQuery({
    queryKey: ['sentryIssues', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.environment && filters.environment !== 'all') {
        params.append('environment', filters.environment);
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      params.append('limit', filters.limit || 25);
      
      const data = await api.get(`/admin/sentry/issues?${params.toString()}`);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!filters,
  });
}

export function useSentryEnvironments() {
  return useQuery({
    queryKey: ['sentryEnvironments'],
    queryFn: async () => {
      const data = await api.get('/admin/sentry/environments');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSentryCurrentEnvironment() {
  return useQuery({
    queryKey: ['sentryCurrentEnvironment'],
    queryFn: async () => {
      const data = await api.get('/admin/sentry/current-environment');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSentryIssueDetails(issueId) {
  return useQuery({
    queryKey: ['sentryIssueDetails', issueId],
    queryFn: async () => {
      const data = await api.get(`/admin/sentry/issues/${issueId}`);
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!issueId,
  });
}

export function useSentryLatestEvent(issueId) {
  return useQuery({
    queryKey: ['sentryLatestEvent', issueId],
    queryFn: async () => {
      const data = await api.get(`/admin/sentry/issues/${issueId}/events/latest`);
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!issueId,
  });
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['adminProducts'],
    queryFn: async () => {
      const data = await api.get('/admin/products');
      return {
        products: data.products || [],
        total: data.total || 0,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - products don't change frequently
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const data = await api.get('/admin/users');
      return {
        users: data.users || [],
        total: data.total || 0,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - users don't change frequently
  });
}

export function useAnimalCategories() {
  return useQuery({
    queryKey: ['animalCategories'],
    queryFn: async () => {
      const data = await api.get('/admin/animal-categories');
      return data.animals || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - animal categories rarely change
  });
}

export function useDistinctFlavors() {
  return useQuery({
    queryKey: ['distinctFlavors'],
    queryFn: async () => {
      const data = await api.get('/admin/products/distinct-flavors');
      return {
        primaryFlavors: data.primaryFlavors || [],
        flavorDisplays: data.flavorDisplays || [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - flavors rarely change
  });
}

export function useUpdateProductMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData) => {
      const { productId, ...fields } = updateData;
      const data = await api.patch(`/admin/products/${productId}/metadata`, fields);
      return data;
    },
    onMutate: async (updateData) => {
      const { productId, ...fields } = updateData;
      
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['adminProducts'] });

      // Snapshot previous value for rollback
      const previousProducts = queryClient.getQueryData(['adminProducts']);

      // Optimistically update the product in cache
      queryClient.setQueryData(['adminProducts'], (old) => {
        // If cache is empty or not initialized, skip optimistic update
        // The mutation will refetch fresh data on success
        if (!old || !old.products || !Array.isArray(old.products)) {
          return old;
        }
        
        return {
          ...old,
          products: old.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  ...fields,
                }
              : product
          ),
        };
      });

      // Return context with snapshot for potential rollback
      return { previousProducts };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousProducts) {
        queryClient.setQueryData(['adminProducts'], context.previousProducts);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch to get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    },
  });
}

export function useFetchCoins() {
  return useQuery({
    queryKey: ['adminCoins'],
    queryFn: async () => {
      const data = await api.get('/admin/achievements');
      return {
        achievements: data.achievements || [],
        total: data.achievements?.length || 0,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useToggleCoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coinId) => {
      const data = await api.patch(`/admin/achievements/${coinId}/toggle`);
      return data;
    },
    onMutate: async (coinId) => {
      await queryClient.cancelQueries({ queryKey: ['adminCoins'] });
      const previousCoins = queryClient.getQueryData(['adminCoins']);

      queryClient.setQueryData(['adminCoins'], (old) => {
        if (!old || !old.achievements) return old;
        
        return {
          ...old,
          achievements: old.achievements.map((coin) =>
            coin.id === coinId
              ? { ...coin, isActive: coin.isActive ? 0 : 1 }
              : coin
          ),
        };
      });

      return { previousCoins };
    },
    onError: (err, variables, context) => {
      if (context?.previousCoins) {
        queryClient.setQueryData(['adminCoins'], context.previousCoins);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoins'] });
    },
  });
}

export function useDeleteCoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coinId) => {
      const data = await api.delete(`/admin/achievements/${coinId}`);
      return data;
    },
    onMutate: async (coinId) => {
      await queryClient.cancelQueries({ queryKey: ['adminCoins'] });
      const previousCoins = queryClient.getQueryData(['adminCoins']);

      queryClient.setQueryData(['adminCoins'], (old) => {
        if (!old || !old.achievements) return old;
        
        return {
          ...old,
          achievements: old.achievements.filter((coin) => coin.id !== coinId),
          total: (old.total || 0) - 1,
        };
      });

      return { previousCoins };
    },
    onError: (err, variables, context) => {
      if (context?.previousCoins) {
        queryClient.setQueryData(['adminCoins'], context.previousCoins);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoins'] });
    },
  });
}

export function useCreateCoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ coinData, iconFile }) => {
      let finalCoinData = { ...coinData };
      
      // If there's a custom image icon, upload it first
      if (iconFile) {
        const formData = new FormData();
        formData.append('icon', iconFile);
        
        const uploadResult = await api.upload('/admin/achievements/upload-icon', formData);
        
        if (uploadResult.tempUrl) {
          // Confirm the upload
          const confirmResult = await api.post('/admin/achievements/confirm-icon-upload', {
            tempUrl: uploadResult.tempUrl
          });
          
          finalCoinData.icon = confirmResult.iconUrl;
          finalCoinData.iconType = 'image';
        }
      }
      
      // Create the achievement
      const data = await api.post('/admin/achievements', finalCoinData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoins'] });
    },
  });
}

export function useRecalculateCoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coinId) => {
      const data = await api.post(`/admin/achievements/${coinId}/recalculate`);
      return data;
    },
    onSuccess: () => {
      // Invalidate all relevant caches after recalculation
      queryClient.invalidateQueries({ queryKey: ['adminCoins'] });
    },
  });
}

export function useUpdateCoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ coinId, coinData, iconFile }) => {
      let finalCoinData = { ...coinData };
      
      // If there's a new custom image icon, upload it first
      if (iconFile) {
        const formData = new FormData();
        formData.append('icon', iconFile);
        
        const uploadResult = await api.upload('/admin/achievements/upload-icon', formData);
        
        if (uploadResult.tempUrl) {
          // Confirm the upload
          const confirmResult = await api.post('/admin/achievements/confirm-icon-upload', {
            tempUrl: uploadResult.tempUrl
          });
          
          finalCoinData.icon = confirmResult.iconUrl;
          finalCoinData.iconType = 'image';
        }
      }
      
      // Update the achievement
      const data = await api.put(`/admin/achievements/${coinId}`, finalCoinData);
      return data;
    },
    onMutate: async ({ coinId, coinData }) => {
      await queryClient.cancelQueries({ queryKey: ['adminCoins'] });
      const previousCoins = queryClient.getQueryData(['adminCoins']);

      queryClient.setQueryData(['adminCoins'], (old) => {
        if (!old || !old.achievements) return old;
        
        return {
          ...old,
          achievements: old.achievements.map((coin) =>
            coin.id === coinId
              ? { ...coin, ...coinData }
              : coin
          ),
        };
      });

      return { previousCoins };
    },
    onError: (err, variables, context) => {
      if (context?.previousCoins) {
        queryClient.setQueryData(['adminCoins'], context.previousCoins);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoins'] });
    },
  });
}
