'use client';

import { ReactNode, useState, useEffect } from 'react';
import OSBackground from './OSBackground';
import Taskbar from './Taskbar';

interface OSLayoutProps {
  children: ReactNode;
  backgroundType?: 'gradient' | 'wallpaper' | 'solid';
  backgroundColor?: string;
  showTopBar?: boolean;
  topBarTitle?: string;
  showTaskbar?: boolean;
  onLogout?: () => void;
  windows?: any[];
  onWindowClick?: (id: string) => void;
}

export default function OSLayout({
  children,
  backgroundType = 'gradient',
  backgroundColor,
  showTopBar = true,
  topBarTitle = 'PhotoOS',
  showTaskbar = true,
  onLogout,
  windows = [],
  onWindowClick = () => {}
}: OSLayoutProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (showTaskbar) {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [showTaskbar]);

  return (
    <div className="w-full h-screen relative overflow-hidden select-none">
      <OSBackground type={backgroundType} color={backgroundColor} />

      {showTopBar && (
        <div className="h-8 bg-gray-800 border-b-2 border-gray-600 flex items-center justify-between px-4 relative z-50">
          <div className="flex items-center gap-2">
            <div className="text-white font-bold text-sm">{topBarTitle}</div>
          </div>
        </div>
      )}

      <div className={`relative ${showTopBar ? 'h-[calc(100vh-32px)]' : 'h-full'} ${showTaskbar ? 'pb-12' : ''}`}>
        {children}
      </div>

      {showTaskbar && (
        <Taskbar
          windows={windows}
          currentTime={currentTime}
          onWindowClick={onWindowClick}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}