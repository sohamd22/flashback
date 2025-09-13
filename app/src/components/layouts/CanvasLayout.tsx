'use client';

import { ReactNode } from 'react';

interface CanvasLayoutProps {
  children: ReactNode;
  className?: string;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}

export default function CanvasLayout({ 
  children, 
  className = '',
  onMouseMove,
  onMouseUp
}: CanvasLayoutProps) {
  return (
    <div 
      className={`relative w-full h-screen bg-black overflow-hidden ${className}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {children}
    </div>
  );
}