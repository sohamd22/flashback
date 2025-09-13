'use client';

import { useState, useRef, useEffect } from 'react';
import PersonalPage from '@/components/PersonalPage';
import GraphCanvas from '@/components/GraphCanvas';
import { generateMockGraphData } from '@/types/graph';
import { useAuth } from '@/contexts/AuthContext';

interface Window {
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

interface DesktopIcon {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  onDoubleClick: () => void;
}

export default function OSPage() {
  const [windows, setWindows] = useState<Window[]>([]);
  const [draggedWindow, setDraggedWindow] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [nextZIndex, setNextZIndex] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const desktopRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 100,
        height: window.innerHeight - 150
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const desktopIcons: DesktopIcon[] = [
    {
      id: 'personal',
      name: user?.name ? `Videos` : 'My Memories',
      icon: "/icons/folder.png",
      x: 32,
      y: 32,
      onDoubleClick: () => openWindow(user?.name ? `${user.name}'s Personal Space` : 'Personal Memories', <PersonalApp />, "/icons/folder.png")
    },
    {
      id: 'contacts',
      name: 'Friends',
      icon: "/icons/contacts.png",
      x: 32,
      y: 140,
      onDoubleClick: () => openWindow('Social Graph - Photo Connections', <ContactsApp />, "/icons/contacts.png")
    },
  ];

  const openWindow = (title: string, content: React.ReactNode, icon: string) => {
    console.log('Opening window:', title);
    const newWindow: Window = {
      id: `window-${Date.now()}`,
      title,
      content,
      icon,
      x: 100 + windows.length * 30,
      y: 60 + windows.length * 30,
      width: 800,
      height: 600,
      zIndex: nextZIndex,
      minimized: false,
      maximized: false
    };

    setWindows(prev => {
      console.log('Current windows:', prev.length, 'Adding:', title);
      return [...prev, newWindow];
    });
    setNextZIndex(prev => prev + 1);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const minimizeWindow = (id: string) => {
    setWindows(prev =>
      prev.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w)
    );
  };

  const maximizeWindow = (id: string) => {
    setWindows(prev =>
      prev.map(w => w.id === id ? {
        ...w,
        maximized: !w.maximized,
        x: w.maximized ? 100 : 0,
        y: w.maximized ? 60 : 32,
        width: w.maximized ? 600 : (typeof window !== 'undefined' ? window.innerWidth : 1200),
        height: w.maximized ? 400 : (typeof window !== 'undefined' ? window.innerHeight - 64 : 600)
      } : w)
    );
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

  return (
    <div
      ref={desktopRef}
      className="w-full h-screen bg-gradient-to-br from-teal-600 via-blue-700 to-purple-800 relative overflow-hidden select-none"
      style={{
        backgroundImage: `url('/backgrounds/wallpaper.jpg')`,
        backgroundSize: '100% 100%',
        backgroundPosition: '0 0'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Desktop Icons */}
      {desktopIcons.map(icon => (
        <div
          key={icon.id}
          className="absolute cursor-pointer hover:bg-gray-800/40 hover:border-2 hover:border-white/60 p-1 transition-all duration-150"
          style={{ 
            left: icon.x, 
            top: icon.y,
            border: '2px solid transparent',
            imageRendering: 'pixelated',
            width: '80px'
          }}
          onDoubleClick={icon.onDoubleClick}
        >
          <div className="flex flex-col items-center gap-0.25 w-full" style={{ 
            minHeight: '70px'
          }}>
            <img src={icon.icon} alt={icon.name} className="w-full h-full object-cover" />
            <span className="text-white text-xs font-bold text-center leading-tight w-full" style={{ 
              fontFamily: 'monospace',
              wordWrap: 'break-word',
              fontSize: '10px'
            }}>
              {icon.name}
            </span>
          </div>
        </div>
      ))}

      {/* Windows */}
      {windows.map(window => (
        <div
          key={window.id}
          className={`absolute bg-gray-200 border-4 border-gray-800 ${
            window.minimized ? 'hidden' : ''
          }`}
          style={{
            left: window.x,
            top: window.y,
            width: window.width,
            height: window.height,
            zIndex: window.zIndex,
            boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
            imageRendering: 'pixelated'
          }}
        >
          {/* Title Bar */}
          <div
            className="h-8 bg-gray-400 border-b-4 border-gray-800 flex items-center justify-between px-2 cursor-move"
            style={{
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.5), inset 1px 1px 0px rgba(255,255,255,0.8)'
            }}
            onMouseDown={e => handleMouseDown(e, window.id)}
          >
            <span className="text-sm font-bold text-black truncate flex-1" style={{ fontFamily: 'monospace' }}>
              {window.title}
            </span>
            <div className="window-controls flex gap-1">
              <button
                className="w-6 h-6 bg-gray-300 border-2 border-gray-600 hover:bg-gray-400 flex items-center justify-center text-xs font-bold"
                style={{
                  boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
                  fontFamily: 'monospace'
                }}
                onClick={() => minimizeWindow(window.id)}
              >
                _
              </button>
              <button
                className="w-6 h-6 bg-gray-300 border-2 border-gray-600 hover:bg-gray-400 flex items-center justify-center text-xs font-bold"
                style={{
                  boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
                  fontFamily: 'monospace'
                }}
                onClick={() => maximizeWindow(window.id)}
              >
                □
              </button>
              <button
                className="w-6 h-6 bg-gray-300 border-2 border-gray-600 hover:bg-gray-400 flex items-center justify-center text-xs font-bold"
                style={{
                  boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
                  fontFamily: 'monospace'
                }}
                onClick={() => closeWindow(window.id)}
              >
                X
              </button>
            </div>
          </div>

          {/* Window Content */}
          <div className="overflow-hidden bg-white border-2 border-gray-600" style={{ 
            height: `${window.height - 40}px`,
            boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)'
          }}>
            {window.content}
          </div>
        </div>
      ))}

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 bg-neutral-800 border-t-4 border-neutral-900 flex items-center justify-between" style={{
        boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255, 255, 255, 0.3)'
      }}>
        {/* Start Menu */}
        <div className="flex items-center">
          <button 
            className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
            style={{
              boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
              width: '32px',
              height: '32px',
              borderRight: '1px solid #666'
            }}
            title="START"
          >
            <img 
              src="/icons/start.png" 
              alt="START"
              className="w-6 h-6 object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          </button>
          {user && (
            <button
              onClick={logout}
              className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
              style={{
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
                width: '32px',
                height: '32px',
                borderRight: '1px solid #666'
              }}
              title="LOGOUT"
            >
              <div className="w-6 h-6 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                <span className="text-lg">🚪</span>
              </div>
            </button>
          )}
        </div>

        {/* Running Apps */}
        <div className="flex flex-1">
          {windows.filter(w => !w.minimized).map((window, index) => (
            <button
              key={window.id}
              className="px-1 py-1 bg-gray-300 border-2 border-gray-600 hover:bg-gray-200 transition-all flex items-center justify-center"
              style={{
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)',
                width: '32px',
                height: '32px',
                borderRight: index < windows.filter(w => !w.minimized).length - 1 ? '1px solid #666' : '2px solid #666'
              }}
              onClick={() => bringToFront(window.id)}
              title={window.title}
            >
              <img 
                src={window.icon} 
                alt={window.title}
                className="w-6 h-6 object-cover"
                style={{ imageRendering: 'pixelated' }}
              />
            </button>
          ))}
        </div>

        {/* System Tray */}
        <div className="flex items-center">
          <div className="bg-gray-300 border-2 border-gray-600 px-2 py-1 text-black text-xs font-bold" style={{
            boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)',
            fontFamily: 'monospace',
            borderLeft: '1px solid #666'
          }}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Applications using existing components
