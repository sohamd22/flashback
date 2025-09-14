'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RealVideoGraphCanvas from '@/components/RealVideoGraphCanvas';
import RetroVideoPlayer from '@/components/RetroVideoPlayer';
import { useVideoAPI, VideoClip } from '@/hooks/useVideoAPI';

interface FileExplorerProps {
  width: number;
  height: number;
  onOpenGraphWindow?: (title: string, content: React.ReactNode, icon: string, customWidth?: number, customHeight?: number) => void;
}

interface FolderItem {
  id: string;
  name: string;
  type: 'folder';
  icon: string;
  videoCount: number;
  lastModified: string;
}

export default function FileExplorer({ width, height, onOpenGraphWindow }: FileExplorerProps) {
  // width and height are passed through to child components via windowManager
  const { profile } = useAuth();
  const { listFavorites } = useVideoAPI();
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [lastFavoriteDate, setLastFavoriteDate] = useState('2024-01-01');

  // Load favorites metadata
  useEffect(() => {
    const loadFavoritesData = async () => {
      try {
        const favorites = await listFavorites();
        setFavoritesCount(favorites.length);
        
        if (favorites.length > 0) {
          const latestDate = favorites.reduce((latest, fav) => {
            const favDate = fav.created_at || '2024-01-01';
            return new Date(favDate) > new Date(latest) ? favDate : latest;
          }, favorites[0].created_at || '2024-01-01');
          setLastFavoriteDate(latestDate);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    };

    if (profile?.id) {
      loadFavoritesData();
    }
  }, [profile?.id, listFavorites]);
  
  const folders: FolderItem[] = [
    {
      id: 'default',
      name: 'Default',
      type: 'folder',
      icon: '📁',
      videoCount: -1, // Unknown for default folder - could be many based on search
      lastModified: new Date().toISOString().split('T')[0] // Today's date
    },
    {
      id: 'favourite',
      name: 'Favourite',
      type: 'folder', 
      icon: '⭐',
      videoCount: favoritesCount,
      lastModified: lastFavoriteDate
    }
  ];





  // Root folder view with Windows-style folder icons
  return (
    <div className="h-full flex flex-col bg-gray-200" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Windows-style title bar */}
      <div className="bg-blue-800 text-white px-1 py-1 text-xs flex items-center">
        <span>📁 Videos - File Explorer</span>
      </div>
      
      {/* Menu bar */}
      <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 text-xs">
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">File</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">Edit</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">View</span>
        <span className="px-2 py-1 text-gray-800 hover:bg-blue-600 hover:text-white cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-200 border-b border-gray-400 px-1 py-1 flex items-center gap-1">
        <button className="px-2 py-1 border text-gray-800 border-gray-400 bg-gray-100 hover:bg-gray-300 text-xs"
                style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}>
          ⬅️ Back
        </button>
        <button className="px-2 py-1 border text-gray-800 border-gray-400 bg-gray-100 hover:bg-gray-300 text-xs"
                style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}>
          ⬆️ Up
        </button>
      </div>

      {/* Address bar */}
      <div className="bg-gray-200 text-gray-800 border-b border-gray-400 px-2 py-1 flex items-center gap-2 text-xs">
        <span>Address:</span>
        <div className="flex-1 bg-white border text-gray-800 border-gray-400 px-2 py-1" style={{ boxShadow: 'inset 1px 1px 0 gray' }}>
          C:\Videos
        </div>
      </div>
      
      {/* Folder list view */}
      <div className="flex-1 overflow-auto bg-white border text-gray-800 border-gray-400" style={{ boxShadow: 'inset 1px 1px 0 gray' }}>
        <div className="p-2">
          {/* List header */}
          <div className="flex items-center px-2 py-1 bg-gray-200 border text-gray-800 border-gray-400 text-xs font-bold uppercase"
               style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}>
            <div className="w-8"></div>
            <div className="flex-1 px-2">Name</div>
            <div className="w-20 px-2">Size</div>
            <div className="w-24 px-2">Modified</div>
          </div>
          
          {/* Folder items */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center px-2 py-2 cursor-pointer hover:bg-blue-200 border-b border-gray-300"
              onDoubleClick={() => {
                if (onOpenGraphWindow && profile) {
                  const windowWidth = Math.min(width || 1200, typeof window !== 'undefined' ? window.innerWidth - 100 : 1200);
                  const windowHeight = Math.min(height || 800, typeof window !== 'undefined' ? window.innerHeight - 120 : 800);
                  
                  // Create a wrapper component with search functionality
                  const GraphWrapper = () => {
                    const [searchQuery, setSearchQuery] = useState('');
                    const [uploadFile, setUploadFile] = useState<File | null>(null);
                    const { loading, error, uploadVideo, searchVideos, listAllVideos, listFavorites } = useVideoAPI();
                    const [videos, setVideos] = useState<VideoClip[]>([]);

                    // Load initial videos
                    useEffect(() => {
                      const loadInitialVideos = async () => {
                        try {
                          if (folder.id === 'favourite') {
                            const favs = await listFavorites();
                            setVideos(favs);
                          } else {
                            const allVideos = await listAllVideos();
                            setVideos(allVideos);
                          }
                        } catch (err) {
                          console.error('Error loading initial videos:', err);
                        }
                      };

                      loadInitialVideos();
                    }, [folder.id, listAllVideos, listFavorites]);

                    const handleSearch = async (query?: string) => {
                      if (folder.id === 'favourite') return;
                      
                      const searchTerm = (query != null ? String(query) : searchQuery != null ? String(searchQuery) : '');
                      try {
                        if (searchTerm.trim()) {
                          const results = await searchVideos(searchTerm, 3);
                          setVideos(results.clips);
                        } else {
                          const allVideos = await listAllVideos();
                          setVideos(allVideos);
                        }
                      } catch (err) {
                        console.error('Search error:', err);
                      }
                    };

                    const handleUpload = async (file: File) => {
                      try {
                        await uploadVideo(file);
                        setUploadFile(null);
                        // Refresh videos after upload
                        if (folder.id === 'favourite') return;
                        const allVideos = await listAllVideos();
                        setVideos(allVideos);
                      } catch (err) {
                        console.error('Upload error:', err);
                      }
                    };

                    return (
                      <div className="h-full flex flex-col">
                        {/* Search bar in taskbar area */}
                        {folder.id !== 'favourite' && (
                          <div className="bg-gray-200 border-b border-gray-400 px-2 py-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search videos..."
                              className="flex-1 px-3 py-1 border-2 border-gray-600 text-gray-800 text-xs"
                              style={{ 
                                fontFamily: 'monospace',
                                imageRendering: 'pixelated',
                                boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)'
                              }}
                            />
                            <button
                              onClick={() => handleSearch()}
                              disabled={loading}
                              className="px-3 py-1 bg-blue-600 border-2 border-blue-400 text-white text-xs hover:bg-blue-500 disabled:opacity-50 font-bold"
                              style={{ imageRendering: 'pixelated' }}
                            >
                              [SEARCH]
                            </button>
                            {loading && <div className="text-blue-600 text-xs font-bold">[PROCESSING...]</div>}
                            {error && <div className="text-red-600 text-xs font-bold">[ERROR]</div>}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <RealVideoGraphCanvas 
                            user={profile}
                            width={windowWidth - 20}
                            height={windowHeight - (folder.id !== 'favourite' ? 100 : 60)}
                            favouritesOnly={folder.id === 'favourite'}
                            onUpload={handleUpload}
                            uploadFile={uploadFile}
                            loading={loading}
                            error={error}
                            externalVideos={videos}
                            onOpenVideoPlayer={(video) => {
                              if (onOpenGraphWindow) {
                                const playerWidth = 600;
                                const playerHeight = 400;
                                
                                // RetroVideoPlayer adds 20px width and 80px height for its own chrome
                                const playerComponentWidth = playerWidth + 20;
                                const playerComponentHeight = playerHeight + 80;
                                
                                // Window component adds title bar (40px) and some padding
                                const windowWidth = playerComponentWidth + 8; // 4px border on each side
                                const windowHeight = playerComponentHeight + 40 + 8; // title bar + borders
                                
                                // Cast to the extended function signature
                                const openWindowWithCustomSize = onOpenGraphWindow as (
                                  title: string, 
                                  content: React.ReactNode, 
                                  icon: string, 
                                  customWidth?: number, 
                                  customHeight?: number
                                ) => void;
                                
                                openWindowWithCustomSize(
                                  `🎬 Video Player`,
                                  <RetroVideoPlayer
                                    video={video}
                                    width={playerWidth}
                                    height={playerHeight}
                                    onClose={() => {}} // Window will handle close
                                    onToggleFavorite={() => {}} // Could implement if needed
                                    isFavorite={false}
                                  />,
                                  "/icons/blackhole.png",
                                  windowWidth,
                                  windowHeight
                                );
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  };

                  onOpenGraphWindow(
                    folder.name === 'favourite' ? '⭐ Favourite Videos - Memory Graph' : '🎬 All Videos - Memory Graph',
                    <GraphWrapper />,
                    folder.icon === '⭐' ? "/icons/blackhole.png" : "/icons/blackhole.png"
                  );
                }
              }}
              style={{ fontFamily: 'monospace', fontSize: '11px' }}
            >
              {/* Folder icon - pixel art style */}
              <div className="w-8 h-6 flex items-center justify-center mr-2">
                <div className="w-6 h-5 flex items-center justify-center bg-yellow-400 border border-black"
                     style={{ 
                       boxShadow: '1px 1px 0 #000, inset 1px 1px 0 #fff',
                       imageRendering: 'pixelated'
                     }}>
                  <span className="text-xs leading-none">{folder.icon}</span>
                </div>
              </div>
              
              {/* Folder name */}
              <div className="flex-1 px-2 text-black font-bold text-xs uppercase truncate" style={{
                textShadow: '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(255,255,255,0.8)'
              }}>
                {folder.name}
              </div>
              
              {/* Video count as size */}
              <div className="w-20 px-2 text-gray-700 text-xs" style={{
                textShadow: '1px 1px 0px rgba(255,255,255,0.8)'
              }}>
                {folder.videoCount === -1 ? 'Many' : `${folder.videoCount} video${folder.videoCount !== 1 ? 's' : ''}`}
              </div>
              
              {/* Last modified date */}
              <div className="w-24 px-2 text-gray-700 text-xs" style={{
                textShadow: '1px 1px 0px rgba(255,255,255,0.8)'
              }}>
                {new Date(folder.lastModified).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-200 border-t border-gray-400 px-2 py-1 flex items-center justify-between text-xs">
        <span style={{ fontFamily: 'monospace' }}>
          {folders.length} object{folders.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontFamily: 'monospace' }}>
          My Computer
        </span>
      </div>
    </div>
  );
}