import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useProducts({ search = '', sort = 'name', animal = '', flavor = '', page = 1, limit = 50 } = {}) {
  return useQuery({
    queryKey: ['products', { search, sort, animal, flavor, page, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (animal) params.set('animal', animal);
      if (flavor) params.set('flavor', flavor);
      params.set('page', page);
      params.set('limit', limit);

      const data = await api.get(`/products?${params.toString()}`);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProductDetail(productId) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}`);
      return data;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useProductDetailEnhanced(productId) {
  return useQuery({
    queryKey: ['productDetail', productId],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/detail`);
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes (shorter since it includes user-specific data)
  });
}

export function useRankableProducts({ excludeRanked = false } = {}) {
  return useQuery({
    queryKey: ['products', 'rankable', { excludeRanked }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (excludeRanked) params.set('excludeRanked', 'true');
      
      const data = await api.get(`/rank/products?${params.toString()}`);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProductDistribution(productId) {
  return useQuery({
    queryKey: ['productDistribution', productId],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/distribution`);
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProductTopFans(productId, limit = 9) {
  return useQuery({
    queryKey: ['productTopFans', productId, limit],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/top-fans?limit=${limit}`);
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProductOppositeProfiles(productId, limit = 9) {
  return useQuery({
    queryKey: ['productOppositeProfiles', productId, limit],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/opposite-profiles?limit=${limit}`);
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProductRelated(productId, limit = 4) {
  return useQuery({
    queryKey: ['productRelated', productId, limit],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/related?limit=${limit}`);
      return data;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useProductInsights(productId) {
  return useQuery({
    queryKey: ['productInsights', productId],
    queryFn: async () => {
      const data = await api.get(`/products/${productId}/insights`);
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
