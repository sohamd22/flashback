'use client';

import { useState, useEffect } from 'react';
import { useVideoAPI, VideoClip } from '@/hooks/useVideoAPI';
import RetroVideoPlayer from './RetroVideoPlayer';

interface UserProfileWindowProps {
  userId: string;
  userName: string;
  userPhoto: string;
  width: number;
  height: number;
}

export default function UserProfileWindow({
  userId,
  userName,
  userPhoto,
  width,
  height
}: UserProfileWindowProps) {
  const { listFavorites } = useVideoAPI();
  const [favoriteVideos, setFavoriteVideos] = useState<VideoClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoClip | null>(null);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        // For now, load the current user's favorites as demo data
        // In a real app, you'd fetch favorites for the specific userId
        const favorites = await listFavorites();
        setFavoriteVideos(favorites.slice(0, 6)); // Show max 6 videos
        setError(null);
      } catch (err) {
        console.error('Error loading user favorites:', err);
        setError('Failed to load favorite videos');
        setFavoriteVideos([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [userId, listFavorites]);

  return (
    <div className="h-full bg-gray-100 flex flex-col" style={{ fontFamily: 'Minecraft', fontSize: '12px' }}>
      {/* Header with user info */}
      <div className="bg-blue-600 text-white p-4 border-b-2 border-gray-400">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={userPhoto}
              alt={userName}
              className="w-16 h-16 border-2 border-white object-cover"
              style={{ 
                imageRendering: 'pixelated',
                boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,0.8)'
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/icons/user.png';
              }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white" style={{ imageRendering: 'pixelated' }}>
              {userName}
            </h2>
            <p className="text-xs text-blue-200">Friend Profile</p>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase border-b border-gray-400 pb-1">
            📹 Favorite Videos
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-green-600 font-bold mb-1">LOADING...</div>
                <div className="text-xs text-gray-600">Fetching favorite videos</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-red-600 font-bold mb-1">ERROR</div>
                <div className="text-xs text-gray-600">{error}</div>
              </div>
            </div>
          ) : favoriteVideos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {favoriteVideos.map((video, index) => (
                <div
                  key={video.id || index}
                  className="bg-white border-2 border-gray-400 p-2 hover:bg-gray-50 cursor-pointer"
                  style={{
                    boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,1)',
                    imageRendering: 'pixelated'
                  }}
                  onClick={() => {
                    console.log('Video selected:', video);
                    if (video.url) {
                      setSelectedVideo(video);
                    } else {
                      console.error('Video has no URL:', video);
                    }
                  }}
                >
                  <div className="aspect-video bg-gray-800 border border-gray-600 mb-2 flex items-center justify-center hover:bg-gray-700 transition-colors">
                    {video.url ? (
                      <div className="text-center">
                        <div className="text-white text-2xl mb-1">🎬</div>
                        <div className="text-white text-xs">Click to Play</div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-red-400 text-2xl mb-1">❌</div>
                        <div className="text-red-400 text-xs">No URL</div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-800 font-bold truncate">
                    {video.query || `Video ${index + 1}`}
                  </div>
                  <div className="text-xs text-gray-600">
                    Clip {video.chunk_id?.slice(-4) || index + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-gray-600 font-bold mb-1">NO FAVORITES</div>
                <div className="text-xs text-gray-500">This user has no favorite videos yet</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats section */}
        <div className="mt-6 pt-4 border-t border-gray-400">
          <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase">
            📊 Profile Stats
          </h3>
          <div className="bg-white border-2 border-gray-400 p-3" style={{
            boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,1)',
            imageRendering: 'pixelated'
          }}>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-gray-600">Favorite Videos:</div>
                <div className="font-bold text-gray-800">{favoriteVideos.length}</div>
              </div>
              <div>
                <div className="text-gray-600">Connection:</div>
                <div className="font-bold text-green-600">FRIEND</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video player modal */}
      {selectedVideo && selectedVideo.url && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedVideo(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <RetroVideoPlayer
              video={{
                ...selectedVideo,
                url: selectedVideo.url,
                query: selectedVideo.query || `Favorite Video`
              }}
              width={Math.min(480, width - 40)}
              height={Math.min(360, height - 120)}
              onClose={() => setSelectedVideo(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}