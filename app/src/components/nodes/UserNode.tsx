'use client';

import BaseNode from './BaseNode';
import NodeImage from './NodeImage';
import NodeLabel from './NodeLabel';
import { nodeColors, nodeSizes } from '@/styles/nodeStyles';

interface UserNodeProps {
  id: string;
  x: number;
  y: number;
  photo: string;
  name: string;
  size?: 'small' | 'medium' | 'large' | number;
  isHovered?: boolean;
  isDragging?: boolean;
  showLabel?: boolean;
  labelText?: string;
  borderColor?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export default function UserNode({
  id,
  x,
  y,
  photo,
  name,
  size = 'large',
  isHovered = false,
  isDragging = false,
  showLabel = true,
  labelText,
  borderColor,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onMouseDown
}: UserNodeProps) {
  const nodeSize = typeof size === 'number' ? size : 
    size === 'small' ? 60 : size === 'medium' ? 80 : 200;
  const borderWidth = 4;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: x - nodeSize/2,
        top: y - nodeSize/2,
        width: nodeSize,
        height: nodeSize,
        zIndex: isDragging ? 10 : (isHovered ? 5 : 2),
        transform: isDragging ? 'scale(1.1)' : isHovered ? 'scale(1.05)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer'
      }}
      className="select-none"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
    >
      <div 
        className="relative w-full h-full bg-white border-4 border-gray-600 flex items-center justify-center"
        style={{
          imageRendering: 'pixelated',
          boxShadow: 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 6px 6px 0px rgba(0,0,0,0.2)',
          background: 'linear-gradient(135deg, #bfdbfe, #3b82f6)'
        }}
      >
        {/* User photo */}
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover select-none pointer-events-none"
          style={{ 
            padding: '8px',
            imageRendering: 'pixelated'
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      
      {showLabel && isHovered && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-200">
          <div 
            className="bg-white border-4 border-gray-600 text-gray-800 px-3 py-1 text-xs font-bold whitespace-nowrap"
            style={{
              fontFamily: 'monospace',
              imageRendering: 'pixelated',
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,1), 4px 4px 0px rgba(0,0,0,0.2)'
            }}
          >
            {labelText || name}
          </div>
        </div>
      )}
    </div>
  );
}