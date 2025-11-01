import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

// Simplified rankings hook - direct saves without complex queue
export function useRankings() {
  const queryClient = useQueryClient();
  const [rankings, setRankings] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);
  const pendingRankingsRef = useRef(null);

  const loadRankings = useCallback(async () => {
    try {
      const data = await api.get('/rankings/products');
      setRankings(data.rankings || []);
    } catch (error) {
      console.error('Failed to load rankings:', error);
    }
  }, []);

  const saveRankingsToServer = useCallback(async (rankingsToSave) => {
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveMessage('⏳ Saving...');

    try {
      const idempotencyKey = `ranking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await api.post('/rankings/products', {
        rankingListId: 'default',
        rankings: rankingsToSave
      }, {
        headers: {
          'X-Idempotency-Key': idempotencyKey
        }
      });

      setSaveStatus('saved');
      setSaveMessage('✓ Saved');
      
      // Clear success message after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 2000);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['achievements'] });
      
      console.log(`✅ Saved ${rankingsToSave.length} rankings`);
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage('❌ Save failed');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [queryClient]);

  const updateRankings = useCallback((newRankings) => {
    setRankings(newRankings);
    pendingRankingsRef.current = newRankings;

    // Debounce saves - wait 500ms after last change
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (pendingRankingsRef.current) {
        saveRankingsToServer(pendingRankingsRef.current);
        pendingRankingsRef.current = null;
      }
    }, 500);
  }, [saveRankingsToServer]);

  const clearAllRankings = useCallback(async () => {
    const confirmed = window.confirm('Are you sure you want to clear all your rankings?');
    if (!confirmed) return;

    setRankings([]);
    await saveRankingsToServer([]);
  }, [saveRankingsToServer]);

  const waitForPendingSaves = useCallback(async () => {
    // If there's a pending debounced save, trigger it immediately
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      if (pendingRankingsRef.current) {
        await saveRankingsToServer(pendingRankingsRef.current);
        pendingRankingsRef.current = null;
      }
    }

    // Wait for any active save to complete
    while (isSaving) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [isSaving, saveRankingsToServer]);

  const hasPendingSaves = useCallback(() => {
    return isSaving || pendingRankingsRef.current !== null;
  }, [isSaving]);

  return {
    rankings,
    updateRankings,
    loadRankings,
    clearAllRankings,
    saveStatus,
    saveMessage,
    waitForPendingSaves,
    hasPendingSaves
  };
}
