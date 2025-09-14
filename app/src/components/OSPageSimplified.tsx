'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { generateMockGraphData } from '@/types/graph';
import FileExplorer from '@/components/FileExplorer';

import Desktop from './os/Desktop';
import DesktopIcon from './os/DesktopIcon';
import Window from './os/Window';
import Taskbar from './os/Taskbar';
import OSGraphCanvas from './os/OSGraphCanvas';

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
  x: number;
  y: number;
  onDoubleClick: () => void;
  badgeCount?: number;
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
    
    const newWindow: WindowState = {
      id: `window-${Date.now()}`,
      title,
      content,
      icon,
      x: 50 + windows.length * 30,
      y: 50 + windows.length * 30,
      width: windowWidth,
      height: windowHeight,
      zIndex: nextZIndex,
      minimized: false,
      maximized: false
    };

    setWindows(prev => [...prev, newWindow]);
    setNextZIndex(prev => prev + 1);
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

function ContactsApp({ width, height }: { width: number; height: number }) {
  const { profile } = useAuth();
  
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

  const graphData = generateMockGraphData(profile.profile_photo, profile.name, width, height);
  
  return (
    <div className="h-full bg-black">
      <OSGraphCanvas 
        data={graphData}
        width={width}
        height={height}
        onUserClick={() => {}}
        onFriendClick={(friendId) => {
          console.log(`Viewing friend: ${friendId} in desktop mode`);
        }}
      />
    </div>
  );
}

function EmailApp({ width, height, windowManager }: { width: number; height: number; windowManager: any }) {
  const { profile } = useAuth();
  
  const notifications = [
    {
      id: 1,
      subject: "Welcome to Photographic!",
      from: "Team Photographic",
      preview: "Learn how to use your new photo memory platform...",
      isRead: false,
      content: `Welcome to Photographic!

Hi ${profile?.name || 'there'}! We're excited to have you on board. 
Here's how to get started with Photographic:

> VIDEOS FOLDER
  Double-click the Videos folder on your desktop to explore 
  your uploaded photos and videos. You can view your memories, 
  search through them, and even see transcriptions of your videos!

> FRIENDS FOLDER  
  Open the Friends folder to see your social network visualized 
  as an interactive graph. Connect with friends who also appear 
  in your photos and discover new connections!

Questions? Just reply to this email - we're here to help!

- Team Photographic`
    },
    {
      id: 2,
      subject: "Friend Request from Sarah Johnson",
      from: "sarah.johnson@email.com",
      preview: "Sarah wants to connect with you on Photographic...",
      isRead: false,
      content: `New Friend Request

From: Sarah Johnson
Email: sarah.johnson@email.com

Sarah would like to connect with you on Photographic. 
You both appear in several photos together from your 
recent vacation in Hawaii!

[ ACCEPT REQUEST ] [ DECLINE ]

Reply to this email to respond.`
    },
    {
      id: 3,
      subject: "Friend Request from Mike Chen",
      from: "mike.chen@email.com", 
      preview: "Mike wants to connect with you on Photographic...",
      isRead: true,
      content: `New Friend Request

From: Mike Chen  
Email: mike.chen@email.com

Mike would like to connect with you on Photographic. 
You both appear in photos from the tech conference 
last month.

[ ACCEPT REQUEST ] [ DECLINE ]

Reply to this email to respond.`
    }
  ];

  const [selectedNotification, setSelectedNotification] = useState(notifications[0]);

  return (
    <div className="h-full bg-black flex border-2 border-gray-400" style={{ 
      fontFamily: 'Pixelify Sans', 
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
              onClick={() => setSelectedNotification(notification)}
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
            fontFamily: 'Pixelify Sans',
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
  return (
    <div className="h-full">
    </div>
  );
}

// Main component
export default function OSPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { profile, logout } = useAuth();
  
  const windowManager = useWindowManager();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const notifications = [
    {
      id: 1,
      subject: "Welcome to Photographic!",
      from: "Team Photographic",
      preview: "Learn how to use your new photo memory platform...",
      isRead: false,
    },
    {
      id: 2,
      subject: "Friend Request from Sarah Johnson",
      from: "sarah.johnson@email.com",
      preview: "Sarah wants to connect with you on Photographic...",
      isRead: false,
    },
    {
      id: 3,
      subject: "Friend Request from Mike Chen",
      from: "mike.chen@email.com", 
      preview: "Mike wants to connect with you on Photographic...",
      isRead: true,
    }
  ];

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const desktopIcons: DesktopIconData[] = [
    {
      id: 'personal',
      name: 'Personal',
      icon: "/icons/folder.png",
      x: 32,
      y: 32,
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
      id: 'contacts',
      name: 'Contacts',
      icon: "/icons/contacts.png",
      x: 32,
      y: 140,
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          'Social Graph - Photo Connections',
          <ContactsApp width={windowWidth - 20} height={windowHeight - 60} />,
          "/icons/contacts.png"
        );
      }
    },
    {
      id: 'email',
      name: 'Mail',
      icon: "/icons/email.png",
      x: 32,
      y: 248,
      badgeCount: unreadCount,
      onDoubleClick: () => {
        const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
        const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
        windowManager.openWindow(
          'Mail - Notifications',
          <EmailApp width={windowWidth - 20} height={windowHeight - 60} windowManager={windowManager} />,
          "/icons/email.png"
        );
      }
    },
    {
      id: 'trash',
      name: 'Trash',
      icon: "/icons/trash.png",
      x: 1366,
      y: 748,
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

  return (
    <Desktop
      onMouseMove={windowManager.handleMouseMove}
      onMouseUp={windowManager.handleMouseUp}
    >
      {/* Desktop Icons */}
      {desktopIcons.map(icon => (
        <DesktopIcon key={icon.id} {...icon} />
      ))}

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
        >
          {window.content}
        </Window>
      ))}

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