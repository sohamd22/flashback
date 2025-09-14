'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { convertAPIDataToGraphData, APIInteraction } from '@/types/graph';
import FileExplorer from '@/components/FileExplorer';
import PhotosApp from '@/components/PhotosApp';

import Desktop from './os/Desktop';
import DesktopIcon from './os/DesktopIcon';
import Window from './os/Window';
import Taskbar from './os/Taskbar';
import OSGraphCanvas from './os/OSGraphCanvas';
import RetroVideoPlayer from './RetroVideoPlayer';
import UserProfileWindow from './UserProfileWindow';

// Types
interface WindowState {
  id: string;
  title: string;
  content: React.ReactNode;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
}

interface DesktopIconData {
  id: string;
  name: string;
  icon: string;
  onDoubleClick: () => void;
  badgeCount?: number;
  position?: 'start' | 'end';
}

// Notifications management hook
function useNotifications(profile: any) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      subject: "Welcome to Flashback!",
      from: "Team Flashback",
      preview: "Learn how to use your new photo memory platform...",
      isRead: false, // Start with unread to avoid hydration mismatch
      content: `Welcome to Flashback!

Hi ${profile?.name || 'there'}! We're excited to have you on board. 
Here's how to get started with Flashback:

> VIDEOS FOLDER
  Double-click the Videos folder on your desktop to explore 
  your uploaded photos and videos. You can view your memories, 
  search through them, and even see transcriptions of your videos!

> FRIENDS FOLDER  
  Open the Friends folder to see your social network visualized 
  as an interactive graph. Connect with friends who also appear 
  in your photos and discover new connections!

Questions? Just reply to this email - we're here to help!

- Team Flashback`
    }
  ]);
  
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved state after hydration
  useEffect(() => {
    const saved = localStorage.getItem('photographic_notifications');
    const savedData = saved ? JSON.parse(saved) : {};
    
    setNotifications(prev => 
      prev.map(notification => ({
        ...notification,
        isRead: savedData[notification.id.toString()] || false
      }))
    );
    
    setIsHydrated(true);
  }, []);

  const markAsRead = (notificationId: number) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      );
      
      // Save to localStorage
      const readStatus = Object.fromEntries(
        updated.map(n => [n.id.toString(), n.isRead])
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('photographic_notifications', JSON.stringify(readStatus));
      }
      
      return updated;
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return { notifications, markAsRead, unreadCount, isHydrated };
}

// Window management hook
function useWindowManager() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [draggedWindow, setDraggedWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nextZIndex, setNextZIndex] = useState(1000); // Start with high z-index

  const openWindow = (title: string, content: React.ReactNode, icon: string, customWidth?: number, customHeight?: number) => {
    const windowWidth = customWidth || (typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200);
    const windowHeight = customHeight || (typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800);
    
    setWindows(prev => {
      // Calculate z-index using the current windows state
      const currentMaxZIndex = prev.length > 0 ? Math.max(...prev.map(w => w.zIndex)) : 999;
      const windowZIndex = Math.max(currentMaxZIndex + 1, nextZIndex);
      
      
      const newWindow: WindowState = {
        id: `window-${Date.now()}`,
        title,
        content,
        icon,
        x: 50 + prev.length * 30,
        y: 50 + prev.length * 30,
        width: windowWidth,
        height: windowHeight,
        zIndex: windowZIndex,
        minimized: false,
        maximized: false
      };

      // Update nextZIndex for future windows
      setNextZIndex(windowZIndex + 1);
      
      return [...prev, newWindow];
    });
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const bringToFront = (id: string) => {
    setWindows(prev =>
      prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w)
    );
    setNextZIndex(prev => prev + 1);
  };

  const handleMouseDown = (e: React.MouseEvent, windowId: string) => {
    if ((e.target as HTMLElement).closest('.window-controls')) return;
    
    const window = windows.find(w => w.id === windowId);
    if (!window) return;

    setDraggedWindow(windowId);
    setDragOffset({
      x: e.clientX - window.x,
      y: e.clientY - window.y
    });
    bringToFront(windowId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedWindow) return;

    setWindows(prev =>
      prev.map(w => w.id === draggedWindow ? {
        ...w,
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      } : w)
    );
  };

  const handleMouseUp = () => {
    setDraggedWindow(null);
  };

  return {
    windows,
    openWindow,
    closeWindow,
    bringToFront,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}

