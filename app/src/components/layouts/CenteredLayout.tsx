'use client';

import { ReactNode } from 'react';

interface CenteredLayoutProps {
  children: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export default function CenteredLayout({ 
  children, 
  maxWidth = 'md',
  className = ''
}: CenteredLayoutProps) {
  const maxWidthClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 bg-black ${className}`}>
      <div className={`w-full ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
}