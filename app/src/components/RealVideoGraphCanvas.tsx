'use client';

import { useState, useRef, useEffect } from 'react';
import { useVideoAPI, VideoClip } from '@/hooks/useVideoAPI';
import { User } from '@/lib/auth';

interface RealVideoGraphCanvasProps {
  user: User;
  width: number;
  height: number;
  favouritesOnly?: boolean;
  onOpenVideoPlayer?: (video: VideoClip) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  onUpload?: (file: File) => void;
  uploadFile?: File | null;
  loading?: boolean;
  error?: string | null;
  externalVideos?: VideoClip[];
}

export default function RealVideoGraphCanvas({ 
  user, 
  width, 
  height, 
  favouritesOnly = false,
  onOpenVideoPlayer,
  searchQuery: externalSearchQuery = '',
  onSearchQueryChange,
  onSearch,
  onUpload,
  uploadFile: externalUploadFile = null,
  loading: externalLoading = false,
  error: externalError = null,
  externalVideos = null
}: RealVideoGraphCanvasProps) {
  // Use internal state as fallback if external props are not provided
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalUploadFile, setInternalUploadFile] = useState<File | null>(null);
  
  const searchQuery = onSearchQueryChange ? externalSearchQuery : internalSearchQuery;
  const uploadFile = onUpload ? externalUploadFile : internalUploadFile;
  
  const [internalVideos, setInternalVideos] = useState<VideoClip[]>([]);
  
  // Use external videos if provided, otherwise use internal state
  const videos = externalVideos || internalVideos;
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    nodeId: string | null;
    offset: { x: number; y: number };
    originalPosition: { x: number; y: number };
    hasDragged: boolean;
  }>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 },
    originalPosition: { x: 0, y: 0 },
    hasDragged: false
  });
  
  const [isDragOver, setIsDragOver] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const animationRef = useRef<number>(0);
  
  const { 
    loading: internalLoading, 
    error: internalError, 
    uploadVideo, 
    searchVideos, 
    listAllVideos,
    listFavorites, 
    addToFavorites, 
    removeFromFavorites, 
    checkFavorites 
  } = useVideoAPI();
  
  const loading = externalLoading || internalLoading;
  const error = externalError || internalError;

  // Load initial data (only if not using external videos)
  useEffect(() => {
    if (externalVideos) return; // Don't load if external videos are provided
    
    const loadData = async () => {
      try {
        if (favouritesOnly) {
          const favs = await listFavorites();
          setInternalVideos(favs);
        } else {
          // For default view, load all videos
          const allVideos = await listAllVideos();
          setInternalVideos(allVideos);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, [favouritesOnly, listFavorites, listAllVideos, externalVideos]);

  // Check favorites status for current videos
  useEffect(() => {
    const checkFavs = async () => {
      if (videos.length > 0) {
        try {
          const chunkIds = videos.map(v => v.chunk_id);
          const favStatus = await checkFavorites(chunkIds);
          setFavorites(favStatus);
        } catch (err) {
          console.error('Error checking favorites:', err);
        }
      }
    };

    if (!favouritesOnly) {
      checkFavs();
    }
  }, [videos, checkFavorites, favouritesOnly]);

  // Handle manual search (triggered by search button)
  const handleSearch = async () => {
    if (favouritesOnly) return;
    
    if (onSearch) {
      // Use external search handler
      onSearch(searchQuery);
    } else {
      // Use internal search logic
      try {
        if (searchQuery.trim()) {
          const results = await searchVideos(searchQuery, 20);
          setInternalVideos(results.clips);
        } else {
          // When search is cleared, reload all videos
          const allVideos = await listAllVideos();
          setInternalVideos(allVideos);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    if (onUpload) {
      // Use external upload handler
      onUpload(uploadFile);
    } else {
      // Use internal upload logic
      try {
        await uploadVideo(uploadFile);
        setInternalUploadFile(null);
        // Refresh the current view
        if (favouritesOnly) {
          const favs = await listFavorites();
          setInternalVideos(favs);
        } else {
          const allVideos = await listAllVideos();
          setInternalVideos(allVideos);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
  };

  const handleToggleFavorite = async (video: VideoClip) => {
    const isFav = favorites[video.chunk_id];
    
    try {
      if (isFav) {
        await removeFromFavorites(video.chunk_id);
        setFavorites(prev => ({ ...prev, [video.chunk_id]: false }));
        
        // If we're in favorites view, remove from the list
        if (favouritesOnly && !externalVideos) {
          setInternalVideos(prev => prev.filter(v => v.chunk_id !== video.chunk_id));
        }
      } else {
        await addToFavorites(
          video.chunk_id, 
          video.video_id, 
          video.originalUrl || video.video_url,
          video.query,
          video.score
        );
        setFavorites(prev => ({ ...prev, [video.chunk_id]: true }));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const positionVideos = (videoList: VideoClip[]) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    return videoList.map((video, index) => {
      const angle = (index / videoList.length) * 2 * Math.PI;
      const distance = radius + (Math.random() - 0.5) * 100;
      
      return {
        ...video,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
      };
    });
  };

  const [positionedVideos, setPositionedVideos] = useState<(VideoClip & { x: number; y: number })[]>([]);

  // Update positioned videos when videos change
  useEffect(() => {
    setPositionedVideos(positionVideos(videos));
  }, [videos, width, height]);

  // Drag handlers
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.nodeId) return;

    // Mark that we have actually dragged
    setDragState(prev => ({ ...prev, hasDragged: true }));

    const rect = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragState.offset.x;
    const newY = e.clientY - rect.top - dragState.offset.y;

    const nodeSize = 60;
    const constrainedX = Math.max(nodeSize/2, Math.min(width - nodeSize/2, newX));
    const constrainedY = Math.max(nodeSize/2, Math.min(height - nodeSize/2, newY));

    setPositionedVideos(prevVideos =>
      prevVideos.map(video =>
        video.chunk_id === dragState.nodeId ? { ...video, x: constrainedX, y: constrainedY } : video
      )
    );
  };

  const handleMouseUp = () => {
    if (!dragState.isDragging || !dragState.nodeId) return;

    const currentVideo = positionedVideos.find(v => v.chunk_id === dragState.nodeId);
    if (currentVideo) {
      // Animate back to original position
      const originalVideos = positionVideos(videos);
      const originalVideo = originalVideos.find(v => v.chunk_id === dragState.nodeId);
      
      if (originalVideo) {
        animateVideoBack(dragState.nodeId, { x: currentVideo.x, y: currentVideo.y }, { x: originalVideo.x, y: originalVideo.y });
      }
    }

    setDragState({
      isDragging: false,
      nodeId: dragState.nodeId, // Keep nodeId temporarily
      offset: { x: 0, y: 0 },
      originalPosition: { x: 0, y: 0 },
      hasDragged: dragState.hasDragged // Keep hasDragged temporarily
    });

    // Clear the drag state completely after a short delay
    setTimeout(() => {
      setDragState(prev => ({
        ...prev,
        nodeId: null,
        hasDragged: false
      }));
    }, 200);
  };

  const animateVideoBack = (videoId: string, currentPos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    const startTime = performance.now();
    const duration = 600;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutElastic = (t: number) => {
        const c4 = (2 * Math.PI) / 4.5;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1;
      };

      const easedProgress = easeOutElastic(progress);
      const newX = currentPos.x + (targetPos.x - currentPos.x) * easedProgress;
      const newY = currentPos.y + (targetPos.y - currentPos.y) * easedProgress;

      setPositionedVideos(prevVideos =>
        prevVideos.map(video =>
          video.chunk_id === videoId ? { ...video, x: newX, y: newY } : video
        )
      );

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };

  // Drag and drop handlers for file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      if (onUpload) {
        onUpload(videoFile);
      } else {
        setInternalUploadFile(videoFile);
        handleUpload();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onUpload) {
        onUpload(file);
      } else {
        setInternalUploadFile(file);
        handleUpload();
      }
    }
  };

  return (
    <div 
      className="relative"
      style={{ width, height, imageRendering: 'pixelated' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Pixelated sky background with sun and clouds */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #87ceeb 0%, #e0f6ff 40%, #ffffff 100%)',
          zIndex: 0
        }}
      />
      
      {/* Pixelated sun */}
      <div 
        className="absolute"
        style={{
          top: '120px',
          right: '60px',
          width: '60px',
          height: '60px',
          background: `
            radial-gradient(4px 4px at 8px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 16px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 24px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 32px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 40px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 16px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 16px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 24px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 24px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 32px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 32px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 40px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 40px, #ffd700, transparent),
            radial-gradient(4px 4px at 16px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 24px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 32px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 40px 48px, #ffd700, transparent),
            radial-gradient(8px 8px at 16px 16px, #ffed4e, transparent),
            radial-gradient(8px 8px at 32px 16px, #ffed4e, transparent),
            radial-gradient(8px 8px at 16px 32px, #ffed4e, transparent),
            radial-gradient(8px 8px at 32px 32px, #ffed4e, transparent),
            #ffd700
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'sunGlow 3s ease-in-out infinite alternate',
          zIndex: 1
        }}
      />
      
      {/* Pixelated clouds */}
      <div 
        className="absolute"
        style={{
          top: '100px',
          left: '100px',
          width: '80px',
          height: '40px',
          background: `
            radial-gradient(4px 4px at 16px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 24px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 32px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 40px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 48px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 56px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 12px 24px, #ffffff, transparent),
            radial-gradient(4px 4px at 60px 24px, #ffffff, transparent),
            radial-gradient(4px 4px at 8px 32px, #ffffff, transparent),
            radial-gradient(4px 4px at 64px 32px, #ffffff, transparent),
            radial-gradient(6px 6px at 20px 20px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 36px 20px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 52px 20px, #f8f9fa, transparent),
            rgba(255, 255, 255, 0.9)
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'cloudFloat 20s ease-in-out infinite',
          zIndex: 1
        }}
      />
      
      <div 
        className="absolute"
        style={{
          top: '140px',
          right: '300px',
          width: '60px',
          height: '30px',
          background: `
            radial-gradient(4px 4px at 12px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 20px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 28px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 36px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 44px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 8px 20px, #ffffff, transparent),
            radial-gradient(4px 4px at 48px 20px, #ffffff, transparent),
            radial-gradient(6px 6px at 18px 16px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 30px 16px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 42px 16px, #f8f9fa, transparent),
            rgba(255, 255, 255, 0.8)
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'cloudFloat 25s ease-in-out infinite reverse',
          zIndex: 1
        }}
      />
      
      <style jsx>{`
        @keyframes sunGlow {
          0% { filter: brightness(1) drop-shadow(0 0 10px #ffd700); }
          100% { filter: brightness(1.1) drop-shadow(0 0 20px #ffd700); }
        }
        
        @keyframes cloudFloat {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(30px); }
        }
      `}</style>

      {/* Clean pixelated user node in center */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{ 
          left: width / 2, 
          top: height / 2,
          zIndex: 10 
        }}
      >
        <div 
          className="w-20 h-20 border-4 border-gray-600 bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          style={{
            imageRendering: 'pixelated',
            boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 6px 6px 0px rgba(0,0,0,0.2)'
          }}
        >
          <img 
            src={user.profile_photo || '/icons/user.png'} 
            alt={user.name || 'User'}
            className="w-16 h-16"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <div 
          className="text-center text-gray-800 text-xs mt-2 font-bold bg-white border-3 border-gray-600 px-2 py-1"
          style={{
            fontFamily: 'monospace',
            imageRendering: 'pixelated',
            boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,1)'
          }}
        >
          {user.name || 'USER'}
        </div>
      </div>

      {/* Simple connection lines */}
      {positionedVideos.map((video) => (
        <svg
          key={`connection-${video.chunk_id}`}
          className="absolute pointer-events-none"
          style={{ 
            left: 0, 
            top: 0, 
            width: width, 
            height: height, 
            zIndex: 1
          }}
        >
          <line
            x1={width / 2}
            y1={height / 2}
            x2={video.x}
            y2={video.y}
            stroke="#9ca3af"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.3"
          />
        </svg>
      ))}

      {/* Draggable video nodes with thumbnails */}
      {positionedVideos.map((video, index) => {
        const isDragging = dragState.nodeId === video.chunk_id;
        return (
          <div
            key={video.chunk_id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
              left: video.x, 
              top: video.y,
              zIndex: isDragging ? 20 : 5,
              transform: isDragging ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%) scale(1)'
            }}
            onClick={(e) => {
              // Prevent video opening during or immediately after drag
              e.stopPropagation();
              
              setTimeout(() => {
                // Only open if we're not dragging and haven't dragged this node
                if (!dragState.isDragging && !(dragState.nodeId === video.chunk_id && dragState.hasDragged)) {
                  if (onOpenVideoPlayer) {
                    onOpenVideoPlayer(video);
                  }
                }
              }, 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
              
              if (!containerRect) return;

              // Reset drag state if clicking on a different node
              if (dragState.nodeId !== video.chunk_id) {
                setDragState({
                  isDragging: false,
                  nodeId: null,
                  offset: { x: 0, y: 0 },
                  originalPosition: { x: 0, y: 0 },
                  hasDragged: false
                });
              }

              setDragState({
                isDragging: true,
                nodeId: video.chunk_id,
                offset: {
                  x: e.clientX - containerRect.left - video.x,
                  y: e.clientY - containerRect.top - video.y
                },
                originalPosition: { x: video.x, y: video.y },
                hasDragged: false
              });

              if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
              }
            }}
          >
            {/* Clean pixelated video node with thumbnail */}
            <div className="relative">
              <div 
                className={`w-16 h-16 border-4 flex items-center justify-center hover:scale-105 transition-transform overflow-hidden ${
                  favorites[video.chunk_id] 
                    ? 'border-yellow-600' 
                    : 'border-blue-600'
                }`}
                style={{
                  imageRendering: 'pixelated',
                  boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.2)',
                  background: favorites[video.chunk_id] ? 'linear-gradient(135deg, #fef3c7, #fbbf24)' : 'linear-gradient(135deg, #bfdbfe, #3b82f6)'
                }}
              >
                {/* Non-playable video element */}
                <video 
                  src={video.video_url || video.url}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ imageRendering: 'pixelated' }}
                  muted
                  loop
                  preload="metadata"
                  onError={(e) => {
                    // Replace with fallback emoji if video fails
                    const target = e.target as HTMLVideoElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.fallback-emoji')) {
                      const fallback = document.createElement('div');
                      fallback.innerHTML = favorites[video.chunk_id] ? '⭐' : '🎬';
                      fallback.className = 'fallback-emoji text-2xl flex items-center justify-center w-full h-full';
                      fallback.style.imageRendering = 'pixelated';
                      parent.appendChild(fallback);
                    }
                  }}
                  onLoadedData={(e) => {
                    // Remove any existing fallback when video loads successfully
                    const target = e.target as HTMLVideoElement;
                    const parent = target.parentElement;
                    const existingFallback = parent?.querySelector('.fallback-emoji');
                    if (existingFallback) {
                      existingFallback.remove();
                    }
                    target.style.display = 'block';
                    // Show first frame
                    target.currentTime = 0.1;
                  }}
                />
              </div>
            </div>
            
            {/* Clean favorite toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(video);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-gray-300 border-2 border-gray-600 text-gray-800 text-xs flex items-center justify-center hover:bg-gray-400 font-bold"
              style={{ 
                imageRendering: 'pixelated', 
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)' 
              }}
            >
              {favorites[video.chunk_id] ? '⭐' : '+'}
            </button>
            
            {/* Clean info box */}
            <div className="absolute top-18 left-1/2 transform -translate-x-1/2 text-center">
              <div 
                className="text-xs text-gray-800 font-bold whitespace-nowrap max-w-20 truncate bg-white border-2 border-gray-400 px-2 py-1"
                style={{
                  fontFamily: 'monospace',
                  imageRendering: 'pixelated',
                  boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,1)'
                }}
              >
                {video.query || `Clip ${index + 1}`}
              </div>
              {video.score && searchQuery.trim() && (
                <div 
                  className="text-xs text-blue-800 font-bold mt-1 bg-blue-200 border-2 border-blue-400 px-1 py-0.5"
                  style={{
                    fontFamily: 'monospace',
                    imageRendering: 'pixelated',
                    boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
                  }}
                >
                  {(video.score * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Clean empty state */}
      {videos.length === 0 && !loading && (
        <div 
          className="absolute flex items-center justify-center" 
          style={{ 
            top: height * 0.15,
            left: width * 0.2,
            width: width * 0.6,
            height: height * 0.3,
            zIndex: 2 
          }}
        >
          <div 
            className="text-center bg-white border-4 border-gray-600 p-6"
            style={{
              fontFamily: 'monospace',
              imageRendering: 'pixelated',
              boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 6px 6px 0px rgba(0,0,0,0.2)'
            }}
          >
            {favouritesOnly ? (
              <div>
                <div className="text-4xl mb-3">⭐</div>
                <div className="text-sm font-bold text-gray-800">NO FAVORITES YET</div>
                <div className="text-xs text-gray-600">Add videos to see them here</div>
              </div>
            ) : searchQuery ? (
              <div>
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-sm font-bold text-gray-800">NO RESULTS</div>
                <div className="text-xs text-gray-600">Try a different search term</div>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">🎬</div>
                <div className="text-sm font-bold text-gray-800">UPLOAD OR SEARCH VIDEOS</div>
                <div className="text-xs text-gray-600">Use the controls above to get started</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drag and drop upload area */}
      {!favouritesOnly && (
        <div className="absolute bottom-4 left-4 z-20">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="video-upload"
          />
          <label
            htmlFor="video-upload"
            className={`flex items-center justify-center w-16 h-16 cursor-pointer hover:scale-105 transition-transform ${
              isDragOver 
                ? 'border-4 border-green-600 bg-green-100' 
                : loading 
                ? 'border-4 border-orange-600 bg-orange-100' 
                : 'border-4 border-gray-600 bg-gray-100'
            }`}
            style={{
              imageRendering: 'pixelated',
              boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 4px 4px 0px rgba(0,0,0,0.2)'
            }}
          >
            {loading ? (
              <div className="text-2xl animate-spin">⏳</div>
            ) : isDragOver ? (
              <div className="text-2xl">⬇️</div>
            ) : (
              <div className="text-2xl">📹</div>
            )}
          </label>
          <div 
            className="text-center text-gray-800 text-xs mt-1 font-bold bg-white border-2 border-gray-400 px-2 py-1"
            style={{
              fontFamily: 'monospace',
              imageRendering: 'pixelated',
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,1)'
            }}
          >
            UPLOAD
          </div>
        </div>
      )}

      {/* Simple legend */}
      <div 
        className="absolute bottom-4 right-4 bg-white border-4 border-gray-600 p-3 z-20"
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          imageRendering: 'pixelated',
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,1), 4px 4px 0px rgba(0,0,0,0.2)'
        }}
      >
        <div className="text-xs font-bold mb-2 text-gray-800">VIDEO TYPES</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 border-2 border-blue-600 bg-blue-300 flex items-center justify-center"
              style={{ 
                imageRendering: 'pixelated',
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}
            >
              <span className="text-xs">🎬</span>
            </div>
            <span className="text-gray-800 font-bold text-xs">REGULAR CLIPS</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 border-2 border-yellow-600 bg-yellow-300 flex items-center justify-center"
              style={{ 
                imageRendering: 'pixelated',
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}
            >
              <span className="text-xs">⭐</span>
            </div>
            <span className="text-gray-800 font-bold text-xs">FAVORITES</span>
          </div>
        </div>
      </div>

    </div>
  );
}