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
        className="relative w-full h-full"
        style={{
          imageRendering: 'pixelated',
          filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5)) drop-shadow(0 0 12px rgba(59, 130, 246, 0.3))'
        }}
      >
        {/* Border-blue.png as background */}
        <img
          src="/icons/border-blue.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        
        {/* User photo as circular overlay, smaller */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={photo}
            alt={name}
            className="select-none pointer-events-none"
            style={{ 
              width: `${nodeSize * 0.5}px`,
              height: `${nodeSize * 0.5}px`,
              borderRadius: '50%',
              margin: '4.5px 0 0 3.5px',
              objectFit: 'cover',
              imageRendering: 'pixelated',
              border: '2px solid rgba(0,0,0,0.3)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.2), 0 0 0 2px rgba(0,0,0,0.1)'
            }}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      </div>
      
      {showLabel && isHovered && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 transition-all duration-200 opacity-100 translate-y-0">
          <div 
            className="bg-gray-300 border-4 border-gray-800 text-black px-2 py-1 text-xs font-bold whitespace-nowrap"
            style={{
              boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
              fontFamily: 'monospace'
            }}
          >
            {labelText || "YOU"}
          </div>
        </div>
      )}
    </div>
  );
}