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
}

// Window management hook
function useWindowManager() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [draggedWindow, setDraggedWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nextZIndex, setNextZIndex] = useState(1000); // Start with high z-index

  const openWindow = (title: string, content: React.ReactNode, icon: string) => {
    const windowWidth = typeof window !== 'undefined' ? Math.min(1200, window.innerWidth - 100) : 1200;
    const windowHeight = typeof window !== 'undefined' ? Math.min(800, window.innerHeight - 120) : 800;
    
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

  const desktopIcons: DesktopIconData[] = [
    {
      id: 'personal',
      name: profile?.name ? `Videos` : 'My Memories',
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
      name: 'Friends',
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