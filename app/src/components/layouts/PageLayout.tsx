'use client';

import { ReactNode } from 'react';

interface PageLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function PageLayout({ 
  header, 
  children, 
  footer,
  className = ''
}: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${className}`}>
      {header && (
        <div className="flex-shrink-0">
          {header}
        </div>
      )}
      
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      
      {footer && (
        <div className="flex-shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}