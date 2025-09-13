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
    <div className={`min-h-screen bg-black text-white flex flex-col ${className}`} style={{
      background: 'linear-gradient(45deg, #1a1a2e 25%, #16213e 25%, #16213e 50%, #1a1a2e 50%, #1a1a2e 75%, #16213e 75%), linear-gradient(-45deg, #1a1a2e 25%, #16213e 25%, #16213e 50%, #1a1a2e 50%, #1a1a2e 75%, #16213e 75%)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 10px 10px'
    }}>
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