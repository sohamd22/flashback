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
    size === 'small' ? 60 : size === 'medium' ? 80 : 100;
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
      <div className={`relative w-full h-full rounded-full overflow-hidden shadow-xl border-4 ${
        borderColor || `border-white ${isHovered ? 'shadow-white/20' : ''}`
      }`}>
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      
      {showLabel && isHovered && (
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 transition-all duration-200 opacity-100 translate-y-0">
          <div className="bg-black bg-opacity-90 text-white px-2 py-1 text-sm font-medium whitespace-nowrap border border-gray-600">
            {labelText || "That's you! Click to view your memories →"}
          </div>
        </div>
      )}
    </div>
  );
}