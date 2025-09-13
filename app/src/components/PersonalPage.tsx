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
import AppHeader from '@/components/ui/AppHeader';
import SearchBar from '@/components/ui/SearchBar';

interface PersonalPageProps {
  user: User;
  onBack: () => void;
  width: number;
  height: number;
}

export default function PersonalPage({ user, onBack, width, height }: PersonalPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [videoResult, setVideoResult] = useState<VideoSearchResult | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [videos] = useState(() => generateMockVideos());
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const result = positionVideosForSearch(videos, '', width, height - 140);
    setVideoResult(result);
  }, [videos, width, height]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      const result = positionVideosForSearch(videos, searchQuery, width, height - 140);
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
        canvasHeight={height - 140}
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

  const headerContent = (
    <AppHeader
      title={`${user.name}'s Memories`}
      subtitle={`${videos.length} video clips`}
      user={user}
      showBackButton={true}
      onBack={onBack}
      rightContent={
        <div className="flex items-center gap-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search your memories... (e.g., 'beach sunset', 'birthday party', 'hiking')"
            className="max-w-md w-full"
          />
          <div className="text-sm text-gray-500">
            {videoResult && searchQuery && (
              <span>{videoResult.videos.length} matches</span>
            )}
          </div>
        </div>
      }
    />
  );

  if (!videoResult) return null;

  if (searchQuery) {
    return (
      <PageLayout header={headerContent}>
        <CanvasLayout>
          <div style={{ width, height: height - 140 }}>
            <div className="absolute inset-0 opacity-5">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }} />
            </div>

            {videoResult.videos.map(video => renderConnection(video))}
            {renderUserNode()}
            {videoResult.videos.map(video => renderVideoNode(video))}

            {videoResult.videos.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p className="text-lg">No memories found</p>
                  <p className="text-sm mt-2">Try a different search term</p>
                </div>
              </div>
            )}
          </div>
        </CanvasLayout>
      </PageLayout>
    );
  }

  return (
    <PageLayout header={headerContent}>
      <CanvasLayout>
        <GalaxyLayout
          centerNode={renderUserNode()}
          floatingNodes={videoResult.videos.map(video => renderVideoNode(video))}
        />
      </CanvasLayout>
    </PageLayout>
  );
}