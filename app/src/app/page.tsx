'use client';

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/AuthForm';
import Onboarding from '@/components/Onboarding';
import GraphCanvas from '@/components/GraphCanvas';
import PersonalPage from '@/components/PersonalPage';
import UserDetailPage from '@/components/UserDetailPage';
import { generateMockGraphData } from '@/types/graph';
import { FriendProfile } from '@/types/sharedMemory';

function AppContent() {
  const { user, profile, isLoading, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPersonalPage, setShowPersonalPage] = useState(false);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!user) {
      setShowAuth(true);
      setShowOnboarding(false);
      setShowPersonalPage(false);
      setShowUserDetail(false);
    } else if (profile && !profile.onboarding_complete) {
      setShowAuth(false);
      setShowOnboarding(true);
      setShowPersonalPage(false);
      setShowUserDetail(false);
    } else {
      setShowAuth(false);
      setShowOnboarding(false);
      // Keep personal page and user detail state as user preference
    }
  }, [user, profile]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 48,
        height: window.innerHeight - 120
      });
    };

    // Set initial dimensions
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (showAuth) {
    return (
      <AuthForm
        onSuccess={() => setShowAuth(false)}
      />
    );
  }

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  if (showPersonalPage && profile) {
    const userData = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      profilePhoto: profile.profile_photo,
      onboardingComplete: profile.onboarding_complete
    };
    return (
      <PersonalPage
        user={userData}
        onBack={() => setShowPersonalPage(false)}
        width={dimensions.width}
        height={dimensions.height}
      />
    );
  }

  if (showUserDetail && profile && selectedFriend) {
    return (
      <UserDetailPage
        user={{
          id: profile.id,
          email: profile.email,
          name: profile.name,
          profilePhoto: profile.profile_photo,
          onboardingComplete: profile.onboarding_complete
        }}
        friend={selectedFriend}
        onBack={() => {
          setShowUserDetail(false);
          setSelectedFriend(null);
        }}
        width={dimensions.width}
        height={dimensions.height}
      />
    );
  }

  const graphData = profile && profile.profile_photo && profile.name
    ? generateMockGraphData(profile.profile_photo, profile.name, dimensions.width, dimensions.height)
    : null;

  const handleFriendClick = (friendId: string) => {
    if (!graphData) return;
    
    const friendNode = graphData.nodes.find(node => node.id === friendId);
    if (!friendNode) return;

    const friendProfile: FriendProfile = {
      id: friendNode.id,
      name: friendNode.name,
      photo: friendNode.photo,
      isFriend: friendNode.isFriend || false,
      mutualMemories: graphData.connections.find(c => c.toId === friendId)?.mutualMemories || 0
    };

    setSelectedFriend(friendProfile);
    setShowUserDetail(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with logout */}
      <header className="flex justify-between items-center p-6">
        <div className="text-2xl font-extralight text-white">
          Photographic
        </div>
        {user && (
          <button
            onClick={logout}
            className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors duration-200"
          >
            Sign Out
          </button>
        )}
      </header>

      {/* Main content - Graph Canvas */}
      <div className="flex justify-center items-center px-6 pb-6">
        {profile && graphData ? (
          <GraphCanvas 
            data={graphData}
            width={dimensions.width}
            height={dimensions.height}
            onUserClick={() => setShowPersonalPage(true)}
            onFriendClick={handleFriendClick}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
            <div className="text-center">
              <h1 className="text-8xl font-extralight text-white mb-8">
                Photographic
              </h1>
              <p className="text-gray-500">
                Loading your memory network...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
