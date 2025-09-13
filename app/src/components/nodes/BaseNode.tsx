'use client';

import { ReactNode } from 'react';
import { nodeAnimations } from '@/styles/nodeStyles';

interface BaseNodeProps {
  x: number;
  y: number;
  size: number;
  isHovered?: boolean;
  isDragging?: boolean;
  zIndex?: number;
  cursor?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  children: ReactNode;
  className?: string;
}

export default function BaseNode({
  x,
  y,
  size,
  isHovered = false,
  isDragging = false,
  zIndex = 2,
  cursor = 'default',
  onClick,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  children,
  className = '',
}: BaseNodeProps) {
  const transform = isDragging 
    ? nodeAnimations.drag.scale 
    : isHovered 
    ? nodeAnimations.hover.scale 
    : 'scale(1)';

  const transition = isDragging 
    ? nodeAnimations.drag.transition 
    : nodeAnimations.position.transition;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size/2,
        top: y - size/2,
        width: size,
        height: size,
        zIndex: isHovered ? 10 : isDragging ? 15 : zIndex,
        transform,
        cursor,
      }}
      className={`select-none ${transition} ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}