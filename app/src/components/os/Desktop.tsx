'use client';

import { ReactNode } from 'react';

interface DesktopProps {
  children: ReactNode;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export default function Desktop({ children, onMouseMove, onMouseUp }: DesktopProps) {
  return (
    <div
      className="w-full h-screen relative overflow-hidden select-none"
      style={{
        backgroundImage: `url('/backgrounds/wallpaper.jpg')`,
        backgroundSize: '100% 100%',
        backgroundPosition: '0 0',
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {children}
    </div>
  );
}