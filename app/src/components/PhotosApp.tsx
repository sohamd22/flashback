'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePhotoAPI, Photo } from '@/hooks/usePhotoAPI';

interface PhotosAppProps {
  width: number;
  height: number;
  windowManager?: any;
}

export default function PhotosApp({ width, height, windowManager }: PhotosAppProps) {
  const { profile } = useAuth();
  const { searchPhotos, loading, error } = usePhotoAPI();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return; // Don't search with empty query
    }

    setHasSearched(true);
    try {
      const result = await searchPhotos(searchQuery, 20);
      setPhotos(result.photos);
    } catch (err) {
      console.error('Error searching photos:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white">
        <div className="text-center" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">INITIALIZING PHOTO SYSTEM</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-200" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Windows-style title bar */}
      <div className="bg-blue-800 text-white px-1 py-1 text-xs flex items-center">
        <span>📷 Photos - {profile.name || 'User'}</span>
      </div>

      {/* Menu bar */}
      <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 text-xs">
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">File</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">Edit</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">View</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">Help</span>
      </div>

      {/* Search bar */}
      <div className="bg-gray-200 border-b border-gray-400 px-2 py-2 flex items-center gap-2">
        <span className="text-xs text-gray-800">Search:</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Describe what you're looking for..."
          className="flex-1 px-2 py-1 bg-white border border-gray-400 text-xs text-gray-800"
          style={{ boxShadow: 'inset 1px 1px 0 gray' }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-3 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-300 text-xs text-gray-800 disabled:opacity-50"
          style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}
        >
          {loading ? '⏳' : '🔍'} Search
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto bg-white border border-gray-400 p-2" style={{ boxShadow: 'inset 1px 1px 0 gray' }}>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 mb-2 text-xs">
            Error: {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="text-gray-600 mb-2">⏳</div>
              <div className="text-xs text-gray-600">Searching photos...</div>
            </div>
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-600">
              <div className="text-4xl mb-4">📷</div>
              <div className="text-sm font-bold mb-2">Welcome to Photos</div>
              <div className="text-xs max-w-md">
                Search for your photos using natural language.
                <br />
                Try queries like "sunset", "people smiling", "food",
                <br />
                "outdoor scenes", or any description you can think of!
              </div>
            </div>
          </div>
        )}

        {!loading && hasSearched && photos.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-gray-600">
              <div className="mb-2">📷</div>
              <div className="text-xs">No photos found</div>
              <div className="text-xs mt-1">Try a different search</div>
            </div>
          </div>
        )}

        {/* Photo grid */}
        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group cursor-pointer border-2 border-gray-300 hover:border-blue-500"
                onClick={() => setSelectedPhoto(photo)}
                style={{ aspectRatio: '1' }}
              >
                {/* Photo thumbnail */}
                <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.description || 'Photo'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`${photo.url ? 'hidden' : ''} text-4xl text-gray-500`}>
                    📷
                  </div>
                </div>

                {/* Hover overlay with info */}
                <div className="absolute inset-0 bg-black bg-opacity-75 opacity-0 group-hover:opacity-100 transition-opacity p-1 flex flex-col justify-end">
                  <div className="text-white text-xs">
                    {photo.description && (
                      <div className="line-clamp-2 mb-1">{photo.description}</div>
                    )}
                    {photo.score && (
                      <div className="text-yellow-400">Score: {(photo.score * 100).toFixed(0)}%</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected photo modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            onClick={() => setSelectedPhoto(null)}
          >
            <div
              className="bg-gray-200 border-2 border-gray-800 max-w-4xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ boxShadow: 'inset 2px 2px 0 white, inset -2px -2px 0 #404040' }}
            >
              {/* Modal title bar */}
              <div className="bg-blue-800 text-white px-2 py-1 flex items-center justify-between text-xs">
                <span>📷 Photo Viewer</span>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="bg-gray-300 text-black px-2 py-0 border border-gray-600 hover:bg-gray-400"
                  style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 #404040' }}
                >
                  ✕
                </button>
              </div>

              {/* Photo display */}
              <div className="p-4">
                {selectedPhoto.url ? (
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.description || 'Photo'}
                    className="max-w-full max-h-[60vh] mx-auto"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-300">
                    <span className="text-6xl text-gray-500">📷</span>
                  </div>
                )}

                {/* Photo details */}
                <div className="mt-4 bg-white border border-gray-400 p-2">
                  <div className="text-xs text-gray-800">
                    <div className="mb-1">
                      <strong>ID:</strong> {selectedPhoto.photo_id}
                    </div>
                    {selectedPhoto.description && (
                      <div className="mb-1">
                        <strong>Description:</strong> {selectedPhoto.description}
                      </div>
                    )}
                    {selectedPhoto.score && (
                      <div className="mb-1">
                        <strong>Relevance Score:</strong> {(selectedPhoto.score * 100).toFixed(0)}%
                      </div>
                    )}
                    {selectedPhoto.created_at && (
                      <div>
                        <strong>Date:</strong> {new Date(selectedPhoto.created_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-gray-200 border-t border-gray-400 px-2 py-1 flex items-center justify-between text-xs">
        <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        <span>{searchQuery ? `Search: "${searchQuery}"` : 'All Photos'}</span>
      </div>
    </div>
  );
}