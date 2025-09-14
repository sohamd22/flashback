'use client';

import { ReactNode } from 'react';
import WindowTitleBar from './WindowTitleBar';

interface WindowProps {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  children: ReactNode;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose: () => void;
}

export default function Window({
  id,
  title,
  icon,
  x,
  y,
  width,
  height,
  zIndex,
  children,
  onMouseDown,
  onClose
}: WindowProps) {
  return (
    <div
      className="absolute bg-gray-200 border-4 border-gray-800"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex,
        boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
        imageRendering: 'pixelated'
      }}
    >
      <WindowTitleBar
        title={title}
        onMouseDown={onMouseDown}
        onClose={onClose}
      />
      
      <div 
        className="overflow-hidden bg-white border-2 border-gray-600 relative" 
        style={{ 
          height: `${height - 40}px`,
          boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.2)'
        }}
      >
        {children}
      </div>
    </div>
  );
}