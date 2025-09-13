'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/auth';
import { FriendProfile, SharedMemory, SharedMemoryResult, generateSharedMemories } from '@/types/sharedMemory';
import PageLayout from '@/components/layouts/PageLayout';
import DualUserLayout from '@/components/layouts/DualUserLayout';
import UserNode from '@/components/nodes/UserNode';
import VideoNode from '@/components/nodes/VideoNode';
import MemoryConnection from '@/components/connections/MemoryConnection';
import AppHeader from '@/components/ui/AppHeader';
import StatusIndicator from '@/components/ui/StatusIndicator';

interface UserDetailPageProps {
  user: User;
  friend: FriendProfile;
  onBack: () => void;
  width: number;
  height: number;
}

export default function UserDetailPage({ user, friend, onBack, width, height }: UserDetailPageProps) {
  const [memoryData, setMemoryData] = useState<SharedMemoryResult | null>(null);
  const [hoveredMemory, setHoveredMemory] = useState<string | null>(null);

  useEffect(() => {
    const data = generateSharedMemories(friend, width, height - 120);
    setMemoryData(data);
  }, [friend, width, height]);

  const renderConnection = (memory: SharedMemory) => {
    if (!memoryData) return null;
    
    const userX = width * 0.25;
    const friendX = width * 0.75;
    const userY = 80;
    const friendY = 80;
    
    const fromX = memory.uploader === 'user' ? userX : friendX;
    const fromY = memory.uploader === 'user' ? userY : friendY;
    
    return (
      <MemoryConnection
        key={`connection-${memory.id}`}
        from={{ x: fromX, y: fromY }}
        to={{ x: memory.x || 0, y: (memory.y || 0) + 120 }}
        strength={0.5}
        color={memory.uploader === 'user' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(34, 197, 94, 0.6)'}
        canvasWidth={width}
        canvasHeight={height}
      />
    );
  };

  const renderUserNode = (isCurrentUser: boolean) => {
    const userData = isCurrentUser ? user : friend;
    const x = isCurrentUser ? width * 0.25 : width * 0.75;
    const y = 80;
    
    return (
      <UserNode
        id={isCurrentUser ? 'user' : 'friend'}
        name={userData.name}
        photo={userData.photo}
        x={x}
        y={y}
        size={80}
        isHovered={false}
        borderColor={isCurrentUser ? 'border-blue-500' : 'border-green-500'}
      />
    );
  };

  const renderMemoryNode = (memory: SharedMemory) => {
    const isHovered = hoveredMemory === memory.id;
    
    return (
      <VideoNode
        key={memory.id}
        title={memory.title}
        thumbnail={memory.thumbnail}
        duration={memory.duration}
        x={memory.x || 0}
        y={(memory.y || 0) + 120}
        size={60}
        isHovered={isHovered}
        onClick={() => console.log(`Playing memory: ${memory.title}`)}
        onMouseEnter={() => setHoveredMemory(memory.id)}
        onMouseLeave={() => setHoveredMemory(null)}
      />
    );
  };

  const headerContent = (
    <AppHeader
      title="Shared Memories"
      subtitle={`${memoryData?.allMemories?.length || 0} memories together`}
      user={user}
      showBackButton={true}
      onBack={onBack}
      rightContent={
        <StatusIndicator
          status={friend.isFriend ? 'friend' : 'not-friend'}
          className="text-right"
        />
      }
    />
  );

  if (!memoryData) return null;

  if (friend.isFriend) {
    return (
      <PageLayout header={headerContent}>
        <div className="relative" style={{ height: height - 120 }}>
          <div className="absolute inset-0 opacity-5">
            <div className="w-full h-full" style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }} />
          </div>

          {memoryData?.allMemories?.map(memory => renderConnection(memory)) || []}
          {renderUserNode(true)}
          {renderUserNode(false)}
          {memoryData?.allMemories?.map(memory => renderMemoryNode(memory)) || []}

          {(memoryData?.allMemories?.length || 0) === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-lg">No shared memories yet</p>
                <p className="text-sm mt-2">Start creating memories together!</p>
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    );
  }

  const userMemories = memoryData?.userMemories || [];
  const friendMemories = memoryData?.friendMemories || [];

  return (
    <PageLayout header={headerContent}>
      <DualUserLayout
        leftContent={
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4">
              <img
                src={user.profilePhoto}
                alt={user.name}
                className="w-full h-full object-cover rounded-full border-4 border-blue-500"
              />
            </div>
            <h3 className="text-lg font-medium text-blue-400 mb-6">{user.name}</h3>
            <h4 className="text-sm font-medium text-gray-300 mb-4">Your Memories</h4>
            <div className="grid grid-cols-3 gap-4">
              {userMemories.map(memory => (
                <div
                  key={memory.id}
                  className="relative cursor-pointer group"
                  onClick={() => console.log(`Playing memory: ${memory.title}`)}
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-600 group-hover:scale-110 transition-transform">
                    <img
                      src={memory.thumbnail}
                      alt={memory.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded font-mono">
                    {Math.floor(memory.duration / 60)}:{(memory.duration % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        rightContent={
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4">
              <img
                src={friend.photo}
                alt={friend.name}
                className="w-full h-full object-cover rounded-full border-4 border-gray-600"
              />
            </div>
            <h3 className="text-lg font-medium text-gray-400 mb-6">{friend.name}</h3>
            <h4 className="text-sm font-medium text-gray-300 mb-4">Their Memories</h4>
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p>Private memories</p>
              <p className="text-sm mt-2">Only visible to friends</p>
            </div>
          </div>
        }
        centerContent={
          <div className="w-px bg-gray-700 h-full" />
        }
      />
    </PageLayout>
  );
}