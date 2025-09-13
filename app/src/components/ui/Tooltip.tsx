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
    <div className={`absolute ${positionClasses[position]} bg-black bg-opacity-95 text-white p-4 border border-gray-600 max-w-xs z-20 shadow-lg ${className}`}>
      {children}
    </div>
  );
}