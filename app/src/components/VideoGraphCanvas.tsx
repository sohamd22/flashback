'use client';

import { useState, useRef, useEffect } from 'react';
import { VideoClip, VideoSearchResult, generateMockVideos, positionVideosForSearch } from '@/types/video';
import { User } from '@/lib/auth';
import CanvasLayout from '@/components/layouts/CanvasLayout';
import GalaxyLayout from '@/components/layouts/GalaxyLayout';
import PageLayout from '@/components/layouts/PageLayout';
import UserNode from '@/components/nodes/UserNode';
import VideoNode from '@/components/nodes/VideoNode';
import MemoryConnection from '@/components/connections/MemoryConnection';

interface VideoGraphCanvasProps {
  user: User;
  width: number;
  height: number;
  favouritesOnly?: boolean;
}

export default function VideoGraphCanvas({ user, width, height, favouritesOnly = false }: VideoGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [videoResult, setVideoResult] = useState<VideoSearchResult | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [videos] = useState(() => {
    const allVideos = generateMockVideos();
    if (favouritesOnly) {
      // Return some videos as favourites (first 30% of videos)
      return allVideos.slice(0, Math.floor(allVideos.length * 0.3));
    }
    return allVideos;
  });
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const result = positionVideosForSearch(videos, '', width, height);
    setVideoResult(result);
  }, [videos, width, height]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      const result = positionVideosForSearch(videos, searchQuery, width, height);
      setVideoResult(result);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, videos, width, height]);

  const renderConnection = (video: VideoClip) => {
    if (!searchQuery || !videoResult) return null;
    
    return (
      <MemoryConnection
        key={`connection-${video.id}`}
        from={{ x: videoResult.centerX, y: videoResult.centerY }}
        to={{ x: video.x || 0, y: video.y || 0 }}
        strength={video.similarity || 0}
        canvasWidth={width}
        canvasHeight={height}
      />
    );
  };

  const renderUserNode = () => {
    if (!videoResult) return null;
    
    return (
      <UserNode
        id="user"
        name={user.name}
        photo={user.profilePhoto}
        x={videoResult.centerX}
        y={videoResult.centerY}
        size={100}
        isHovered={false}
      />
    );
  };
  
  const renderVideoNode = (video: VideoClip) => {
    const isHovered = hoveredVideo === video.id;
    const similarity = video.similarity || 0.5;
    const size = searchQuery ? (60 + (similarity * 40)) : 70;
    
    return (
      <VideoNode
        key={video.id}
        id={video.id}
        title={video.title}
        thumbnail={video.thumbnail}
        duration={video.duration}
        x={video.x || 0}
        y={video.y || 0}
        size={size}
        similarity={searchQuery ? similarity : undefined}
        isHovered={isHovered}
        onClick={() => console.log(`Playing video: ${video.title}`)}
        onMouseEnter={() => setHoveredVideo(video.id)}
        onMouseLeave={() => setHoveredVideo(null)}
      />
    );
  };

  if (!videoResult) return null;

  if (searchQuery) {
    return (
      <div className="h-full bg-transparent" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
        {/* Retro pixel art search header */}
        <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between">
          <div className="bg-gray-700 border-2 border-gray-400 p-2" 
               style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 black' }}>
            <div className="text-white">
              <div className="text-xs font-bold">
                SEARCH MODE: {favouritesOnly ? 'FAVOURITES' : 'ALL VIDEOS'}
              </div>
              <div className="text-xs text-green-300">
                {videoResult.videos.length} MATCHES FOR "{searchQuery}"
              </div>
            </div>
          </div>
          <div className="bg-gray-700 border-2 border-gray-400 p-1"
               style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 black' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH MEMORIES..."
              className="px-2 py-1 bg-black text-green-300 border border-gray-500 text-xs font-mono focus:outline-none"
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div style={{ width, height }} className="pt-16">
          <div className="relative h-full">
            {videoResult.videos.map(video => renderConnection(video))}
            {renderUserNode()}
            {videoResult.videos.map(video => renderVideoNode(video))}

            {videoResult.videos.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center bg-gray-700 border-2 border-gray-400 p-4"
                     style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 black' }}>
                  <p className="text-white font-bold text-xs">NO MEMORIES FOUND</p>
                  <p className="text-xs mt-1 text-gray-300">TRY DIFFERENT SEARCH TERM</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-transparent" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Retro pixel art header */}
      <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between">
        <div className="bg-gray-700 border-2 border-gray-400 p-2" 
             style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 black' }}>
          <div className="text-white">
            <div className="text-xs font-bold">
              {favouritesOnly ? 'FAVOURITE VIDEOS' : 'ALL VIDEOS'}
            </div>
            <div className="text-xs text-cyan-300">
              {videos.length} MEMORY CLIPS LOADED
            </div>
          </div>
        </div>
        <div className="bg-gray-700 border-2 border-gray-400 p-1"
             style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 black' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH MEMORIES..."
            className="px-2 py-1 bg-black text-cyan-300 border border-gray-500 text-xs font-mono focus:outline-none"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Graph Container */}
      <div style={{ width, height }} className="pt-16">
        <div className="relative h-full">
          <GalaxyLayout
            centerNode={renderUserNode()}
            floatingNodes={videoResult.videos.map(video => renderVideoNode(video))}
          />
        </div>
      </div>
    </div>
  );
}