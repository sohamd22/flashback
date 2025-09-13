'use client';

import { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

export default function Tooltip({ 
  children, 
  position = 'top-left',
  className = ''
}: TooltipProps) {
  const positionClasses = {
    'top-left': 'top-6 left-6',
    'top-right': 'top-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-right': 'bottom-6 right-6',
  };

  return (
    <div 
      className={`absolute ${positionClasses[position]} bg-gray-300 border-4 border-gray-800 text-black p-3 max-w-xs z-20 ${className}`}
      style={{
        boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {children}
    </div>
  );
}