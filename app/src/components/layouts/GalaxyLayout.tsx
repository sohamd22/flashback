'use client';

import { ReactNode } from 'react';

interface GalaxyLayoutProps {
  centerNode: ReactNode;
  floatingNodes: ReactNode[];
  className?: string;
}

export default function GalaxyLayout({ 
  centerNode, 
  floatingNodes, 
  className = ''
}: GalaxyLayoutProps) {
  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        {centerNode}
      </div>
      
      {floatingNodes.map((node, index) => (
        <div key={index} className="absolute">
          {node}
        </div>
      ))}
    </div>
  );
}