import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

/**
 * Fetch ranking progress commentary from backend CommentaryService
 */
export function useRankingCommentary() {
  return useQuery({
    queryKey: ['rankingCommentary'],
    queryFn: async () => {
      const data = await api.get('/gamification/ranking-progress-commentary');
      return data;
    },
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });
}
