import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/api';

/**
 * Fetch ranking progress commentary from backend CommentaryService
 */
export function useRankingCommentary() {
  return useQuery({
    queryKey: ['rankingCommentary'],
    queryFn: async () => {
      const response = await apiClient('/api/gamification/ranking-progress-commentary');
      return response;
    },
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });
}