function PersonalApp() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white relative">
        {/* Starry background */}
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full" style={{
            backgroundImage: `
              radial-gradient(2px 2px at 20px 30px, #eee, transparent),
              radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 90px 40px, #fff, transparent),
              radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
              radial-gradient(2px 2px at 160px 30px, #eee, transparent),
              radial-gradient(1px 1px at 200px 60px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 250px 20px, #fff, transparent),
              radial-gradient(2px 2px at 280px 90px, rgba(255,255,255,0.6), transparent),
              radial-gradient(1px 1px at 320px 50px, #eee, transparent),
              radial-gradient(1px 1px at 360px 10px, rgba(255,255,255,0.8), transparent)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '400px 100px'
          }} />
        </div>
        <div className="text-center relative z-10" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">INITIALIZING PERSONAL MEMORY SYSTEM</div>
        </div>
      </div>
    );
  }
  
  // Use the actual PersonalPage component but adapted for window
  return (
    <div className="h-full bg-black relative">
      {/* Starry background */}
      <div className="absolute inset-0 opacity-30 z-0">
        <div className="w-full h-full" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, #eee, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 160px 30px, #eee, transparent),
            radial-gradient(1px 1px at 200px 60px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 250px 20px, #fff, transparent),
            radial-gradient(2px 2px at 280px 90px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 320px 50px, #eee, transparent),
            radial-gradient(1px 1px at 360px 10px, rgba(255,255,255,0.8), transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 100px'
        }} />
      </div>
      <div className="relative z-10 h-full">
        <PersonalPage
          user={user}
          onBack={() => {}} // No back button needed in window
          width={780}
          height={560}
        />
      </div>
    </div>
  );
}

function ContactsApp() {
  const { user } = useAuth();
  
  if (!user || !user.profilePhoto || !user.name) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-white relative">
        {/* Starry background */}
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full" style={{
            backgroundImage: `
              radial-gradient(2px 2px at 20px 30px, #eee, transparent),
              radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 90px 40px, #fff, transparent),
              radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
              radial-gradient(2px 2px at 160px 30px, #eee, transparent),
              radial-gradient(1px 1px at 200px 60px, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 250px 20px, #fff, transparent),
              radial-gradient(2px 2px at 280px 90px, rgba(255,255,255,0.6), transparent),
              radial-gradient(1px 1px at 320px 50px, #eee, transparent),
              radial-gradient(1px 1px at 360px 10px, rgba(255,255,255,0.8), transparent)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '400px 100px'
          }} />
        </div>
        <div className="text-center relative z-10" style={{ fontFamily: 'monospace' }}>
          <div className="text-green-400 mb-2">LOADING...</div>
          <div className="text-xs">CONNECTING TO SOCIAL NETWORK</div>
        </div>
      </div>
    );
  }

  const graphData = generateMockGraphData(user.profilePhoto, user.name, 780, 560);
  
  // Use the actual GraphCanvas component
  return (
    <div className="h-full bg-black relative">
      {/* Starry background */}
      <div className="absolute inset-0 opacity-30 z-0">
        <div className="w-full h-full" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, #eee, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 160px 30px, #eee, transparent),
            radial-gradient(1px 1px at 200px 60px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 250px 20px, #fff, transparent),
            radial-gradient(2px 2px at 280px 90px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 320px 50px, #eee, transparent),
            radial-gradient(1px 1px at 360px 10px, rgba(255,255,255,0.8), transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 100px'
        }} />
      </div>
      <div className="relative z-10 h-full">
        <GraphCanvas 
          data={graphData}
          width={780}
          height={560}
          onUserClick={() => {}} // Disable navigation in window
          onFriendClick={(friendId) => {
            console.log(`Viewing friend: ${friendId} in desktop mode`);
          }}
        />
      </div>
    </div>
  );
}