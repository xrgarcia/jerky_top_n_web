import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

/**
 * Fetch collection progress with contextual encouragement messages
 * REUSABLE across different contexts: 'available_products', 'coin_book', 'profile'
 * @param {string} context - The UI context for message tone
 * @returns {Object} Query result with progress data
 */
export function useCollectionProgress(context = 'available_products') {
  return useQuery({
    queryKey: ['collectionProgress', context],
    queryFn: async () => {
      const response = await api.get(`/gamification/collection-progress?context=${context}`);
      return response;
    },
    staleTime: 30000, // 30 seconds - fresh enough for real-time feel
    refetchOnMount: true,
  });
}
