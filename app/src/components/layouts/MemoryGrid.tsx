'use client';

import { ReactNode } from 'react';

interface MemoryGridProps {
  memories: ReactNode[];
  columns?: number;
  gap?: number;
  className?: string;
}

export default function MemoryGrid({ 
  memories, 
  columns = 3,
  gap = 4,
  className = ''
}: MemoryGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  };

  const gapClass = `gap-${gap}`;

  return (
    <div className={`grid ${gridCols[columns as keyof typeof gridCols]} ${gapClass} ${className}`}>
      {memories.map((memory, index) => (
        <div key={index} className="flex items-center justify-center">
          {memory}
        </div>
      ))}
    </div>
  );
}