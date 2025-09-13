'use client';

import { ReactNode } from 'react';

interface DualUserLayoutProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  centerContent?: ReactNode;
  className?: string;
}

export default function DualUserLayout({ 
  leftContent, 
  rightContent, 
  centerContent,
  className = ''
}: DualUserLayoutProps) {
  return (
    <div className={`flex h-full ${className}`}>
      <div className="flex-1 flex items-center justify-center p-8">
        {leftContent}
      </div>
      
      {centerContent && (
        <div className="flex items-center justify-center px-4">
          {centerContent}
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-8">
        {rightContent}
      </div>
    </div>
  );
}