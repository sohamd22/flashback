'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Photo {
  id: string;
  photo_id: string;
  url: string;
  description: string;
  score?: number;
  created_at?: string;
  user_id?: string;
}

export interface PhotoSearchResult {
  photos: Photo[];
  query: string;
  total_results: number;
}

export const usePhotoAPI = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPhotos = useCallback(async (query: string, topK = 10): Promise<PhotoSearchResult> => {
    if (!profile?.id) throw new Error('User not authenticated');

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search-photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.id,
          query,
          topK,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Photo search failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Photo search failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  return {
    loading,
    error,
    searchPhotos,
  };
};