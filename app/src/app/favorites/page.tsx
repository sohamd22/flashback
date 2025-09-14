'use client';

import { useState } from 'react';

interface FavoriteClip {
  id: string;
  user_id: string;
  chunk_id: string;
  video_id: string;
  video_url: string;
  query?: string;
  score?: number;
  created_at: string;
  url: string;
  originalUrl: string;
}

export default function FavoritesPage() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState<FavoriteClip[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingFavorite, setRemovingFavorite] = useState<string | null>(null);

  const loadFavorites = async () => {
    if (!userId) {
      setError('Please enter a User ID');
      return;
    }

    setLoading(true);
    setError('');
    setFavorites([]);
    setSelectedVideo(null);

    try {
      const response = await fetch(`/api/favorites/list?userId=${encodeURIComponent(userId)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load favorites');
      }

      const data = await response.json();
      setFavorites(data.favorites);

      // Auto-select first video if available
      if (data.favorites.length > 0) {
        setSelectedVideo(data.favorites[0].url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (chunkId: string) => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setRemovingFavorite(chunkId);

    try {
      const response = await fetch('/api/favorites/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          chunkId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove favorite');
      }

      // Remove from local state
      setFavorites(prev => prev.filter(fav => fav.chunk_id !== chunkId));

      // If we removed the currently playing video, clear selection
      const removedFav = favorites.find(fav => fav.chunk_id === chunkId);
      if (removedFav && selectedVideo === removedFav.url) {
        setSelectedVideo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove favorite');
    } finally {
      setRemovingFavorite(null);
    }
  };

  // Filter favorites based on search query
  const filteredFavorites = favorites.filter(fav => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      fav.query?.toLowerCase().includes(query) ||
      fav.chunk_id.toLowerCase().includes(query) ||
      fav.video_id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-light mb-8">Favorite Clips</h1>

        {/* User ID Input and Load Button */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
                placeholder="Enter user ID to view favorites"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadFavorites();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadFavorites}
                disabled={loading || !userId}
                className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Load Favorites'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {favorites.length > 0 && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-medium">
                  {filteredFavorites.length} Favorite{filteredFavorites.length !== 1 ? 's' : ''}
                </h2>

                {/* Search Filter */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500"
                  placeholder="Search favorites..."
                />
              </div>

              {/* Video Player */}
              {selectedVideo && (
                <div className="mb-6">
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      key={selectedVideo}
                      controls
                      autoPlay
                      className="w-full max-h-[500px]"
                      src={selectedVideo}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              {/* Favorites Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFavorites.map((favorite) => (
                  <div
                    key={favorite.id}
                    className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-700 ${
                      selectedVideo === favorite.url ? 'ring-2 ring-white' : ''
                    }`}
                    onClick={() => setSelectedVideo(favorite.url)}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-gray-400">
                          {favorite.chunk_id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(favorite.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {favorite.query && (
                        <div className="text-sm text-gray-300">
                          Query: "{favorite.query}"
                        </div>
                      )}

                      {favorite.score && (
                        <div className="text-xs px-2 py-1 bg-green-900/50 text-green-300 rounded inline-block">
                          Score: {(favorite.score * 100).toFixed(1)}%
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        Video ID: {favorite.video_id.slice(0, 12)}...
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          className="flex-1 py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVideo(favorite.url);
                          }}
                        >
                          Play Video
                        </button>
                        <button
                          className={`py-1 px-2 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors text-white ${
                            removingFavorite === favorite.chunk_id
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(favorite.chunk_id);
                          }}
                          disabled={removingFavorite === favorite.chunk_id}
                          title="Remove from favorites"
                        >
                          {removingFavorite === favorite.chunk_id ? '...' : '❌'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredFavorites.length === 0 && searchQuery && (
                <p className="text-gray-500 text-center py-8">
                  No favorites match your search.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && favorites.length === 0 && userId && (
          <div className="bg-gray-900 rounded-lg p-12 text-center">
            <p className="text-gray-500">
              No favorites found for this user. Start by searching for clips and marking them as favorites!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}