'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface VideoClip {
  id: string;
  chunk_id: string;
  video_id: string;
  video_url: string;
  url: string; // proxied URL
  originalUrl: string;
  query?: string;
  score?: number;
  created_at?: string;
}

export interface SearchResult {
  clips: VideoClip[];
  query: string;
  total_results: number;
}

export const useVideoAPI = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = useCallback(async (videoFile: File) => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('userId', profile.id);
      formData.append('video', videoFile);

      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const searchVideos = useCallback(async (query: string, topK = 10): Promise<SearchResult> => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-query', {
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
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const listAllVideos = useCallback(async (topK = 50): Promise<VideoClip[]> => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/retrieve-clips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profile.id,
          query: '',
          top_k: topK,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load videos');
      }

      const data = await response.json();
      return data.clips || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load videos';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const listFavorites = useCallback(async (): Promise<VideoClip[]> => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/favorites/list?userId=${profile.id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load favorites');
      }

      const data = await response.json();
      return data.favorites || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load favorites';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const listFavoritesId = useCallback(async (id: string): Promise<VideoClip[]> => {
    if (!id)  throw new Error('User not provided');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/favorites/list?userId=${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load favorites');
      }

      const data = await response.json();
      return data.favorites || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load favorites';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addToFavorites = useCallback(async (chunkId: string, videoId: string, videoUrl: string, query?: string, score?: number) => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/favorites/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.id,
          chunkId,
          videoId,
          videoUrl,
          query,
          score,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add to favorites');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add to favorites';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const removeFromFavorites = useCallback(async (chunkId: string) => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/favorites/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.id,
          chunkId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove from favorites');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove from favorites';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const checkFavorites = useCallback(async (chunkIds: string[]) => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/favorites/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile.id,
          chunkIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check favorites');
      }

      const data = await response.json();
      return data.favorites || {};
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check favorites';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  return {
    loading,
    error,
    uploadVideo,
    searchVideos,
    listAllVideos,
    listFavorites,
    addToFavorites,
    listFavoritesId,
    removeFromFavorites,
    checkFavorites,
  };
};