// App components
function VideosApp({ width, height, windowManager }: { width: number; height: number; windowManager: any }) {
  const { profile } = useAuth();
  
  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white">
        <div className="text-center" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">INITIALIZING FILE SYSTEM</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full">
      <FileExplorer
        width={width}
        height={height}
        onOpenGraphWindow={windowManager.openWindow}
      />
    </div>
  );
}

function ContactsApp({ width, height, windowManager }: { width: number; height: number; windowManager: any }) {
  const { profile } = useAuth();
  const [interactions, setInteractions] = useState<APIInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchInteractions = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://aryankeluskar--facial-recognition-api-fastapi-app.modal.run/interactions');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw API data:', data);
        
        // Extract interactions from the response
        let interactionsData = [];
        if (Array.isArray(data)) {
          interactionsData = data;
        } else if (data && Array.isArray(data.interactions)) {
          interactionsData = data.interactions;
        } else if (data && typeof data === 'object') {
          // If data is an object with interactions as values
          interactionsData = Object.values(data).filter((item: any) => 
            item && typeof item === 'object' && item.user1 && item.user2
          );
        }
        
        console.log('Processed interactions:', interactionsData);
        setInteractions(interactionsData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch interactions:', err);
        setError('Failed to load social network data');
        setInteractions([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchInteractions();
  }, []);
  
  if (!profile || !profile.profile_photo || !profile.name) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white">
        <div className="text-center" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">CONNECTING TO SOCIAL NETWORK</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white">
        <div className="text-center" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">FETCHING INTERACTION DATA</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white">
        <div className="text-center" style={{ fontFamily: 'monospace' }}>
          <div className="text-red-400 mb-2">ERROR</div>
          <div className="text-xs">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  // Find current user in interactions based on profile
  let currentUserId: string = profile?.id?.toString() || '1';
  if (profile?.email && interactions.length > 0) {
    const foundUser = interactions.find(interaction => 
      interaction.user1?.email === profile.email || interaction.user2?.email === profile.email
    );
    if (foundUser) {
      currentUserId = foundUser.user1.email === profile.email ? foundUser.user1.id : foundUser.user2.id;
    }
  }
  
  console.log('ContactsApp debug:', {
    interactions,
    interactionsLength: interactions.length,
    profile,
    currentUserId
  });
  
  // Create graph data - FORCE IT TO WORK
  let graphData;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;
  
  console.log('Creating graph with interactions count:', interactions.length);
  
  if (interactions.length === 0) {
    // Create demo graph with mock friends
    console.log('No interactions, creating demo graph');
    const mockFriends = [
      { id: 'demo1', name: 'Friend 1', photo: '/icons/user.png' },
      { id: 'demo2', name: 'Friend 2', photo: '/icons/user.png' },
    ];
    
    graphData = {
      nodes: [
        {
          id: currentUserId,
          name: profile?.name || 'You',
          photo: profile?.profile_photo || '/icons/user.png',
          x: centerX,
          y: centerY,
          isUser: true
        },
        ...mockFriends.map((friend, index) => {
          const angle = (index / mockFriends.length) * 2 * Math.PI;
          return {
            id: friend.id,
            name: friend.name,
            photo: friend.photo,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            isUser: false
          };
        })
      ],
      connections: mockFriends.map(friend => ({
        fromId: currentUserId,
        toId: friend.id,
        interactions: 5,
        strength: 0.5
      }))
    };
  } else {
    // Extract users manually from interactions
    console.log('Creating real graph from interactions');
    const userMap = new Map();
    
    interactions.forEach(interaction => {
      if (interaction?.user1?.id) {
        userMap.set(interaction.user1.id, interaction.user1);
      }
      if (interaction?.user2?.id) {
        userMap.set(interaction.user2.id, interaction.user2);
      }
    });
    
    const allUsers = Array.from(userMap.values());
    const currentUser = allUsers.find(u => u.id === currentUserId);
    const otherUsers = allUsers.filter(u => u.id !== currentUserId);
    
    console.log('Found users:', { currentUser, otherUsers });
    
    const nodes = [
      // Current user in center
      {
        id: currentUserId,
        name: currentUser?.name || profile?.name || 'You',
        photo: currentUser?.profile_photo || profile?.profile_photo || '/icons/user.png',
        x: centerX,
        y: centerY,
        isUser: true
      },
      // Other users in circle
      ...otherUsers.map((user, index) => {
        const angle = (index / Math.max(otherUsers.length, 1)) * 2 * Math.PI;
        return {
          id: user.id,
          name: user.name,
          photo: user.profile_photo || '/icons/user.png',
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          isUser: false
        };
      })
    ];
    
    // Create connections between all users based on interactions (not just user-centric)
    const connections = interactions.map(interaction => ({
      fromId: interaction.user1.id,
      toId: interaction.user2.id,
      interactions: interaction.interaction_count || 1,
      strength: Math.min((interaction.interaction_count || 1) / 10, 1)
    }));
    
    console.log('Created connections:', connections);
    graphData = { nodes, connections };
  }

  console.log("Final Graph Data:", graphData);
  
  return (
    <div className="h-full bg-black">
      <OSGraphCanvas 
        data={graphData}
        width={width}
        height={height}
        onUserClick={() => {}}
        onFriendClick={(friendId) => {
          // Check if current user has any interaction with this friend
          const interaction = interactions.find(interaction => 
            (interaction.user1.id === currentUserId && interaction.user2.id === friendId) ||
            (interaction.user2.id === currentUserId && interaction.user1.id === friendId)
          );
          
          if (!interaction) {
            // Show error message for no interactions
            const windowWidth = typeof window !== 'undefined' ? Math.min(600, window.innerWidth - 100) : 600;
            const windowHeight = typeof window !== 'undefined' ? Math.min(400, window.innerHeight - 120) : 400;
            
            windowManager.openWindow(
              '❌ Profile Access Denied',
              <div className="h-full flex items-center justify-center bg-black text-white p-8">
                <div className="text-center" style={{ fontFamily: 'monospace' }}>
                  <div className="text-red-400 mb-4 text-4xl">🚫</div>
                  <div className="text-xl mb-4">Access Denied</div>
                  <div className="text-sm text-gray-300 mb-4">
                    You cannot view this person's profile because you have no recorded interactions with them.
                  </div>
                  <div className="text-xs text-gray-500">
                    Try uploading photos or videos that include both of you to create a connection!
                  </div>
                </div>
              </div>,
              "/icons/user.png",
              windowWidth,
              windowHeight
            );
            return;
          }
          
          // Find the friend's data from interactions
          const friendUser = interaction.user1.id === friendId ? interaction.user1 : interaction.user2;
          
          const windowWidth = typeof window !== 'undefined' ? Math.min(800, window.innerWidth - 100) : 800;
          const windowHeight = typeof window !== 'undefined' ? Math.min(600, window.innerHeight - 120) : 600;
          
          windowManager.openWindow(
            `👤 ${friendUser.name} - Profile (${interaction.interaction_count} interactions)`,
            <UserProfileWindow
              userId={friendUser.id.toString()}
              userName={friendUser.name}
              userPhoto={friendUser.profile_photo}
              width={windowWidth - 20}
              height={windowHeight - 60}
            />,
            "/icons/user.png",
            windowWidth,
            windowHeight
          );
        }}
      />
    </div>
  );
}

function EmailApp({ width, height, windowManager, notifications, onMarkAsRead }: { 
  width: number; 
  height: number; 
  windowManager: any;
  notifications: any[];
  onMarkAsRead: (id: number) => void;
}) {
  const { profile } = useAuth();
  const [selectedNotification, setSelectedNotification] = useState(notifications[0]);

  // Mark notification as read when selected
  const handleNotificationSelect = (notification: any) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div className="h-full bg-black flex border-2 border-gray-400" style={{ 
      fontFamily: 'Minecraft', 
      imageRendering: 'pixelated',
      fontSize: '12px'
    }}>
      {/* Sidebar */}
      <div className="w-1/3 bg-gray-300 border-r-2 border-gray-600">
        <div className="p-2 border-b-2 border-gray-600 bg-gray-400">
          <div className="text-black font-bold">NOTIFICATIONS</div>
          <div className="text-xs text-gray-700">
            {notifications.filter(n => !n.isRead).length} unread messages
          </div>
        </div>
        
        <div className="overflow-y-auto">
          {notifications.map((notification, index) => (
            <div
              key={notification.id}
              className={`p-2 border-b border-gray-500 cursor-pointer hover:bg-gray-200 ${
                selectedNotification.id === notification.id ? 'bg-blue-200' : 'bg-gray-300'
              }`}
              onClick={() => handleNotificationSelect(notification)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-black text-xs truncate">
                  {notification.from}
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-red-500" style={{ imageRendering: 'pixelated' }}></div>
                )}
              </div>
              <div className="font-bold text-black text-xs mb-1 truncate">
                {notification.subject}
              </div>
              <div className="text-gray-700 text-xs truncate">
                {notification.preview}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="p-2 border-b-2 border-gray-600 bg-gray-400">
          <div className="font-bold text-black">
            {selectedNotification.subject}
          </div>
          <div className="text-xs text-gray-700">
            From: {selectedNotification.from}
          </div>
        </div>
        
        <div className="flex-1 p-3 overflow-y-auto bg-white">
          <pre className="whitespace-pre-wrap text-black text-xs leading-relaxed" style={{ 
            fontFamily: 'Minecraft',
            imageRendering: 'pixelated'
          }}>
            {selectedNotification.content}
          </pre>
        </div>
      </div>
    </div>
  );
}

function TrashApp({ width, height, windowManager }: { width: number; height: number; windowManager: any }) {
  const [showRickroll, setShowRickroll] = useState(false);
  
  const rickrollVideo = {
    id: 'rickroll',
    chunk_id: 'easter-egg-chunk',
    video_id: 'easter-egg-video',
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1',
    originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    query: 'Never Gonna Give You Up'
  };

  return (
    <div className="h-full flex flex-col bg-gray-200" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
      {/* Windows-style title bar */}
      <div className="bg-blue-800 text-white px-1 py-1 text-xs flex items-center">
        <span>🗑️ Recycle Bin</span>
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
          🔄 Restore
        </button>
        <button className="px-2 py-1 border text-gray-800 border-gray-400 bg-gray-100 hover:bg-gray-300 text-xs"
                style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}>
          🗑️ Empty
        </button>
        {showRickroll && (
          <button 
            onClick={() => setShowRickroll(false)}
            className="px-2 py-1 border text-gray-800 border-gray-400 bg-gray-100 hover:bg-gray-300 text-xs"
            style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}
          >
            ⬅️ Back
          </button>
        )}
      </div>

      {/* Address bar */}
      <div className="bg-gray-200 text-gray-800 border-b border-gray-400 px-2 py-1 flex items-center gap-2 text-xs">
        <span>Address:</span>
        <div className="flex-1 bg-white border text-gray-800 border-gray-400 px-2 py-1" style={{ boxShadow: 'inset 1px 1px 0 gray' }}>
          C:\RECYCLER
        </div>
      </div>
      
      {/* Content area - split view when video is playing */}
      <div className="flex-1 overflow-auto bg-white border text-gray-800 border-gray-400" style={{ boxShadow: 'inset 1px 1px 0 gray' }}>
        <div className="p-2">
          {/* List header */}
          <div className="flex items-center px-2 py-1 bg-gray-200 border text-gray-800 border-gray-400 text-xs font-bold uppercase"
               style={{ boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 gray' }}>
            <div className="w-8"></div>
            <div className="flex-1 px-2">Name</div>
            <div className="w-20 px-2">Size</div>
            <div className="w-24 px-2">Deleted</div>
          </div>
          
          {/* File item - the easter egg */}
          <div
            className={`flex items-center px-2 py-2 cursor-pointer border-b border-gray-300 ${
              showRickroll ? 'bg-blue-600 text-white' : 'hover:bg-blue-200'
            }`}
            onClick={() => setShowRickroll(!showRickroll)}
            style={{ fontFamily: 'monospace', fontSize: '11px' }}
          >
            {/* File icon - pixel art style */}
            <div className="w-8 h-6 flex items-center justify-center mr-2">
              <div className="w-6 h-5 flex items-center justify-center bg-red-400 border border-black"
                   style={{ 
                     boxShadow: '1px 1px 0 #000, inset 1px 1px 0 #fff',
                     imageRendering: 'pixelated'
                   }}>
                <span className="text-xs leading-none">🎬</span>
              </div>
            </div>
            
            {/* File name */}
            <div className={`flex-1 px-2 font-bold text-xs truncate ${showRickroll ? 'text-white' : 'text-black'}`} style={{
              textShadow: showRickroll ? 'none' : '1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(255,255,255,0.8)'
            }}>
              test_video_final_fr.mp4 {showRickroll && '(Playing)'}
            </div>
            
            {/* File size */}
            <div className={`w-20 px-2 text-xs ${showRickroll ? 'text-gray-200' : 'text-gray-700'}`} style={{
              textShadow: showRickroll ? 'none' : '1px 1px 0px rgba(255,255,255,0.8)'
            }}>
              3.2 MB
            </div>
            
            {/* Deleted date */}
            <div className={`w-24 px-2 text-xs ${showRickroll ? 'text-gray-200' : 'text-gray-700'}`} style={{
              textShadow: showRickroll ? 'none' : '1px 1px 0px rgba(255,255,255,0.8)'
            }}>
              {new Date().toLocaleDateString()}
            </div>
          </div>
          
          {/* Video player area - appears below the file when playing */}
          {showRickroll && (
            <div className="mt-4 flex justify-center">
              <RetroVideoPlayer 
                video={rickrollVideo}
                width={Math.min(480, width - 60)}
                height={Math.min(360, height - 200)}
                onClose={() => setShowRickroll(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-200 border-t border-gray-400 px-2 py-1 flex items-center justify-between text-xs">
        <span style={{ fontFamily: 'monospace' }}>
          {showRickroll ? 'Playing video...' : '1 object'}
        </span>
        <span style={{ fontFamily: 'monospace' }}>
          Recycle Bin
        </span>
      </div>
    </div>
  );
}

// Email notification popup component
function EmailNotificationPopup({ unreadCount, onClose, onOpenMail }: { 
  unreadCount: number; 
  onClose: () => void;
  onOpenMail: () => void;
}) {
  return (
    <div 
      className="fixed top-8 right-4 bg-gray-300 border-2 border-gray-800 shadow-lg z-50"
      style={{ 
        fontFamily: 'Minecraft',
        imageRendering: 'pixelated',
        boxShadow: 'inset 2px 2px 0 white, inset -2px -2px 0 #404040, 4px 4px 8px rgba(0,0,0,0.3)'
      }}
    >
      {/* Title bar */}
      <div className="bg-blue-700 text-white px-2 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <span>📧</span>
          <span>New Mail</span>
        </div>
        <button 
          onClick={onClose}
          className="bg-gray-300 text-black px-1 border border-gray-600 hover:bg-gray-400"
          style={{ 
            boxShadow: 'inset 1px 1px 0 white, inset -1px -1px 0 #404040',
            fontSize: '10px',
            lineHeight: '12px'
          }}
        >
          ✕
        </button>
      </div>
      
      {/* Content */}
      <div className="p-3 bg-gray-300">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-8 h-8 bg-yellow-400 border-2 border-gray-800 flex items-center justify-center"
            style={{ imageRendering: 'pixelated' }}
          >
            <span className="text-xs">📧</span>
          </div>
          <div>
            <div className="text-black text-xs font-bold">
              You have {unreadCount} new message{unreadCount !== 1 ? 's' : ''}!
            </div>
            <div className="text-gray-700 text-xs">
              Click to read your mail
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onOpenMail}
            className="px-3 py-1 bg-gray-100 border-2 border-gray-600 text-black text-xs hover:bg-gray-200"
            style={{ 
              boxShadow: 'inset 2px 2px 0 white, inset -2px -2px 0 #404040',
              imageRendering: 'pixelated'
            }}
          >
            Open Mail
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-100 border-2 border-gray-600 text-black text-xs hover:bg-gray-200"
            style={{ 
              boxShadow: 'inset 2px 2px 0 white, inset -2px -2px 0 #404040',
              imageRendering: 'pixelated'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function OSPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { profile, logout } = useAuth();
  const [showEmailNotification, setShowEmailNotification] = useState(false);
  
  const windowManager = useWindowManager();
  const { notifications, markAsRead, unreadCount, isHydrated } = useNotifications(profile);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Show email notification when user logs in and has unread emails
  useEffect(() => {
    if (profile && unreadCount > 0 && isHydrated) {
      setShowEmailNotification(true);
    }
  }, [profile, unreadCount, isHydrated]);

  const desktopIcons: DesktopIconData[] = [
    {
      id: 'personal',
      name: 'Personal',
      icon: "/icons/folder.png",
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          profile?.name ? `${profile.name}'s Videos` : 'Videos',
          <VideosApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} />,
          "/icons/folder.png"
        );
      }
    },
    {
      id: 'photos',
      name: 'Photos',
      icon: "/icons/photo_logo.png",
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          profile?.name ? `${profile.name}'s Photos` : 'Photos',
          <PhotosApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} />,
          "/icons/photo_logo.png"
        );
      }
    },
    {
      id: 'contacts',
      name: 'Contacts',
      icon: "/icons/contacts.png",
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          'Social Graph - Photo Connections',
          <ContactsApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} />,
          "/icons/contacts.png"
        );
      }
    },
    {
      id: 'email',
      name: 'Mail',
      icon: "/icons/email.png",
      ...(isHydrated && unreadCount > 0 && { badgeCount: unreadCount }),
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          'Mail - Notifications',
          <EmailApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} notifications={notifications} onMarkAsRead={markAsRead} />,
          "/icons/email.png"
        );
      }
    },
    {
      id: 'trash',
      name: 'Trash',
      icon: "/icons/trash.png",
      position: 'end',
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          'Trash',
          <TrashApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} />,
          "/icons/trash.png"
        );
      }
    }
  ];

  const regularIcons = desktopIcons.filter(icon => icon.position !== 'end');
  const specialIcons = desktopIcons.filter(icon => icon.position === 'end');

  return (
    <Desktop
      onMouseMove={windowManager.handleMouseMove}
      onMouseUp={windowManager.handleMouseUp}
    >
      {/* Main content area */}
      <div className="flex-1 flex relative">
        {/* Left side icons grid */}
        <div className="p-4 grid grid-cols-1 gap-4 content-start h-fit">
          {regularIcons.map(icon => (
            <DesktopIcon key={icon.id} {...icon} />
          ))}
        </div>

        {/* Right side icons (like trash) */}
        <div className="absolute bottom-9 right-4 grid gap-4">
          {specialIcons.map(icon => (
            <DesktopIcon key={icon.id} {...icon} />
          ))}
        </div>

        {/* Windows */}
        {windowManager.windows.map(window => (
          <Window
            key={window.id}
            id={window.id}
            title={window.title}
            icon={window.icon}
            x={window.x}
            y={window.y}
            width={window.width}
            height={window.height}
            zIndex={window.zIndex}
            onMouseDown={(e) => windowManager.handleMouseDown(e, window.id)}
            onClose={() => windowManager.closeWindow(window.id)}
            onBringToFront={() => windowManager.bringToFront(window.id)}
          >
            {window.content}
          </Window>
        ))}
      </div>

      {/* Email notification popup */}
      {showEmailNotification && unreadCount > 0 && isHydrated && (
        <EmailNotificationPopup
          unreadCount={unreadCount}
          onClose={() => setShowEmailNotification(false)}
          onOpenMail={() => {
            setShowEmailNotification(false);
            const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
            const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
            windowManager.openWindow(
              'Mail - Notifications',
              <EmailApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} notifications={notifications} onMarkAsRead={markAsRead} />,
              "/icons/email.png"
            );
          }}
        />
      )}

      {/* Taskbar */}
      <Taskbar
        windows={windowManager.windows}
        currentTime={currentTime}
        onWindowClick={windowManager.bringToFront}
        onLogout={profile ? logout : undefined}
      />
    </Desktop>
  );
}